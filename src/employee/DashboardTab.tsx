import React, { useState, useEffect } from 'react';
import { Shift, ShiftBreak, Assignment, Attachment, PlannedShift, getCurrentLocation, formatTime, localDateKey, isGeoBlockedError, openDeviceLocationSettings, detectGeoPlatform, queryLocationPermission, iosLocationStepsCopy, androidLocationStepsCopy } from '../types';
import { MapPin, Play, Square, Navigation2, Loader2, Coffee, Settings } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';
import { useLanguage } from '../i18n';
import { AssignmentCard } from './AssignmentCard';

export function DashboardTab({ userId, shifts, breaks, assignments, plannedShifts, attachments, loading, onChanged }: { userId: string; shifts: Shift[]; breaks: ShiftBreak[]; assignments: Assignment[]; plannedShifts: PlannedShift[]; attachments: Attachment[]; loading: boolean; onChanged: () => Promise<void> }) {
  const { t } = useLanguage();
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showLocationHelp, setShowLocationHelp] = useState(false);
  const [geoPlatform] = useState(() => detectGeoPlatform());
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftStatus, setShiftStatus] = useState<'Normaal' | 'Vertraagd' | 'Gedeeltelijk afgerond' | 'Probleem gemeld'>('Normaal');
  const activeShift = shifts.find(s => !s.clockOut);
  const activeBreak = activeShift ? breaks.find(item => item.shiftId === activeShift.id && !item.endedAt) : undefined;
  const todaysPlanned = plannedShifts.filter(item => item.date === localDateKey() && item.confirmations[userId] !== 'declined');
  const [plannedShiftId, setPlannedShiftId] = useState('');
  const selectedPlannedShiftId = plannedShiftId || todaysPlanned[0]?.id || '';
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeShift?.notes && !shiftNotes) setShiftNotes(activeShift.notes);
      if (activeShift?.statusTag && shiftStatus === 'Normaal') setShiftStatus(activeShift.statusTag);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeShift, shiftNotes, shiftStatus]);
  const unacknowledgedAssignments = assignments.filter(a => a.status === 'pending' && a.acknowledged === false);
  const myAssignments = [...assignments].filter(a => a.acknowledged !== false).sort((a, b) => {
    const order = { pending: 1, arrived: 2, completed: 3 };
    return order[a.status] - order[b.status];
  });
  const openLocationBlockedUi = () => { setShowLocationHelp(true); setErrorMsg(''); };
  const requireLocationOrHelp = async () => {
    const permission = await queryLocationPermission();
    if (permission === 'denied' || permission === 'unsupported') { openLocationBlockedUi(); throw new Error('LOC_BLOCKED'); }
    try { return await getCurrentLocation(); }
    catch (err: unknown) {
      if (isGeoBlockedError(err)) { openLocationBlockedUi(); throw new Error('LOC_BLOCKED'); }
      throw err;
    }
  };
  const handleClockIn = async () => {
    setIsLocating(true); setErrorMsg('');
    try {
      const loc = await requireLocationOrHelp();
      const result = await secureApi.clockIn(loc, selectedPlannedShiftId || undefined);
      setShowLocationHelp(false);
      setErrorMsg(result.queued ? 'Inklokactie staat offline klaar en wordt automatisch verzonden.' : '');
      setShiftNotes(''); setShiftStatus('Normaal');
      await onChanged();
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message === 'LOC_BLOCKED')) {
        setErrorMsg(err instanceof Error ? err.message : 'Kon locatie niet ophalen. Zorg dat locatievoorzieningen aan staan.');
      }
    } finally { setIsLocating(false); }
  };
  const handleRetryLocation = async () => {
    setIsLocating(true); setErrorMsg('');
    try {
      await getCurrentLocation();
      setShowLocationHelp(false);
    } catch (err: unknown) {
      if (isGeoBlockedError(err)) { openLocationBlockedUi(); return; }
      setErrorMsg(err instanceof Error ? err.message : 'Kon locatie niet ophalen.');
      return;
    } finally { setIsLocating(false); }
    if (activeShift) await handleClockOut();
    else await handleClockIn();
  };
  const handleOpenSettings = () => { openDeviceLocationSettings(); };
  const handleClockOut = async () => {
    if (!activeShift) return;
    setIsLocating(true); setErrorMsg('');
    try {
      const loc = await requireLocationOrHelp();
      const result = await secureApi.queueClockOut({ location: loc, notes: shiftNotes, statusTag: shiftStatus });
      setShowLocationHelp(false);
      setErrorMsg(result.queued ? 'Uitklokactie staat offline klaar en wordt automatisch verzonden.' : '');
      await onChanged();
    } catch (err: unknown) {
      if (!(err instanceof Error && err.message === 'LOC_BLOCKED')) {
        setErrorMsg(err instanceof Error ? err.message : 'Kon locatie niet ophalen. Zorg dat locatievoorzieningen aan staan.');
      }
    } finally { setIsLocating(false); }
  };
  const toggleBreak = async () => {
    setIsLocating(true); setErrorMsg('');
    try { const result = activeBreak ? await secureApi.endBreak() : await secureApi.startBreak(); setErrorMsg(result.queued ? 'Pauzeactie staat offline klaar.' : ''); await onChanged(); }
    catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Pauze kon niet worden bijgewerkt.'); }
    finally { setIsLocating(false); }
  };
  const handleAcknowledge = async (assignmentId: string) => {
    try { await secureApi.acknowledgeAssignment(assignmentId); await onChanged(); }
    catch (err) { handleFirestoreError(err, OperationType.UPDATE, `assignments/${assignmentId}`); }
  };
  const handleAcknowledgeAll = async () => {
    try {
      await Promise.all(unacknowledgedAssignments.map(a => secureApi.acknowledgeAssignment(a.id)));
      await onChanged();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `assignments/batch-update`); }
  };
  const locationSteps = geoPlatform === 'ios' ? iosLocationStepsCopy() : geoPlatform === 'android' ? androidLocationStepsCopy() : 'Zet locatievoorzieningen aan in de instellingen van uw toestel en geef deze app toegang.';
  return (
    <div className="space-y-6">
      {errorMsg && (<div className="p-4 bg-red-50 text-red-700 rounded-[12px] border border-red-200 text-sm font-medium">{errorMsg}</div>)}
      {showLocationHelp && (
        <div className="ops-card border border-amber-200 bg-amber-50/80 p-5 space-y-4 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]" role="dialog" aria-labelledby="locatie-uit-title">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"><MapPin className="w-5 h-5" /></div>
            <div className="space-y-1.5 min-w-0">
              <h3 id="locatie-uit-title" className="text-lg font-bold text-zinc-900">Locatie staat uit</h3>
              <p className="text-sm text-zinc-700 font-medium">Om in te klokken moet locatie aan staan en toegang hebben. Zonder GPS kunnen we uw aanwezigheid niet registreren.</p>
              <p className="text-xs text-zinc-600 leading-relaxed pt-1"><span className="font-bold text-zinc-800">Stappen{geoPlatform === 'ios' ? ' (iPhone)' : geoPlatform === 'android' ? ' (Android)' : ''}:</span>{' '}{locationSteps}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={handleOpenSettings} className="ops-btn-primary w-full py-3.5 gap-2"><Settings className="w-4 h-4" />Open Instellingen</button>
            <button type="button" onClick={() => void handleRetryLocation()} disabled={isLocating} className="ops-btn-secondary w-full py-3.5 gap-2 disabled:opacity-50">{isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Opnieuw proberen</button>
          </div>
          {geoPlatform === 'ios' && (<p className="text-xs text-zinc-500">Op iPhone opent &quot;Open Instellingen&quot; indien mogelijk Instellingen. Lukt dat niet (Safari/PWA), volg dan handmatig: {iosLocationStepsCopy()}.</p>)}
        </div>
      )}
      {unacknowledgedAssignments.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-2xl shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-amber-800"><span className="flex h-6 w-6 bg-amber-500 text-white rounded-full items-center justify-center text-xs font-bold shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">{unacknowledgedAssignments.length}</span><span className="font-bold">Nieuwe opdrachten vereisen bevestiging</span></div>
            {unacknowledgedAssignments.length > 1 && (<button onClick={handleAcknowledgeAll} className="text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Markeer alles als gelezen</button>)}
          </div>
          <div className="space-y-3">{unacknowledgedAssignments.map(a => (<div key={a.id} className="ops-panel flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3"><div><div className="font-bold text-zinc-800">{a.customerName}</div><div className="text-sm text-zinc-500 line-clamp-1">{a.description}</div></div><button onClick={() => handleAcknowledge(a.id)} className="w-full sm:w-auto bg-amber-100 hover:bg-amber-200 text-amber-800 px-5 py-2.5 rounded-[12px] text-sm font-bold transition-colors shrink-0 flex justify-center">Bevestig Ontvangst</button></div>))}</div>
        </div>
      )}
      {todaysPlanned.length > 0 && <div className="ops-card p-5 space-y-3"><h2 className="font-bold text-zinc-900">Vandaag gepland</h2>{todaysPlanned.map(item => <div key={item.id} className="ops-panel p-3 flex justify-between gap-3"><div><div className="font-bold">{item.title}</div><div className="text-sm text-zinc-500">{item.startTime}–{item.endTime}{item.customerName ? ` · ${item.customerName}` : ''}</div></div>{item.customerLatitude !== undefined && item.customerLongitude !== undefined && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${item.customerLatitude},${item.customerLongitude}`} className="ops-btn-primary shrink-0 px-3 text-xs gap-1"><Navigation2 className="w-3.5 h-3.5" />Route</a>}</div>)}</div>}
      <div className="ops-card overflow-hidden">
        <div className="p-8 text-center space-y-6">
          <h2 className="text-xl font-bold text-zinc-800">{t('clockTitle')}</h2>
          {activeShift ? (
            <div className="space-y-6">
              <div className="ops-chip-success px-5 py-2.5"><div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" /><span>Ingeklokt sinds {formatTime(activeShift.clockIn)}</span></div>
              {(activeShift.clockInLoc?.accuracy ?? 0) > 0 && <div className="text-xs font-semibold text-zinc-500">GPS-nauwkeurigheid: ±{Math.round(activeShift.clockInLoc?.accuracy ?? 0)} m{activeShift.clockInDistance !== undefined ? ` · afstand locatie: ${Math.round(activeShift.clockInDistance)} m` : ''}</div>}
              <div className="ops-panel text-left space-y-4 p-5">
                <div><label className="block text-sm font-bold text-zinc-700 mb-1.5">Dienst Status</label><select value={shiftStatus} onChange={e => setShiftStatus(e.target.value as typeof shiftStatus)} className="ops-input w-full p-3 font-medium text-sm"><option value="Normaal">Normaal</option><option value="Vertraagd">Vertraagd</option><option value="Gedeeltelijk afgerond">Gedeeltelijk afgerond</option><option value="Probleem gemeld">Probleem gemeld</option></select></div>
                <div><label className="block text-sm font-bold text-zinc-700 mb-1.5">Opmerkingen (optioneel)</label><textarea value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} placeholder="Bijzonderheden over deze werkdag..." className="ops-input w-full p-3 font-medium resize-none h-20 text-sm" /></div>
              </div>
              <button onClick={toggleBreak} disabled={isLocating} className={`w-full gap-2 py-4 ${activeBreak ? 'ops-chip-warning' : 'ops-btn-secondary'}`}><Coffee className="w-5 h-5" />{activeBreak ? `Pauze beëindigen · sinds ${formatTime(activeBreak.startedAt)}` : 'Pauze starten'}</button>
              <button onClick={handleClockOut} disabled={isLocating} className="ops-btn-primary w-full space-x-3 py-5 text-lg">{isLocating ? <Loader2 className="animate-spin w-6 h-6" /> : <Square className="w-6 h-6" />}<span>{isLocating ? t('locating') : t('clockOut')}</span></button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-zinc-500 font-medium">{t('notClocked')}</p>
              {todaysPlanned.length > 0 && <select value={selectedPlannedShiftId} onChange={e => setPlannedShiftId(e.target.value)} className="ops-input w-full p-3 font-semibold text-sm"><option value="">{t('generalDay')}</option>{todaysPlanned.map(item => <option key={item.id} value={item.id}>{item.startTime} — {item.title}</option>)}</select>}
              <button onClick={handleClockIn} disabled={isLocating} className="ops-btn-primary w-full space-x-3 py-5 text-lg">{isLocating ? <Loader2 className="animate-spin w-6 h-6" /> : <Play className="w-6 h-6" />}<span>{isLocating ? t('locating') : t('startDay')}</span></button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-zinc-800 px-2 pt-4">{t('myPlanningToday')}</h2>
        {myAssignments.length === 0 ? (<div className="ops-panel border-2 border-dashed p-10 text-center font-medium">{t('noJobsToday')}</div>) : (<div className="space-y-4">{myAssignments.map(assignment => (<AssignmentCard key={assignment.id} assignment={assignment} attachments={attachments.filter(item => item.entityType === 'assignment' && item.entityId === assignment.id)} onChanged={onChanged} />))}</div>)}
      </div>
    </div>
  );
}
