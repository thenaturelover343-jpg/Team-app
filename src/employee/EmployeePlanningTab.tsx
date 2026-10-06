import React, { useState } from 'react';
import { Assignment, Attachment, PlannedShift, formatDate, localDateKey, weekStartKey } from '../types';
import { MapPin, CheckCircle, Loader2, XCircle, ClipboardList, Upload, Download, ListTodo } from 'lucide-react';
import { secureApi } from '../lib/secureApi';
import { useLanguage } from '../i18n';

export function EmployeePlanningTab({ userId, shifts, assignments = [], attachments, onChanged }: {
  userId: string;
  shifts: PlannedShift[];
  assignments?: Assignment[];
  attachments: Attachment[];
  onChanged: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const today = localDateKey();
  const weekStart = weekStartKey(today);
  const weekShifts = [...shifts]
    .filter(shift => shift.date >= weekStart)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const todayShifts = weekShifts.filter(shift => shift.date === today);
  const weekAssignments = [...assignments]
    .filter(item => item.date >= weekStart && item.userId === userId)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const todayAssignments = weekAssignments.filter(item => item.date === today);
  // Default to week: a dienst on Monday must still show on Tuesday without hunting tabs.
  const [mode, setMode] = useState<'today' | 'week'>(() => (todayShifts.length || todayAssignments.length ? 'today' : 'week'));
  const visible = mode === 'today' ? todayShifts : weekShifts;
  const visibleAssignments = mode === 'today' ? todayAssignments : weekAssignments;
  const respond = async (shiftId: string, status: 'confirmed' | 'declined') => {
    setBusyId(shiftId); setError('');
    try { await secureApi.confirmPlannedShift(shiftId, status); await onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Uw antwoord kon niet worden opgeslagen.'); }
    finally { setBusyId(''); }
  };
  const toggleTask = async (shift: PlannedShift, taskId: string) => {
    const current = shift.checklistStates[userId] || [];
    const completed = current.includes(taskId) ? current.filter(id => id !== taskId) : [...current, taskId];
    setBusyId(shift.id); setError('');
    try { await secureApi.updatePlannedShiftChecklist(shift.id, completed); await onChanged().catch(() => undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Checklist kon niet worden bijgewerkt.'); }
    finally { setBusyId(''); }
  };
  const upload = async (shiftId: string, files: FileList | null) => {
    if (!files?.length) return;
    setBusyId(shiftId); setError('');
    try { for (const file of Array.from(files).slice(0, 5)) await secureApi.uploadAttachment('planned_shift', shiftId, file); await onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Uploaden is mislukt.'); }
    finally { setBusyId(''); }
  };
  const download = async (item: Attachment) => {
    const blob = await secureApi.downloadAttachment(item.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = item.filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="space-y-4">
    <div className="px-1"><h2 className="text-2xl font-bold text-zinc-900">Mijn planning</h2><p className="text-sm text-zinc-500 mt-1">Bekijk je diensten en klantopdrachten voor vandaag of de week.</p></div>
    <div className="grid grid-cols-2 gap-2 ops-panel p-1.5">
      <button type="button" onClick={() => setMode('today')} className={`py-3 rounded-lg font-bold text-sm ${mode === 'today' ? 'ops-nav-btn-active' : ''}`}>{t('today')}</button>
      <button type="button" onClick={() => setMode('week')} className={`py-3 rounded-lg font-bold text-sm ${mode === 'week' ? 'ops-nav-btn-active' : ''}`}>{'Week'}</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    {!visible.length && !visibleAssignments.length && (
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-500 space-y-3">
        <p>{mode === 'today'
          ? ((weekShifts.length + weekAssignments.length)
            ? `Niets vandaag. Wel ${weekShifts.length + weekAssignments.length} deze week — open Week.`
            : 'Geen diensten of opdrachten voor vandaag.')
          : 'Er staan deze week nog geen gepubliceerde diensten of opdrachten klaar.'}</p>
        {mode === 'today' && (weekShifts.length + weekAssignments.length) > 0 && (
          <button type="button" onClick={() => setMode('week')} className="ops-btn-primary px-5 text-sm">Bekijk weekplanning</button>
        )}
      </div>
    )}
    {visibleAssignments.length > 0 && (
      <div className="space-y-3">
        <div className="px-1 text-xs font-bold uppercase tracking-wide text-zinc-400 flex items-center gap-2"><ListTodo className="w-4 h-4" />Klantopdrachten</div>
        {visibleAssignments.map(item => (
          <article key={item.id} className="bg-white border border-zinc-200 rounded-[24px] p-5 shadow-sm space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide font-bold text-zinc-400">{formatDate(item.date)}{item.startTime ? ` · ${item.startTime}` : ''}</div>
                <h3 className="text-lg font-extrabold text-zinc-900 mt-1">{item.customerName || 'Klantopdracht'}</h3>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : item.status === 'arrived' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-800'}`}>
                {item.status === 'completed' ? 'Afgerond' : item.status === 'arrived' ? 'Ter plaatse' : 'Gepland'}
              </span>
            </div>
            {(item.siteAddress || item.customerAddress) && (
              <div className="flex items-start gap-2 text-sm text-zinc-600"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><span>{item.siteAddress || item.customerAddress}</span></div>
            )}
            {item.description && <p className="text-sm text-zinc-600 bg-zinc-50 rounded-xl p-3">{item.description}</p>}
          </article>
        ))}
      </div>
    )}
    {visible.length > 0 && <div className="px-1 text-xs font-bold uppercase tracking-wide text-zinc-400">Weekdiensten</div>}
    {visible.map(shift => {
      const confirmation = shift.confirmations[userId] || 'pending';
      return <article key={shift.id} className="bg-white border border-zinc-200 rounded-[24px] p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wide font-bold text-zinc-400">{formatDate(shift.date)}</div><h3 className="text-lg font-extrabold text-zinc-900 mt-1">{shift.title}</h3></div><span className={`text-xs font-bold px-3 py-1.5 rounded-full ${confirmation === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : confirmation === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{confirmation === 'confirmed' ? 'Bevestigd' : confirmation === 'declined' ? 'Geweigerd' : 'Antwoord nodig'}</span></div>
        <div className="grid grid-cols-2 gap-3 text-sm"><div className="bg-zinc-50 rounded-xl p-3"><span className="block text-xs text-zinc-400 font-bold uppercase mb-1">Uren</span><span className="font-bold">{shift.startTime}–{shift.endTime}</span></div><div className="bg-zinc-50 rounded-xl p-3"><span className="block text-xs text-zinc-400 font-bold uppercase mb-1">Pauze</span><span className="font-bold">{shift.breakMinutes} min.</span></div></div>
        {shift.customerName && <div className="flex items-start gap-2 text-sm text-zinc-600"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><div><div className="font-bold text-zinc-800">{shift.customerName}</div><div className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mt-1">Opdrachtadres</div><div>{shift.siteAddress || shift.customerAddress}</div>{shift.customerAddress && shift.siteAddress && shift.siteAddress !== shift.customerAddress && <div className="text-xs text-zinc-500 mt-1">Klantadres: {shift.customerAddress}</div>}{((shift.siteLatitude ?? shift.customerLatitude) !== undefined && (shift.siteLongitude ?? shift.customerLongitude) !== undefined) && <a className="text-zinc-900 underline font-semibold" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${shift.siteLatitude ?? shift.customerLatitude},${shift.siteLongitude ?? shift.customerLongitude}`}>Open locatie</a>}</div></div>}
        {shift.notes && <p className="text-sm text-zinc-600 bg-zinc-50 rounded-xl p-3">{shift.notes}</p>}
        {shift.checklist.length > 0 && <div className="border border-zinc-200 rounded-xl p-3 space-y-2"><div className="text-xs uppercase font-bold tracking-wide text-zinc-400 flex items-center gap-2"><ClipboardList className="w-4 h-4" />Checklist</div>{shift.checklist.map((task, index) => { const taskId=String(index); const done=(shift.checklistStates[userId] || []).includes(taskId); return <label key={taskId} className="flex items-start gap-3 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={done} disabled={busyId === shift.id} onChange={() => toggleTask(shift, taskId)} className="mt-0.5 w-4 h-4 accent-zinc-900" /><span className={done ? 'line-through text-zinc-400' : 'text-zinc-700'}>{task}</span></label>; })}</div>}
        <div className="border border-zinc-200 rounded-xl p-3 space-y-2"><div className="text-xs uppercase font-bold tracking-wide text-zinc-400">Foto’s en documenten</div>{attachments.filter(item => item.entityType === 'planned_shift' && item.entityId === shift.id).map(item => <button key={item.id} type="button" onClick={() => download(item)} className="w-full text-left flex items-center gap-2 text-sm font-semibold text-zinc-700 bg-zinc-50 rounded-lg p-2"><Download className="w-4 h-4" /><span className="truncate">{item.filename}</span></button>)}<label className="flex items-center justify-center gap-2 border border-dashed border-zinc-300 rounded-lg p-3 text-sm font-bold text-zinc-600 cursor-pointer"><Upload className="w-4 h-4" />Bestand toevoegen<input type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple className="hidden" onChange={event => upload(shift.id, event.target.files)} /></label></div>
        <div className="grid grid-cols-2 gap-3"><button disabled={busyId === shift.id} onClick={() => respond(shift.id, 'declined')} className="py-3 rounded-xl border border-red-200 text-red-700 font-bold flex items-center justify-center gap-2 disabled:opacity-40"><XCircle className="w-4 h-4" />Weigeren</button><button disabled={busyId === shift.id} onClick={() => respond(shift.id, 'confirmed')} className="py-3 rounded-xl bg-zinc-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">{busyId === shift.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Bevestigen</button></div>
      </article>;
    })}
  </div>;
}
