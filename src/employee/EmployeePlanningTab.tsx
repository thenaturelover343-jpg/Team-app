import React, { useState } from 'react';
import { PlannedShift, Attachment, formatDate, localDateKey } from '../types';
import { MapPin, ClipboardList, Download, Upload, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../i18n';
import { secureApi } from '../lib/secureApi';

export function EmployeePlanningTab({ userId, shifts, attachments, onChanged }: { userId: string; shifts: PlannedShift[]; attachments: Attachment[]; onChanged: () => Promise<void> }) {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'today' | 'week'>('today');
  const today = localDateKey();
  const upcoming = [...shifts].filter(shift => shift.date >= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const visible = mode === 'today' ? upcoming.filter(shift => shift.date === today) : upcoming;
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
    <div className="px-1"><h2 className="text-2xl font-bold text-zinc-900">Mijn planning</h2><p className="text-sm text-zinc-500 mt-1">Bekijk je diensten en route voor vandaag of de week.</p></div>
    <div className="grid grid-cols-2 gap-2 ops-panel p-1.5">
      <button type="button" onClick={() => setMode('today')} className={`py-3 rounded-lg font-bold text-sm ${mode === 'today' ? 'ops-nav-btn-active' : ''}`}>{t('today')}</button>
      <button type="button" onClick={() => setMode('week')} className={`py-3 rounded-lg font-bold text-sm ${mode === 'week' ? 'ops-nav-btn-active' : ''}`}>{'Week'}</button>
    </div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    {!visible.length && <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-500">{mode === 'today' ? 'Geen diensten gepland voor vandaag.' : 'Er staan nog geen gepubliceerde diensten klaar.'}</div>}
    {visible.map(shift => {
      const confirmation = shift.confirmations[userId] || 'pending';
      return <article key={shift.id} className="bg-white border border-zinc-200 rounded-[24px] p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wide font-bold text-zinc-400">{formatDate(shift.date)}</div><h3 className="text-lg font-extrabold text-zinc-900 mt-1">{shift.title}</h3></div><span className={`text-xs font-bold px-3 py-1.5 rounded-full ${confirmation === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : confirmation === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{confirmation === 'confirmed' ? 'Bevestigd' : confirmation === 'declined' ? 'Geweigerd' : 'Antwoord nodig'}</span></div>
      </article>;
    })}
  </div>;
}
