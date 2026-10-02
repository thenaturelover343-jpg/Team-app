import React, { useState } from 'react';
import type { Assignment, User } from '../types';
import { formatTime, localDateKey } from '../types';
import { secureApi } from '../lib/secureApi';

function localInput(ms?: number) {
  if (!ms) return '';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function VisitGaps({ users, assignments, onChanged }: { users: User[]; assignments: Assignment[]; onChanged: () => Promise<void> }) {
  const today = localDateKey();
  const name = (id: string) => users.find(item => item.id === id)?.name || 'Onbekende medewerker';
  const gaps = assignments.filter(item => item.date === today && (item.status === 'pending' || !item.workNotes?.trim() || (item.status === 'arrived' && !item.departureTime)));
  const [forms, setForms] = useState<Record<string, { arrival: string; departure: string; reason: string }>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const formFor = (item: Assignment) => forms[item.id] || { arrival: localInput(item.arrivalTime), departure: localInput(item.departureTime), reason: '' };
  const save = async (item: Assignment) => {
    const form = formFor(item);
    setBusy(item.id); setMessage('');
    try {
      await secureApi.correctAssignmentVisit(item.id, new Date(form.arrival).getTime(), new Date(form.departure).getTime(), form.reason);
      await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Correctie mislukt.'); }
    finally { setBusy(''); }
  };
  return (
    <section className="space-y-3">
      <h3 className="font-bold text-lg">Klantbezoeken vandaag</h3>
      {message && <div className="ops-panel p-3 text-sm font-semibold">{message}</div>}
      {gaps.length === 0 && <div className="ops-panel p-5 text-zinc-500">Geen open aankomst of werkbon voor vandaag.</div>}
      {gaps.map(item => {
        const form = formFor(item);
        const label = item.status === 'pending' ? 'Geen aankomst' : !item.departureTime ? 'Nog ter plaatse' : !item.workNotes?.trim() ? 'Werkbon open' : 'Open';
        return (
          <article key={item.id} className="ops-card p-4 space-y-3">
            <div className="flex justify-between gap-3"><div><div className="font-bold">{item.customerName || 'Klant'}</div><div className="text-sm text-zinc-500">{name(item.userId)} · {label}{item.arrivalTime ? ` · ${formatTime(item.arrivalTime)}` : ''}{item.departureTime ? `–${formatTime(item.departureTime)}` : ''}</div></div></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-sm font-bold">Aankomst<input type="datetime-local" value={form.arrival} onChange={event => setForms(current => ({ ...current, [item.id]: { ...form, arrival: event.target.value } }))} className="ops-input mt-1.5 w-full p-3" /></label>
              <label className="text-sm font-bold">Vertrek<input type="datetime-local" value={form.departure} onChange={event => setForms(current => ({ ...current, [item.id]: { ...form, departure: event.target.value } }))} className="ops-input mt-1.5 w-full p-3" /></label>
            </div>
            <input value={form.reason} onChange={event => setForms(current => ({ ...current, [item.id]: { ...form, reason: event.target.value } }))} placeholder="Reden van de correctie" className="ops-input w-full p-3 text-sm" />
            <button type="button" disabled={busy !== ''} onClick={() => save(item)} className="ops-btn-primary px-4 py-2">{busy === item.id ? 'Bezig…' : 'Tijd rechtzetten'}</button>
          </article>
        );
      })}
    </section>
  );
}
