'use client';

import React, { useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock3, Loader2, MapPin, Send, Trash2, Users } from 'lucide-react';
import type { Customer, PlannedShift, User } from '../types';
import { localDateKey } from '../types';
import { secureApi } from '../lib/secureApi';

type Props = { users: User[]; customers: Customer[]; shifts: PlannedShift[]; onChanged: () => Promise<void> };

function mondayOf(value: Date) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dateKey(value: Date) {
  return localDateKey(value);
}

export default function WeekPlanner({ users, customers, shifts, onChanged }: Props) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const employees = users.filter(user => user.active && (user.role === 'employee' || user.role === 'admin'));
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekKeys = days.map(dateKey);
  const weekShifts = shifts.filter(shift => weekKeys.includes(shift.date));
  const drafts = weekShifts.filter(shift => shift.status === 'draft');

  const publishWeek = async () => {
    if (!drafts.length) return;
    setBusy(true); setError('');
    try { await secureApi.publishPlannedShifts(drafts.map(shift => shift.id)); await onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Publiceren is mislukt.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Weekplanner</h2>
          <p className="text-sm text-zinc-500 mt-1">Plan diensten los van opdrachten en publiceer ze wanneer de week klaarstaat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setWeekStart(mondayOf(new Date()))} className="ops-btn-secondary px-4 text-sm">Deze week</button>
          <button onClick={() => setShowForm(value => !value)} className="ops-btn-primary px-4 text-sm gap-2"><CalendarPlus className="w-4 h-4" />Dienst toevoegen</button>
          <button onClick={publishWeek} disabled={busy || !drafts.length} className="ops-btn-secondary px-4 text-sm gap-2"><Send className="w-4 h-4" />Publiceer week ({drafts.length})</button>
        </div>
      </div>

      {error && <div className="ops-chip-danger w-full justify-start px-4 py-3 text-sm">{error}</div>}
      {showForm && <ShiftForm employees={employees} customers={customers} initialDate={weekKeys[0]} onCancel={() => setShowForm(false)} onSaved={async () => { setShowForm(false); await onChanged(); }} />}

      <div className="ops-card overflow-hidden">
        <div className="ops-panel flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3">
          <button aria-label="Vorige week" onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg hover:bg-zinc-200"><ChevronLeft className="w-5 h-5" /></button>
          <div className="font-bold text-zinc-800">{days[0].toLocaleDateString('nl-BE', { day: 'numeric', month: 'long' })} – {days[6].toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <button aria-label="Volgende week" onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg hover:bg-zinc-200"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 min-w-0">
          {days.map(day => {
            const key = dateKey(day);
            const dayShifts = weekShifts.filter(shift => shift.date === key).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <section key={key} className="min-h-44 border-b md:border-b-0 md:border-r last:border-r-0 border-white/10 p-2.5">
                <div className={`mb-2 px-1 ${key === localDateKey() ? 'text-zinc-900' : 'text-zinc-500'}`}>
                  <div className="text-xs uppercase font-bold tracking-wide">{day.toLocaleDateString('nl-BE', { weekday: 'short' })}</div>
                  <div className="text-lg font-black">{day.getDate()}</div>
                </div>
                <div className="space-y-2">
                  {dayShifts.map(shift => <ShiftCard key={shift.id} shift={shift} users={users} onChanged={onChanged} />)}
                  {!dayShifts.length && <div className="ops-panel text-xs text-zinc-400 border-dashed p-3 text-center">Geen diensten</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShiftCard({ shift, users, onChanged }: { shift: PlannedShift; users: User[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const memberNames = shift.memberIds.map(id => users.find(user => user.id === id)?.name || 'Onbekend');
  const confirmed = shift.memberIds.filter(id => shift.confirmations[id] === 'confirmed').length;
  const declined = shift.memberIds.filter(id => shift.confirmations[id] === 'declined').length;
  const remove = async () => {
    if (!window.confirm('Deze conceptdienst verwijderen?')) return;
    setBusy(true);
    try { await secureApi.deletePlannedShift(shift.id); await onChanged(); } finally { setBusy(false); }
  };
  return (
    <article className={`ops-panel p-3 text-xs space-y-2 ${shift.status === 'published' ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-amber-400/50 bg-amber-400/10'}`}>
      <div className="flex items-start justify-between gap-1">
        <div className="font-extrabold text-zinc-900 leading-tight">{shift.title}</div>
        {shift.status === 'draft' && <button disabled={busy} onClick={remove} className="text-zinc-400 hover:text-red-600" aria-label="Conceptdienst verwijderen">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>}
      </div>
      <div className="flex items-center gap-1.5 font-bold text-zinc-700"><Clock3 className="w-3.5 h-3.5" />{shift.startTime}–{shift.endTime}</div>
      {shift.breakMinutes > 0 && <div className="text-zinc-500">Pauze: {shift.breakMinutes} min.</div>}
      {shift.customerName && <div className="flex items-start gap-1.5 text-zinc-600"><MapPin className="w-3.5 h-3.5 shrink-0" /><span>{shift.customerName}</span></div>}
      <div className="flex items-start gap-1.5 text-zinc-600"><Users className="w-3.5 h-3.5 shrink-0" /><span>{memberNames.join(', ')}</span></div>
      <div className="pt-1 border-t border-black/5 font-semibold text-zinc-600">
        {shift.status === 'draft' ? 'Concept' : `${confirmed}/${shift.memberIds.length} bevestigd${declined ? ` · ${declined} geweigerd` : ''}`}
      </div>
    </article>
  );
}

function ShiftForm({ employees, customers, initialDate, onCancel, onSaved }: { employees: User[]; customers: Customer[]; initialDate: string; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('Werkdienst');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [notes, setNotes] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = (id: string) => setMemberIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await secureApi.savePlannedShift({ title, customerId, date, startTime, endTime, breakMinutes, memberIds, repeatWeeks, notes, checklist: checklistText.split('\n').map(item => item.trim()).filter(Boolean) }); await onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'De dienst kon niet worden opgeslagen.'); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="ops-card p-5 md:p-6 space-y-5">
      <div className="flex items-center justify-between"><h3 className="font-extrabold text-lg">Nieuwe dienst</h3><span className="ops-chip-warning">Wordt als concept opgeslagen</span></div>
      {error && <div className="ops-chip-danger w-full justify-start p-3 text-sm">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="md:col-span-2 text-sm font-bold text-zinc-700">Titel<input value={title} onChange={event => setTitle(event.target.value)} required className="ops-input mt-1.5 w-full p-3 font-medium" /></label>
        <label className="md:col-span-2 text-sm font-bold text-zinc-700">Klantlocatie<select value={customerId} onChange={event => setCustomerId(event.target.value)} className="ops-input mt-1.5 w-full p-3 font-medium"><option value="">Geen klantlocatie</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} — {customer.address}</option>)}</select></label>
        <label className="text-sm font-bold text-zinc-700">Datum<input type="date" value={date} onChange={event => setDate(event.target.value)} required className="ops-input mt-1.5 w-full p-3 font-medium" /></label>
        <label className="text-sm font-bold text-zinc-700">Start<input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} required className="ops-input mt-1.5 w-full p-3 font-medium" /></label>
        <label className="text-sm font-bold text-zinc-700">Einde<input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} required className="ops-input mt-1.5 w-full p-3 font-medium" /></label>
        <label className="text-sm font-bold text-zinc-700">Pauze (min.)<input type="number" min="0" max="240" value={breakMinutes} onChange={event => setBreakMinutes(Number(event.target.value))} className="ops-input mt-1.5 w-full p-3 font-medium" /></label>
        <label className="text-sm font-bold text-zinc-700">Herhalen<select value={repeatWeeks} onChange={event => setRepeatWeeks(Number(event.target.value))} className="ops-input mt-1.5 w-full p-3 font-medium">{[1,2,3,4,6,8,12].map(count => <option key={count} value={count}>{count === 1 ? 'Eenmalig' : `${count} weken`}</option>)}</select></label>
        <label className="md:col-span-3 text-sm font-bold text-zinc-700">Notities<textarea value={notes} onChange={event => setNotes(event.target.value)} className="ops-input mt-1.5 w-full p-3 font-medium h-20 resize-none" /></label>
        <label className="md:col-span-4 text-sm font-bold text-zinc-700">Checklist — één taak per regel<textarea value={checklistText} onChange={event => setChecklistText(event.target.value)} placeholder={'Materiaal controleren\nLocatie netjes achterlaten'} className="ops-input mt-1.5 w-full p-3 font-medium h-24 resize-none" /></label>
      </div>
      <fieldset><legend className="text-sm font-bold text-zinc-700 mb-2">Medewerkers</legend><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">{employees.map(employee => <label key={employee.id} className={`ops-panel flex items-center gap-3 p-3 cursor-pointer ${memberIds.includes(employee.id) ? 'border-cyan-400/60 bg-cyan-400/10' : ''}`}><input type="checkbox" checked={memberIds.includes(employee.id)} onChange={() => toggle(employee.id)} className="w-4 h-4 accent-cyan-500" /><span className="font-semibold text-sm">{employee.name}</span></label>)}</div></fieldset>
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="ops-btn-secondary px-5">Annuleren</button><button type="submit" disabled={busy || !memberIds.length} className="ops-btn-primary px-6 gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Concept opslaan</button></div>
    </form>
  );
}
