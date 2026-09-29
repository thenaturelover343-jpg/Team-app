import React, { useState } from 'react';
import { User, CorrectionRequest, Incident, formatDate } from '../types';
import { secureApi } from '../lib/secureApi';

export function AdminReportsTab({ users, incidents, corrections, onChanged }: { users: User[]; incidents: Incident[]; corrections: CorrectionRequest[]; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState('');
  const review = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    try { await secureApi.reviewCorrectionRequest(id, status); await onChanged(); } finally { setBusyId(''); }
  };
  const userName = (id: string) => users.find(user => user.id === id)?.name || 'Onbekende medewerker';
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-zinc-900">Incidenten en correcties</h2><p className="text-sm text-zinc-500 mt-1">Behandel meldingen van medewerkers.</p></div>
    <section className="space-y-3"><h3 className="font-bold text-lg">Openstaande tijdcorrecties</h3>{corrections.filter(item => item.status === 'pending').length === 0 && <div className="ops-panel p-5 text-zinc-500">Geen openstaande verzoeken.</div>}{corrections.filter(item => item.status === 'pending').map(item => <article key={item.id} className="ops-card p-5 space-y-3"><div className="flex justify-between gap-3"><div><div className="font-bold">{userName(item.userId)}</div><div className="text-sm text-zinc-500">{formatDate(item.createdAt)}</div></div><span className="ops-chip-warning h-fit">In behandeling</span></div><p className="text-sm text-zinc-700">{item.reason}</p><div className="ops-panel p-3 text-sm">{item.requestedClockIn && <div>Nieuwe start: <strong>{new Date(item.requestedClockIn).toLocaleString('nl-BE')}</strong></div>}{item.requestedClockOut && <div>Nieuwe einde: <strong>{new Date(item.requestedClockOut).toLocaleString('nl-BE')}</strong></div>}</div><div className="grid grid-cols-2 gap-3"><button disabled={busyId === item.id} onClick={() => review(item.id, 'rejected')} className="ops-btn-danger">Afwijzen</button><button disabled={busyId === item.id} onClick={() => review(item.id, 'approved')} className="ops-btn-primary">Goedkeuren</button></div></article>)}</section>
    <section className="space-y-3"><h3 className="font-bold text-lg">Incidentmeldingen</h3>{incidents.length === 0 && <div className="ops-panel p-5 text-zinc-500">Nog geen incidenten gemeld.</div>}{incidents.map(item => <article key={item.id} className={`ops-card p-5 ${item.severity === 'high' ? 'border-red-400/60' : ''}`}><div className="flex justify-between gap-3 mb-2"><div className="font-bold">{item.category} · {userName(item.userId)}</div><span className={item.severity === 'high' ? 'ops-chip-danger' : 'ops-chip-info'}>{item.severity}</span></div><p className="text-sm text-zinc-700">{item.description}</p><div className="text-xs text-zinc-400 mt-3">{new Date(item.occurredAt).toLocaleString('nl-BE')}{item.latitude !== undefined ? ` · GPS ${item.latitude.toFixed(5)}, ${item.longitude?.toFixed(5)}` : ''}</div></article>)}</section>
  </div>;
}
