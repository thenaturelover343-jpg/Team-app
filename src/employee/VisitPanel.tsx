import React, { useEffect, useRef, useState } from 'react';
import type { Assignment, GeoLocation } from '../types';
import { formatTime, getCurrentLocation } from '../types';
import { secureApi } from '../lib/secureApi';
import { armVisitFence, disarmVisitFence, isNativeApp, pauseVisitFence, resumeVisitFence } from '../lib/visitFence';

export function VisitPanel({ clockedIn, onBreak, assignments, onChanged }: { clockedIn: boolean; onBreak: boolean; assignments: Assignment[]; onChanged: () => Promise<void> }) {
  const [banner, setBanner] = useState('');
  const [choices, setChoices] = useState<{ id: string; name: string }[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const siteKey = assignments.map(item => `${item.id}:${item.status}:${item.siteLatitude ?? ''}:${item.siteLongitude ?? ''}`).join('|');

  useEffect(() => {
    if (!clockedIn || onBreak || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let stopped = false;
    let last = 0;
    const send = async (location: GeoLocation, assignmentId?: string) => {
      const { data } = await secureApi.syncVisitLocation(location, assignmentId);
      if (stopped) return;
      setChoices(data.choices || []);
      if (data.active) setBanner(`Tijd loopt bij ${data.active.name} sinds ${formatTime(data.active.since)}.`);
      else if (data.type === 'ambiguous') setBanner('Twee klanten in de buurt. Kies voor wie de tijd loopt.');
      else setBanner('');
      if (data.changed) await onChangedRef.current();
    };
    const watch = navigator.geolocation.watchPosition(position => {
      const stamp = Date.now();
      if (stamp - last < 15000) return;
      last = stamp;
      void send({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        capturedAt: position.timestamp || stamp,
      }).catch(() => undefined);
    }, () => undefined, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    return () => { stopped = true; navigator.geolocation.clearWatch(watch); };
  }, [clockedIn, onBreak]);

  useEffect(() => {
    let stopped = false;
    const syncNative = async () => {
      if (!isNativeApp()) return;
      try {
        if (!clockedIn) {
          await disarmVisitFence();
          return;
        }
        if (onBreak) {
          await pauseVisitFence();
          if (!stopped) setBanner('Pauze: de klanttijd staat stil.');
          return;
        }
        await resumeVisitFence();
        const armed = await armVisitFence(assignments);
        if (!stopped) {
          setBanner(armed
            ? 'Klanttijd loopt ook als de app dicht is. Alleen tijdens deze dienst, locatie op Altijd.'
            : 'Geen opdracht met coördinaten. Zonder adres start de klanttijd niet vanzelf.');
        }
      } catch (error) {
        if (!stopped) setBanner(error instanceof Error ? error.message : 'Achtergrondlocatie lukt niet.');
      }
    };
    void syncNative();
    return () => { stopped = true; };
  }, [clockedIn, onBreak, siteKey]);

  const pick = async (assignmentId: string) => {
    setBusy(assignmentId);
    try {
      const location = await getCurrentLocation();
      const { data } = await secureApi.syncVisitLocation(location, assignmentId);
      setChoices(data.choices || []);
      if (data.active) setBanner(`Tijd loopt bij ${data.active.name} sinds ${formatTime(data.active.since)}.`);
      if (data.changed) await onChanged();
    } finally { setBusy(''); }
  };

  const saveNote = async (assignment: Assignment) => {
    const note = (drafts[assignment.id] ?? assignment.workNotes ?? '').trim();
    if (!note) return;
    setBusy(assignment.id);
    try { await secureApi.saveVisitNote(assignment.id, note); await onChanged(); }
    finally { setBusy(''); }
  };

  const openNotes = assignments.filter(item => item.departureTime && !item.workNotes?.trim() && item.status !== 'completed');
  const missing = assignments.filter(item => item.status === 'pending');
  if (!clockedIn && openNotes.length === 0) return null;

  return (
    <div className="space-y-3">
      {clockedIn && <div className="ops-card p-5 space-y-3">
        <h2 className="font-bold text-zinc-900">Bij de klant</h2>
        <p className="text-sm text-zinc-600">{onBreak ? 'Pauze: de klanttijd staat stil.' : banner || (isNativeApp() ? 'Klanttijd loopt ook als de app dicht is. Twee minuten op het adres telt.' : 'In de browser en via het beginscherm-icoon telt dit alleen zolang dit scherm open blijft. De geïnstalleerde Team-app meet ook met het scherm uit.')}</p>
        {choices.length > 0 && <div className="space-y-2">{choices.map(choice => <button key={choice.id} type="button" disabled={busy !== ''} onClick={() => pick(choice.id)} className="ops-btn-primary w-full py-3">{busy === choice.id ? 'Bezig…' : choice.name}</button>)}</div>}
        {missing.length > 0 && <p className="text-sm text-zinc-500">Nog geen aankomst: {missing.map(item => item.customerName || 'Klant').join(', ')}.</p>}
      </div>}
      {openNotes.length > 0 && <div className="ops-card p-5 space-y-4">
        <h2 className="font-bold text-zinc-900">Werkbon</h2>
        <p className="text-sm text-zinc-600">De tijd staat al vast. De zin mag nu, of later. Zonder zin blijft de bon open voor kantoor.</p>
        {openNotes.map(item => <label key={item.id} className="block space-y-2 text-sm font-bold text-zinc-800">{item.customerName || 'Klant'} · {formatTime(item.arrivalTime || item.departureTime!)}–{formatTime(item.departureTime!)}<textarea value={drafts[item.id] ?? ''} onChange={event => setDrafts(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Wat is gedaan?" className="ops-input w-full p-3 font-medium h-20" /><button type="button" disabled={busy !== ''} onClick={() => saveNote(item)} className="ops-btn-primary px-4 py-2">Bewaar</button></label>)}
      </div>}
    </div>
  );
}
