'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock3, Download, Loader2, Users } from 'lucide-react';
import type { PlannedShift, PushState, Shift, TeamNotification, User } from '../types';
import { formatDate, formatTime, localDateKey } from '../types';
import { secureApi } from '../lib/secureApi';
import NotificationCenter from './NotificationCenter';

function monthStart() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; }

export default function ControlCenter({ users, plannedShifts, shifts, notifications, push, onChanged }: { users: User[]; plannedShifts: PlannedShift[]; shifts: Shift[]; notifications: TeamNotification[]; push: PushState; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(localDateKey);
  const [message, setMessage] = useState('');
  const today = localDateKey();
  const todayShifts = plannedShifts.filter(item => item.date === today && item.status === 'published');
  const pending = shifts.filter(item => item.clockOut && (item.approvalStatus || 'pending') === 'pending');
  const active = shifts.filter(item => !item.clockOut);
  const alerts = notifications.filter(item => (item.type === 'late' || item.type === 'no_show') && new Date(item.createdAt).toDateString() === new Date().toDateString());
  const name = (id: string) => users.find(item => item.id === id)?.name || 'Onbekende medewerker';

  const review = async (shiftId: string, status: 'approved' | 'rejected') => {
    setBusy(shiftId); setMessage('');
    try { await secureApi.reviewTimesheet(shiftId, status, note); setNote(''); await onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Beoordeling is mislukt.'); }
    finally { setBusy(''); }
  };

  const download = async (kind: 'payroll' | 'invoice') => {
    setBusy(kind); setMessage('');
    try {
      const { data } = await secureApi.exportHours(kind, startDate, endDate);
      const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = data.filename; anchor.click(); URL.revokeObjectURL(url);
      setMessage(`${data.rows} goedgekeurde tijdregistratie${data.rows === 1 ? '' : 's'} geëxporteerd.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Export is mislukt.'); }
    finally { setBusy(''); }
  };

  return <div className="space-y-8">
    <div><h2 className="text-2xl font-bold text-zinc-900">Planner-dashboard</h2><p className="text-sm text-zinc-500 mt-1">Live controle op bezetting, aanwezigheid en goedkeuring.</p></div>
    {message && <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-3 text-sm font-semibold">{message}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[{ label: 'Gepland vandaag', value: todayShifts.reduce((sum, item) => sum + item.memberIds.length, 0), icon: Users }, { label: 'Nu ingeklokt', value: active.length, icon: Clock3 }, { label: 'Te laat / no-show', value: alerts.length, icon: AlertTriangle }, { label: 'Uren te controleren', value: pending.length, icon: CheckCircle }].map(item => <div key={item.label} className="bg-white border border-zinc-200 rounded-2xl p-4"><item.icon className="w-5 h-5 text-zinc-500" /><div className="text-3xl font-black mt-3">{item.value}</div><div className="text-sm text-zinc-500 mt-1">{item.label}</div></div>)}
    </div>

    <section className="space-y-3"><h3 className="font-bold text-lg">Bezetting vandaag</h3>{todayShifts.length === 0 && <div className="bg-white border border-zinc-200 rounded-xl p-5 text-zinc-500">Vandaag zijn geen diensten gepubliceerd.</div>}{todayShifts.map(item => <article key={item.id} className="bg-white border border-zinc-200 rounded-2xl p-4"><div className="flex justify-between gap-3"><div><div className="font-bold">{item.startTime}–{item.endTime} · {item.title}</div><div className="text-sm text-zinc-500">{item.customerName || 'Geen klantlocatie'}</div></div><span className="text-sm font-bold">{item.memberIds.length} medewerker{item.memberIds.length === 1 ? '' : 's'}</span></div><div className="mt-3 flex flex-wrap gap-2">{item.memberIds.map(userId => { const actual = shifts.find(shift => shift.plannedShiftId === item.id && shift.userId === userId); return <span key={userId} className={`text-xs font-bold px-3 py-1.5 rounded-full ${actual ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'}`}>{name(userId)} · {actual ? 'ingeklokt' : 'verwacht'}</span>; })}</div></article>)}</section>

    <section className="space-y-3"><h3 className="font-bold text-lg">Openstaande urencontrole</h3>{pending.length === 0 && <div className="bg-white border border-zinc-200 rounded-xl p-5 text-zinc-500">Alle afgesloten uren zijn behandeld.</div>}{pending.slice(0, 50).map(item => { const minutes = item.clockOut ? Math.max(0, Math.round((item.clockOut - item.clockIn) / 60000)) : 0; return <article key={item.id} className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3"><div className="flex justify-between gap-3"><div><div className="font-bold">{name(item.userId)}</div><div className="text-sm text-zinc-500">{formatDate(item.clockIn)} · {formatTime(item.clockIn)}–{item.clockOut ? formatTime(item.clockOut) : ''}</div></div><span className="font-bold">{Math.floor(minutes / 60)}u {minutes % 60}m</span></div><input value={note} onChange={event => setNote(event.target.value)} placeholder="Opmerking bij afwijzing (optioneel)" className="w-full border border-zinc-200 rounded-xl p-3 text-sm" /><div className="grid grid-cols-2 gap-3"><button disabled={busy !== ''} onClick={() => review(item.id, 'rejected')} className="border border-red-200 text-red-700 rounded-xl py-3 font-bold">Afwijzen</button><button disabled={busy !== ''} onClick={() => review(item.id, 'approved')} className="bg-zinc-900 text-white rounded-xl py-3 font-bold flex items-center justify-center">{busy === item.id && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Goedkeuren</button></div></article>; })}</section>

    <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4"><div><h3 className="font-bold text-lg">Loon- en facturatie-export</h3><p className="text-sm text-zinc-500">Alleen goedgekeurde, afgesloten tijdregistraties worden opgenomen.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm font-bold">Van<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3" /></label><label className="text-sm font-bold">Tot<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3" /></label></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button onClick={() => download('payroll')} disabled={busy !== ''} className="bg-zinc-900 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4" />Loonexport CSV</button><button onClick={() => download('invoice')} disabled={busy !== ''} className="border border-zinc-300 rounded-xl py-3 font-bold flex items-center justify-center gap-2"><Download className="w-4 h-4" />Facturatie CSV</button></div></section>

    <NotificationCenter notifications={notifications} push={push} onChanged={onChanged} />
  </div>;
}
