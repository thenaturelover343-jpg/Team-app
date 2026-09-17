import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { User, Shift, ShiftBreak, Assignment, Attachment, CorrectionRequest, Incident, PlannedShift, PushState, TeamNotification, WeeklyAvailability, getCurrentLocation, formatTime, formatDate, AssignmentTask, localDateKey } from './types';
import { MapPin, Clock, CheckCircle, Play, Square, Navigation2, FileText, Loader2, User as UserIcon, Calendar, History, Save, Plus, Trash2, CheckSquare, CalendarDays, XCircle, AlertTriangle, ClipboardList, WifiOff, Coffee, Upload, Download, Bell } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { handleFirestoreError, OperationType } from './lib/firebase';
import { secureApi } from './lib/secureApi';
import { readOfflineQueue } from './lib/offlineQueue';
import NotificationCenter from './components/NotificationCenter';

const LiveLocationMap = dynamic(() => import('./components/LiveLocationMap'), { ssr: false });

export default function EmployeeView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planning' | 'reports' | 'notifications' | 'profile'>('dashboard');

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [plannedShifts, setPlannedShifts] = useState<PlannedShift[]>([]);
  const [breaks, setBreaks] = useState<ShiftBreak[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [notifications, setNotifications] = useState<TeamNotification[]>([]);
  const [push, setPush] = useState<PushState>({ supported: false, enabled: false, publicKey: '' });
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadData = React.useCallback(async () => {
    const { data } = await secureApi.snapshot();
    setShifts(data.shifts);
    setAssignments(data.assignments.filter(item => item.date === localDateKey()));
    setPlannedShifts(data.plannedShifts);
    setBreaks(data.breaks);
    setAttachments(data.attachments);
    setIncidents(data.incidents);
    setCorrectionRequests(data.correctionRequests);
    setNotifications(data.notifications);
    setPush(data.push);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      try { if (active) await loadData(); }
      catch (error) { console.error(error); if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user, loadData]);

  useEffect(() => {
    const updateCount = () => setQueueCount(readOfflineQueue().length);
    const sync = async () => {
      if (!navigator.onLine) return updateCount();
      await secureApi.flushOfflineQueue();
      updateCount();
      await loadData().catch(() => undefined);
    };
    updateCount();
    void sync();
    window.addEventListener('online', sync);
    window.addEventListener('barlicious-queue-change', updateCount);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('barlicious-queue-change', updateCount); };
  }, [loadData]);

  if (!user) return null;

  const unacknowledgedCount = assignments.filter(a => a.status === 'pending' && a.acknowledged === false).length;

  return (
    <div className="max-w-lg mx-auto w-full space-y-6 pb-28">
      {queueCount > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm font-semibold text-amber-800 flex items-center gap-2"><WifiOff className="w-4 h-4" />{queueCount} actie{queueCount === 1 ? '' : 's'} wachten op internet.</div>}
      <div className="fixed bottom-3 left-3 right-3 z-50 max-w-lg mx-auto bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-zinc-200 p-1.5 grid grid-cols-5 gap-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-3 px-1 rounded-[12px] font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all relative ${activeTab === 'dashboard' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600'}`}
        >
          <Calendar className="w-4 h-4" />
          <span>Vandaag</span>
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] ring-2 ring-white animate-bounce">
              {unacknowledgedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`py-3 px-1 rounded-[12px] font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'planning' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600'}`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Planning</span>
        </button>
        <button onClick={() => setActiveTab('reports')} className={`py-3 px-1 rounded-[12px] font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'reports' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600'}`}><AlertTriangle className="w-4 h-4" /><span>Melden</span></button>
        <button onClick={() => setActiveTab('notifications')} className={`py-3 px-1 rounded-[12px] font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all relative ${activeTab === 'notifications' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600'}`}><Bell className="w-4 h-4" /><span>Berichten</span>{notifications.some(item => !item.readAt) && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />}</button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-3 px-1 rounded-[12px] font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'profile' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600'}`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Mijn Profiel</span>
        </button>
      </div>

      {activeTab === 'dashboard' && <DashboardTab userId={user.id} shifts={shifts} breaks={breaks} assignments={assignments} plannedShifts={plannedShifts} loading={loading} onChanged={loadData} />}
      {activeTab === 'planning' && <EmployeePlanningTab userId={user.id} shifts={plannedShifts} attachments={attachments} onChanged={loadData} />}
      {activeTab === 'reports' && <ReportsTab shifts={shifts} plannedShifts={plannedShifts} incidents={incidents} corrections={correctionRequests} onChanged={loadData} />}
      {activeTab === 'notifications' && <NotificationCenter notifications={notifications} push={push} onChanged={loadData} />}
      {activeTab === 'profile' && <ProfileTab user={user} />}
    </div>
  );
}

function DashboardTab({ userId, shifts, breaks, assignments, plannedShifts, loading, onChanged }: { userId: string; shifts: Shift[]; breaks: ShiftBreak[]; assignments: Assignment[]; plannedShifts: PlannedShift[]; loading: boolean; onChanged: () => Promise<void> }) {
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftStatus, setShiftStatus] = useState<'Normaal' | 'Vertraagd' | 'Gedeeltelijk afgerond' | 'Probleem gemeld'>('Normaal');

  const activeShift = shifts.find(s => !s.clockOut);
  const activeBreak = activeShift ? breaks.find(item => item.shiftId === activeShift.id && !item.endedAt) : undefined;
  const todaysPlanned = plannedShifts.filter(item => item.date === localDateKey() && item.confirmations[userId] !== 'declined');
  const [plannedShiftId, setPlannedShiftId] = useState('');
  const selectedPlannedShiftId = plannedShiftId || todaysPlanned[0]?.id || '';

  // Sync state if active shift already has notes (though usually set at clock out)
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

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-900" /></div>;
  }

  const handleClockIn = async () => {
    setIsLocating(true);
    setErrorMsg('');
    try {
      const loc = await getCurrentLocation();
      const result = await secureApi.clockIn(loc, selectedPlannedShiftId || undefined);
      setErrorMsg(result.queued ? 'Inklokactie staat offline klaar en wordt automatisch verzonden.' : '');
      setShiftNotes('');
      setShiftStatus('Normaal');
      await onChanged();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kon locatie niet ophalen. Zorg dat locatievoorzieningen aan staan.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeShift) return;
    setIsLocating(true);
    setErrorMsg('');
    try {
      const loc = await getCurrentLocation();
      const result = await secureApi.queueClockOut({
        location: loc,
        notes: shiftNotes,
        statusTag: shiftStatus
      });
      setErrorMsg(result.queued ? 'Uitklokactie staat offline klaar en wordt automatisch verzonden.' : '');
      await onChanged();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kon locatie niet ophalen. Zorg dat locatievoorzieningen aan staan.');
    } finally {
      setIsLocating(false);
    }
  };

  const toggleBreak = async () => {
    setIsLocating(true); setErrorMsg('');
    try { const result = activeBreak ? await secureApi.endBreak() : await secureApi.startBreak(); setErrorMsg(result.queued ? 'Pauzeactie staat offline klaar.' : ''); await onChanged(); }
    catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Pauze kon niet worden bijgewerkt.'); }
    finally { setIsLocating(false); }
  };

  const handleAcknowledge = async (assignmentId: string) => {
    try {
      await secureApi.acknowledgeAssignment(assignmentId);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assignments/${assignmentId}`);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      const promises = unacknowledgedAssignments.map(a => 
        secureApi.acknowledgeAssignment(a.id)
      );
      await Promise.all(promises);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assignments/batch-update`);
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 rounded-[12px] border border-red-200 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {unacknowledgedAssignments.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-2xl shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-amber-800">
              <span className="flex h-6 w-6 bg-amber-500 text-white rounded-full items-center justify-center text-xs font-bold shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
                {unacknowledgedAssignments.length}
              </span>
              <span className="font-bold">Nieuwe opdrachten vereisen bevestiging</span>
            </div>
            {unacknowledgedAssignments.length > 1 && (
              <button 
                onClick={handleAcknowledgeAll}
                className="text-xs font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Markeer alles als gelezen
              </button>
            )}
          </div>
          <div className="space-y-3">
            {unacknowledgedAssignments.map(a => (
               <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-[12px] border border-amber-100 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] gap-3">
                  <div>
                    <div className="font-bold text-zinc-800">{a.customerName}</div>
                    <div className="text-sm text-zinc-500 line-clamp-1">{a.description}</div>
                  </div>
                  <button 
                    onClick={() => handleAcknowledge(a.id)}
                    className="w-full sm:w-auto bg-amber-100 hover:bg-amber-200 text-amber-800 px-5 py-2.5 rounded-[12px] text-sm font-bold transition-colors shrink-0 flex justify-center"
                  >
                     Bevestig Ontvangst
                  </button>
               </div>
            ))}
          </div>
        </div>
      )}

      {todaysPlanned.length > 0 && <div className="bg-white rounded-[24px] border border-zinc-200 p-5 space-y-3">
        <h2 className="font-bold text-zinc-900">Vandaag gepland</h2>
        {todaysPlanned.map(item => <div key={item.id} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex justify-between gap-3"><div><div className="font-bold">{item.title}</div><div className="text-sm text-zinc-500">{item.startTime}–{item.endTime}{item.customerName ? ` · ${item.customerName}` : ''}</div></div>{item.customerLatitude !== undefined && item.customerLongitude !== undefined && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${item.customerLatitude},${item.customerLongitude}`} className="shrink-0 bg-zinc-900 text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1"><Navigation2 className="w-3.5 h-3.5" />Route</a>}</div>)}
      </div>}

      {/* Time Tracking Card */}
      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
        <div className="p-8 text-center space-y-6">
          <h2 className="text-xl font-bold text-zinc-800">Urenregistratie</h2>
          
          {activeShift ? (
            <div className="space-y-6">
              <div className="inline-flex items-center justify-center space-x-2 bg-green-50 text-green-700 px-5 py-2.5 rounded-full font-semibold border border-green-200/50">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                <span>Ingeklokt sinds {formatTime(activeShift.clockIn)}</span>
              </div>
              {activeShift.clockInLoc?.accuracy > 0 && <div className="text-xs font-semibold text-zinc-500">GPS-nauwkeurigheid: ±{Math.round(activeShift.clockInLoc.accuracy)} m{activeShift.clockInDistance !== undefined ? ` · afstand locatie: ${Math.round(activeShift.clockInDistance)} m` : ''}</div>}
              
              <div className="text-left space-y-4 bg-[#FAFAFA] p-5 rounded-[24px] border border-zinc-200">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Dienst Status</label>
                  <select 
                    value={shiftStatus} 
                    onChange={e => setShiftStatus(e.target.value as typeof shiftStatus)}
                    className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm"
                  >
                    <option value="Normaal">Normaal</option>
                    <option value="Vertraagd">Vertraagd</option>
                    <option value="Gedeeltelijk afgerond">Gedeeltelijk afgerond</option>
                    <option value="Probleem gemeld">Probleem gemeld</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Opmerkingen (optioneel)</label>
                  <textarea 
                    value={shiftNotes} 
                    onChange={e => setShiftNotes(e.target.value)}
                    placeholder="Bijzonderheden over deze werkdag..."
                    className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium resize-none h-20 text-sm"
                  />
                </div>
              </div>

              <button onClick={toggleBreak} disabled={isLocating} className={`w-full flex items-center justify-center gap-2 py-4 rounded-[18px] font-bold border ${activeBreak ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-zinc-300 text-zinc-800'}`}><Coffee className="w-5 h-5" />{activeBreak ? `Pauze beëindigen · sinds ${formatTime(activeBreak.startedAt)}` : 'Pauze starten'}</button>

              <button
                onClick={handleClockOut}
                disabled={isLocating}
                className="w-full flex items-center justify-center space-x-3 bg-zinc-900 hover:bg-zinc-800 text-white py-5 rounded-[24px] font-bold text-lg transition-colors disabled:opacity-50 shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)]"
              >
                {isLocating ? <Loader2 className="animate-spin w-6 h-6" /> : <Square className="w-6 h-6" />}
                <span>{isLocating ? 'Locatie zoeken...' : 'Uitklokken'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-zinc-500 font-medium">Je bent momenteel niet ingeklokt.</p>
              {todaysPlanned.length > 0 && <select value={selectedPlannedShiftId} onChange={e => setPlannedShiftId(e.target.value)} className="w-full border border-zinc-200 rounded-xl p-3 bg-white font-semibold text-sm"><option value="">Algemene werkdag</option>{todaysPlanned.map(item => <option key={item.id} value={item.id}>{item.startTime} — {item.title}</option>)}</select>}
              <button
                onClick={handleClockIn}
                disabled={isLocating}
                className="w-full flex items-center justify-center space-x-3 bg-zinc-900 hover:bg-zinc-900 text-white py-5 rounded-[24px] font-bold text-lg transition-colors disabled:opacity-50 shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)]"
              >
                {isLocating ? <Loader2 className="animate-spin w-6 h-6" /> : <Play className="w-6 h-6" />}
                <span>{isLocating ? 'Locatie zoeken...' : 'Start Werkdag (Inklokken)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Assignments Card */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-zinc-800 px-2 pt-4">Mijn Planning Vandaag</h2>
        
        {myAssignments.length === 0 ? (
          <div className="bg-zinc-100/50/50 border-2 border-dashed border-zinc-200/60 rounded-[24px] p-10 text-center text-zinc-500 font-medium">
            Je hebt nog geen opdrachten voor vandaag.
          </div>
        ) : (
          <div className="space-y-4">
            {myAssignments.map(assignment => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeePlanningTab({ userId, shifts, attachments, onChanged }: { userId: string; shifts: PlannedShift[]; attachments: Attachment[]; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const upcoming = [...shifts].filter(shift => shift.date >= localDateKey()).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
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
    <div className="px-1"><h2 className="text-2xl font-bold text-zinc-900">Weekoverzicht</h2><p className="text-sm text-zinc-500 mt-1">Diensten, route, checklist en documenten.</p></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    {!upcoming.length && <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-500">Er staan nog geen gepubliceerde diensten klaar.</div>}
    {upcoming.map(shift => {
      const confirmation = shift.confirmations[userId] || 'pending';
      return <article key={shift.id} className="bg-white border border-zinc-200 rounded-[24px] p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs uppercase tracking-wide font-bold text-zinc-400">{formatDate(shift.date)}</div><h3 className="text-lg font-extrabold text-zinc-900 mt-1">{shift.title}</h3></div><span className={`text-xs font-bold px-3 py-1.5 rounded-full ${confirmation === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : confirmation === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{confirmation === 'confirmed' ? 'Bevestigd' : confirmation === 'declined' ? 'Geweigerd' : 'Antwoord nodig'}</span></div>
        <div className="grid grid-cols-2 gap-3 text-sm"><div className="bg-zinc-50 rounded-xl p-3"><span className="block text-xs text-zinc-400 font-bold uppercase mb-1">Uren</span><span className="font-bold">{shift.startTime}–{shift.endTime}</span></div><div className="bg-zinc-50 rounded-xl p-3"><span className="block text-xs text-zinc-400 font-bold uppercase mb-1">Pauze</span><span className="font-bold">{shift.breakMinutes} min.</span></div></div>
        {shift.customerName && <div className="flex items-start gap-2 text-sm text-zinc-600"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><div><div className="font-bold text-zinc-800">{shift.customerName}</div><div>{shift.customerAddress}</div>{shift.customerLatitude !== undefined && shift.customerLongitude !== undefined && <a className="text-zinc-900 underline font-semibold" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${shift.customerLatitude},${shift.customerLongitude}`}>Open locatie</a>}</div></div>}
        {shift.notes && <p className="text-sm text-zinc-600 bg-zinc-50 rounded-xl p-3">{shift.notes}</p>}
        {shift.checklist.length > 0 && <div className="border border-zinc-200 rounded-xl p-3 space-y-2"><div className="text-xs uppercase font-bold tracking-wide text-zinc-400 flex items-center gap-2"><ClipboardList className="w-4 h-4" />Checklist</div>{shift.checklist.map((task, index) => { const taskId=String(index); const done=(shift.checklistStates[userId] || []).includes(taskId); return <label key={taskId} className="flex items-start gap-3 text-sm font-semibold cursor-pointer"><input type="checkbox" checked={done} disabled={busyId === shift.id} onChange={() => toggleTask(shift, taskId)} className="mt-0.5 w-4 h-4 accent-zinc-900" /><span className={done ? 'line-through text-zinc-400' : 'text-zinc-700'}>{task}</span></label>; })}</div>}
        <div className="border border-zinc-200 rounded-xl p-3 space-y-2"><div className="text-xs uppercase font-bold tracking-wide text-zinc-400">Foto’s en documenten</div>{attachments.filter(item => item.entityType === 'planned_shift' && item.entityId === shift.id).map(item => <button key={item.id} type="button" onClick={() => download(item)} className="w-full text-left flex items-center gap-2 text-sm font-semibold text-zinc-700 bg-zinc-50 rounded-lg p-2"><Download className="w-4 h-4" /><span className="truncate">{item.filename}</span></button>)}<label className="flex items-center justify-center gap-2 border border-dashed border-zinc-300 rounded-lg p-3 text-sm font-bold text-zinc-600 cursor-pointer"><Upload className="w-4 h-4" />Bestand toevoegen<input type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple className="hidden" onChange={event => upload(shift.id, event.target.files)} /></label></div>
        <div className="grid grid-cols-2 gap-3"><button disabled={busyId === shift.id} onClick={() => respond(shift.id, 'declined')} className="py-3 rounded-xl border border-red-200 text-red-700 font-bold flex items-center justify-center gap-2 disabled:opacity-40"><XCircle className="w-4 h-4" />Weigeren</button><button disabled={busyId === shift.id} onClick={() => respond(shift.id, 'confirmed')} className="py-3 rounded-xl bg-zinc-900 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">{busyId === shift.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}Bevestigen</button></div>
      </article>;
    })}
  </div>;
}

function ReportsTab({ shifts, plannedShifts, incidents, corrections, onChanged }: { shifts: Shift[]; plannedShifts: PlannedShift[]; incidents: Incident[]; corrections: CorrectionRequest[]; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<'incident' | 'correction'>('incident');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Schade');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [description, setDescription] = useState('');
  const [plannedShiftId, setPlannedShiftId] = useState('');
  const [incidentFiles, setIncidentFiles] = useState<File[]>([]);
  const [shiftId, setShiftId] = useState('');
  const [requestedClockIn, setRequestedClockIn] = useState('');
  const [requestedClockOut, setRequestedClockOut] = useState('');
  const [reason, setReason] = useState('');

  const submitIncident = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      let incidentLocation;
      try { incidentLocation = await getCurrentLocation(); } catch { incidentLocation = undefined; }
      const { data } = await secureApi.createIncident({ plannedShiftId: plannedShiftId || undefined, category, severity, description, location: incidentLocation, occurredAt: Date.now() });
      for (const file of incidentFiles.slice(0, 5)) await secureApi.uploadAttachment('incident', data.id, file);
      setDescription(''); setIncidentFiles([]); setMessage('Incident is veilig gemeld.'); await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Incident melden is mislukt.'); }
    finally { setBusy(false); }
  };

  const submitCorrection = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const result = await secureApi.createCorrectionRequest({ shiftId, requestedClockIn: requestedClockIn ? new Date(requestedClockIn).getTime() : undefined, requestedClockOut: requestedClockOut ? new Date(requestedClockOut).getTime() : undefined, reason });
      setReason(''); setRequestedClockIn(''); setRequestedClockOut(''); setMessage(result.queued ? 'Correctieverzoek staat offline klaar.' : 'Correctieverzoek is ingediend.'); await onChanged().catch(() => undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Correctieverzoek is mislukt.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold text-zinc-900">Melden</h2><p className="text-sm text-zinc-500 mt-1">Leg incidenten vast of vraag een tijdscorrectie aan.</p></div>
    <div className="grid grid-cols-2 gap-2 bg-white border border-zinc-200 rounded-xl p-1.5"><button onClick={() => setMode('incident')} className={`py-3 rounded-lg font-bold text-sm ${mode === 'incident' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}>Incident</button><button onClick={() => setMode('correction')} className={`py-3 rounded-lg font-bold text-sm ${mode === 'correction' ? 'bg-zinc-900 text-white' : 'text-zinc-600'}`}>Tijdcorrectie</button></div>
    {message && <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-3 text-sm font-semibold text-zinc-700">{message}</div>}
    {mode === 'incident' ? <form onSubmit={submitIncident} className="bg-white border border-zinc-200 rounded-[24px] p-5 space-y-4">
      <label className="block text-sm font-bold">Geplande dienst<select value={plannedShiftId} onChange={e => setPlannedShiftId(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3 bg-white"><option value="">Niet gekoppeld</option>{plannedShifts.map(item => <option key={item.id} value={item.id}>{item.date} · {item.title}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">Categorie<select value={category} onChange={e => setCategory(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3 bg-white"><option>Schade</option><option>Ongeval</option><option>Veiligheid</option><option>Klantmelding</option><option>Overig</option></select></label><label className="text-sm font-bold">Ernst<select value={severity} onChange={e => setSeverity(e.target.value as typeof severity)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3 bg-white"><option value="low">Laag</option><option value="medium">Middel</option><option value="high">Hoog</option></select></label></div>
      <label className="block text-sm font-bold">Wat is er gebeurd?<textarea required value={description} onChange={e => setDescription(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3 h-32 resize-none" /></label>
      <label className="flex items-center justify-center gap-2 border border-dashed border-zinc-300 rounded-xl p-4 text-sm font-bold text-zinc-600 cursor-pointer"><Upload className="w-4 h-4" />Foto’s of documenten ({incidentFiles.length})<input type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple className="hidden" onChange={e => setIncidentFiles(Array.from(e.target.files || []).slice(0, 5))} /></label>
      <button disabled={busy} className="w-full bg-red-600 text-white rounded-xl py-4 font-bold flex justify-center gap-2">{busy && <Loader2 className="w-5 h-5 animate-spin" />}Incident melden</button>
    </form> : <form onSubmit={submitCorrection} className="bg-white border border-zinc-200 rounded-[24px] p-5 space-y-4">
      <label className="block text-sm font-bold">Tijdregistratie<select required value={shiftId} onChange={e => setShiftId(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3 bg-white"><option value="">Selecteer...</option>{shifts.slice(0, 30).map(item => <option key={item.id} value={item.id}>{formatDate(item.clockIn)} · {formatTime(item.clockIn)}{item.clockOut ? `–${formatTime(item.clockOut)}` : ' · actief'}</option>)}</select></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm font-bold">Nieuwe starttijd<input type="datetime-local" value={requestedClockIn} onChange={e => setRequestedClockIn(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3" /></label><label className="text-sm font-bold">Nieuwe eindtijd<input type="datetime-local" value={requestedClockOut} onChange={e => setRequestedClockOut(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3" /></label></div>
      <label className="block text-sm font-bold">Reden<textarea required value={reason} onChange={e => setReason(e.target.value)} className="mt-1.5 w-full border border-zinc-200 rounded-xl p-3 h-28 resize-none" /></label>
      <button disabled={busy} className="w-full bg-zinc-900 text-white rounded-xl py-4 font-bold">Correctie aanvragen</button>
    </form>}
    <div className="space-y-2"><h3 className="font-bold text-zinc-800">Mijn recente meldingen</h3>{incidents.slice(0, 5).map(item => <div key={item.id} className="bg-white border border-zinc-200 rounded-xl p-3 text-sm"><div className="font-bold">{item.category} · {item.severity === 'high' ? 'hoog' : item.severity === 'medium' ? 'middel' : 'laag'}</div><div className="text-zinc-500 line-clamp-2">{item.description}</div></div>)}{corrections.slice(0, 5).map(item => <div key={item.id} className="bg-white border border-zinc-200 rounded-xl p-3 text-sm flex justify-between gap-2"><span className="font-semibold">Tijdcorrectie · {formatDate(item.createdAt)}</span><span className="font-bold capitalize">{item.status}</span></div>)}</div>
  </div>;
}

function ProfileTab({ user }: { user: User }) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [availability, setAvailability] = useState(user.availability || '');
  const [availabilitySchedule, setAvailabilitySchedule] = useState<WeeklyAvailability>(() => user.availabilitySchedule || {
    '0': { enabled: false, start: '09:00', end: '17:00' },
    '1': { enabled: true, start: '09:00', end: '17:00' },
    '2': { enabled: true, start: '09:00', end: '17:00' },
    '3': { enabled: true, start: '09:00', end: '17:00' },
    '4': { enabled: true, start: '09:00', end: '17:00' },
    '5': { enabled: true, start: '09:00', end: '17:00' },
    '6': { enabled: false, start: '09:00', end: '17:00' },
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [historyAssignments, setHistoryAssignments] = useState<Assignment[]>([]);
  const [historyShifts, setHistoryShifts] = useState<Shift[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await secureApi.snapshot();
        if (!active) return;
        setHistoryAssignments(data.assignments.filter(item => item.status === 'completed'));
        setHistoryShifts(data.shifts);
        setLoadingHistory(false);
      } catch (error) {
        console.error(error);
        if (active) setLoadingHistory(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMsg({ text: '', type: '' });
    try {
      await secureApi.updateProfile({ name, phone, availability, availabilitySchedule });
      setMsg({ text: 'Profiel succesvol bijgewerkt!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMsg({ text: 'Er is een fout opgetreden bij het opslaan.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
        <div className="p-8 space-y-6">
          <h2 className="text-xl font-bold text-zinc-800">Persoonlijke Gegevens</h2>
          
          {msg.text && (
            <div className={`p-4 rounded-[12px] text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Volledige Naam</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Telefoonnummer</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="04xx xx xx xx" className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Mijn Beschikbaarheid</label>
              <textarea value={availability} onChange={e => setAvailability(e.target.value)} placeholder="Bijv. Ma-Vr beschikbaar, in het weekend in overleg..." rows={3} className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium resize-none"></textarea>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-zinc-700">Vaste weekuren voor conflictcontrole</div>
              {[['1','Ma'],['2','Di'],['3','Wo'],['4','Do'],['5','Vr'],['6','Za'],['0','Zo']].map(([key, label]) => {
                const day = availabilitySchedule[key] || { enabled: false, start: '09:00', end: '17:00' };
                return <div key={key} className="grid grid-cols-[48px_1fr_1fr] gap-2 items-center bg-zinc-50 border border-zinc-200 rounded-xl p-2.5">
                  <label className="font-bold text-sm flex items-center gap-2"><input type="checkbox" checked={day.enabled} onChange={e => setAvailabilitySchedule(current => ({ ...current, [key]: { ...day, enabled: e.target.checked } }))} className="accent-zinc-900" />{label}</label>
                  <input aria-label={`Start ${label}`} type="time" disabled={!day.enabled} value={day.start} onChange={e => setAvailabilitySchedule(current => ({ ...current, [key]: { ...day, start: e.target.value } }))} className="border border-zinc-200 rounded-lg p-2 text-sm disabled:opacity-40" />
                  <input aria-label={`Einde ${label}`} type="time" disabled={!day.enabled} value={day.end} onChange={e => setAvailabilitySchedule(current => ({ ...current, [key]: { ...day, end: e.target.value } }))} className="border border-zinc-200 rounded-lg p-2 text-sm disabled:opacity-40" />
                </div>;
              })}
            </div>
            <button type="submit" disabled={isUpdating} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 rounded-[24px] flex items-center justify-center space-x-2 transition-all shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] disabled:opacity-50">
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              <span>Gegevens Opslaan</span>
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
        <div className="p-8 space-y-6">
           <div className="flex items-center space-x-2">
             <History className="w-6 h-6 text-zinc-400" />
             <h2 className="text-xl font-bold text-zinc-800">Mijn Historiek</h2>
           </div>

           {loadingHistory ? (
             <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-zinc-900" /></div>
           ) : (
             <div className="space-y-5">
               {historyShifts.filter(s => s.clockOut).length === 0 ? (
                 <p className="text-sm text-zinc-500">Geen voltooide shifts gevonden.</p>
               ) : (
                 historyShifts.filter(s => s.clockOut).sort((a,b) => b.clockIn - a.clockIn).map(shift => {
                   const durationMs = shift.clockOut! - shift.clockIn;
                   const hours = Math.floor(durationMs / (1000 * 60 * 60));
                   const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                   
                   const shiftDateObj = new Date(shift.clockIn);
                   const shiftDateStr = shiftDateObj.getFullYear() + '-' + String(shiftDateObj.getMonth()+1).padStart(2, '0') + '-' + String(shiftDateObj.getDate()).padStart(2, '0');
                   const shiftAssignments = historyAssignments.filter(a => a.date === shiftDateStr);

                   return (
                     <div key={shift.id} className="bg-[#FAFAFA] p-5 rounded-[24px] border border-zinc-200/60">
                       <div className="flex justify-between items-start mb-4">
                         <div>
                           <div className="font-bold text-zinc-900 text-lg mb-1">{formatDate(shift.clockIn)}</div>
                           <div className="flex items-center space-x-2 text-sm text-zinc-600 font-medium">
                             <Clock className="w-4 h-4 text-zinc-400" />
                             <span>{formatTime(shift.clockIn)} - {formatTime(shift.clockOut!)}</span>
                             <span className="text-zinc-500">•</span>
                             <span className="text-zinc-900 font-bold">{hours}u {minutes}m gewerkt</span>
                           </div>
                         </div>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                          <div className="bg-white p-3 rounded-[12px] border border-zinc-200 flex items-start space-x-3 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
                            <div className="mt-0.5"><MapPin className="w-4 h-4 text-green-500" /></div>
                            <div>
                              <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Ingeklokt Geocatie</span>
                              <div className="text-sm font-medium text-zinc-700 truncate">
                                 {shift.clockInLoc?.lat ? `${shift.clockInLoc.lat.toFixed(5)}, ${shift.clockInLoc.lng.toFixed(5)}` : 'Locatie niet beschikbaar'}
                              </div>
                              <div className="text-xs text-zinc-500 mt-0.5 font-medium">@ {formatTime(shift.clockIn)}</div>
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-[12px] border border-zinc-200 flex items-start space-x-3 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
                            <div className="mt-0.5"><MapPin className="w-4 h-4 text-amber-500" /></div>
                            <div>
                              <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Uitgeklokt Geolocatie</span>
                              <div className="text-sm font-medium text-zinc-700 truncate">
                                 {shift.clockOutLoc?.lat ? `${shift.clockOutLoc.lat.toFixed(5)}, ${shift.clockOutLoc.lng.toFixed(5)}` : 'Locatie niet beschikbaar'}
                              </div>
                              <div className="text-xs text-zinc-500 mt-0.5 font-medium">@ {formatTime(shift.clockOut!)}</div>
                            </div>
                          </div>
                       </div>

                       <div className="space-y-3">
                         <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-200/60 pb-2">
                            <CheckSquare className="w-4 h-4" />
                            <span>Afgeronde Opdrachten & Taken</span>
                         </span>
                         {shiftAssignments.length > 0 ? (
                           shiftAssignments.map(assignment => {
                              const tasksTotal = assignment.tasks?.length || 0;
                              const tasksDone = assignment.tasks?.filter(t => t.completed).length || 0;
                              
                              return (
                                <div key={assignment.id} className="bg-white p-4 rounded-[12px] border border-zinc-200 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
                                   <div className="flex justify-between items-start mb-2">
                                      <span className="font-bold text-zinc-800">{assignment.customerName || 'Onbekende Klant'}</span>
                                      {tasksTotal > 0 ? (
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tasksDone === tasksTotal ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                          {tasksDone}/{tasksTotal} taken
                                        </span>
                                      ) : (
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100/50 text-zinc-600">Geen taken</span>
                                      )}
                                   </div>
                                   {assignment.tasks && assignment.tasks.length > 0 && (
                                      <ul className="space-y-1.5 mt-3 pt-3 border-t border-zinc-200">
                                        {assignment.tasks.map(t => (
                                          <li key={t.id} className="flex items-start space-x-2 text-sm text-zinc-600">
                                            {t.completed ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />}
                                            <span className={t.completed ? 'line-through text-zinc-400' : ''}>{t.text}</span>
                                          </li>
                                        ))}
                                      </ul>
                                   )}
                                </div>
                              );
                           })
                         ) : (
                           <div className="text-sm text-zinc-500 italic px-2 py-1">Geen opdrachten gekoppeld aan deze shift.</div>
                         )}
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  )
}

function AssignmentCard({ assignment }: { assignment: Assignment; key?: string | number }) {
  const [notes, setNotes] = useState(assignment.workNotes || '');
  const [tasks, setTasks] = useState<AssignmentTask[]>(assignment.tasks || []);
  const [newTaskText, setNewTaskText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setTasks(assignment.tasks || []), 0);
    return () => window.clearTimeout(timer);
  }, [assignment.tasks]);

  const handleUpdate = async (updates: Partial<Assignment>) => {
    setIsUpdating(true);
    try {
      await secureApi.updateAssignmentDetails(
        assignment.id,
        (updates.tasks as AssignmentTask[] | undefined) || tasks,
        typeof updates.workNotes === 'string' ? updates.workNotes : notes,
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask = { id: Date.now().toString(), text: newTaskText.trim(), completed: false };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    setNewTaskText('');
    await handleUpdate({ tasks: updatedTasks });
  };

  const handleToggleTask = async (taskId: string) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    setTasks(updatedTasks);
    await handleUpdate({ tasks: updatedTasks });
  };

  const handleDeleteTask = async (taskId: string) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    await handleUpdate({ tasks: updatedTasks });
  };

  const handleArrive = async () => {
    setIsUpdating(true);
    try {
      const location = await getCurrentLocation();
      await secureApi.transitionAssignment({ assignmentId: assignment.id, status: 'arrived', location });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    setIsUpdating(true);
    try {
      const location = await getCurrentLocation();
      await secureApi.transitionAssignment({ assignmentId: assignment.id, status: 'completed', location, notes });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border overflow-hidden transition-all ${assignment.status === 'completed' ? 'border-green-200 bg-green-50/10' : 'border-zinc-200/60'}`}>
      <div className="p-6 space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-bold text-lg text-zinc-900">{assignment.customerName || 'Onbekende Klant'}</h3>
              {assignment.startTime && (
                <span className="bg-zinc-100 text-zinc-600 text-xs font-bold px-2 py-1 rounded-md flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{assignment.startTime}</span>
                </span>
              )}
            </div>
            <p className="text-zinc-500 mt-1.5 leading-relaxed">{assignment.description}</p>
          </div>
          {assignment.status === 'completed' && (
            <span className="bg-green-100 text-green-700 p-2 rounded-full shrink-0">
              <CheckCircle className="w-6 h-6" />
            </span>
          )}
        </div>

        {assignment.status === 'pending' && (
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Locatie Verificatie</span>
              <LiveLocationMap />
            </div>
            <button
              onClick={handleArrive}
              disabled={isUpdating}
              className="w-full flex items-center justify-center space-x-2 bg-zinc-100/50 hover:bg-zinc-100 text-zinc-900 py-4 rounded-[24px] font-bold transition-colors disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation2 className="w-5 h-5" />}
              <span>Markeer als aangekomen</span>
            </button>
          </div>
        )}

        {assignment.status === 'arrived' && (
          <div className="space-y-5 pt-4 border-t border-zinc-200">
            <div className="flex items-center space-x-2 text-sm font-medium text-zinc-900 bg-zinc-900/50 border border-zinc-200 p-3.5 rounded-[12px]">
              <Clock className="w-4 h-4 text-zinc-900" />
              <span>Aangekomen om {formatTime(assignment.arrivalTime!)}</span>
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-800 flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-zinc-400" />
                <span>Checklist / Uitgevoerde taken</span>
              </label>
              
              {tasks.length > 0 && (
                <div className="space-y-2 mb-3">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-[#FAFAFA] border border-zinc-200/60 rounded-[12px]">
                      <label className="flex items-center space-x-3 cursor-pointer flex-1">
                        <input 
                          type="checkbox" 
                          checked={task.completed} 
                          onChange={() => handleToggleTask(task.id)}
                          className="w-5 h-5 text-zinc-900 rounded border-zinc-200 focus:ring-zinc-900/10 cursor-pointer"
                        />
                        <span className={`text-sm font-medium ${task.completed ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>
                          {task.text}
                        </span>
                      </label>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-zinc-400 hover:text-red-500 transition-colors p-1" title="Taak verwijderen">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddTask} className="flex items-center space-x-2">
                <input 
                  type="text" 
                  value={newTaskText} 
                  onChange={e => setNewTaskText(e.target.value)}
                  placeholder="Nieuwe taak toevoegen..."
                  className="flex-1 border border-zinc-200 rounded-[12px] p-3 text-sm focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none transition-all"
                />
                <button type="submit" disabled={!newTaskText.trim() || isUpdating} className="bg-zinc-900 text-white p-3 rounded-[12px] hover:bg-zinc-800 transition-colors disabled:opacity-50">
                  <Plus className="w-5 h-5" />
                </button>
              </form>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-zinc-200">
              <label className="text-sm font-bold text-zinc-800 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span>Overige notities</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-zinc-200 rounded-[24px] p-4 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none resize-none transition-all"
                rows={3}
                placeholder="Details over levering, opmerkingen klant..."
              />
            </div>
            
            <div className="pt-2">
              <span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Locatie Verificatie Vertrek</span>
              <LiveLocationMap />
            </div>

            <button
              onClick={handleComplete}
              disabled={isUpdating}
              className="w-full flex items-center justify-center space-x-2 bg-zinc-900 hover:bg-zinc-900 text-white py-4 rounded-[24px] font-bold transition-all disabled:opacity-50 disabled:scale-[0.98] shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] mt-4"
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              <span>Opdracht Afronden & Vertrekken</span>
            </button>
          </div>
        )}

        {assignment.status === 'completed' && (
          <div className="pt-4 border-t border-green-100/50 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#FAFAFA] p-3 rounded-[12px] border border-zinc-200">
                <span className="text-zinc-500 block text-xs font-medium mb-1 uppercase tracking-wider">Aankomst</span>
                <span className="font-bold text-zinc-900">{formatTime(assignment.arrivalTime!)}</span>
              </div>
              <div className="bg-[#FAFAFA] p-3 rounded-[12px] border border-zinc-200">
                <span className="text-zinc-500 block text-xs font-medium mb-1 uppercase tracking-wider">Vertrek</span>
                <span className="font-bold text-zinc-900">{formatTime(assignment.departureTime!)}</span>
              </div>
            </div>
            
            {assignment.tasks && assignment.tasks.length > 0 && (
              <div className="mt-4 bg-white p-4 rounded-[12px] border-2 border-zinc-200">
                <span className="text-xs font-bold text-zinc-400 block mb-3 uppercase tracking-wider">Uitgevoerde Taken</span>
                <ul className="space-y-2">
                  {assignment.tasks.map(t => (
                    <li key={t.id} className={`flex items-center space-x-2 text-sm ${t.completed ? 'text-zinc-700' : 'text-zinc-400'}`}>
                      {t.completed ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0" /> : <Square className="w-4 h-4 shrink-0" />}
                      <span className={t.completed ? 'line-through opacity-70' : ''}>{t.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assignment.workNotes && (
              <div className="mt-3 bg-white p-4 rounded-[12px] border-2 border-zinc-200 text-zinc-700 leading-relaxed">
                <span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Notities</span>
                {assignment.workNotes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
