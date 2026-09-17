import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { User, Shift, ShiftBreak, Assignment, Attachment, CorrectionRequest, Incident, PlannedShift, PushState, TeamNotification, WeeklyAvailability, PrivacySettings, AccessEvent, PilotProgram, PilotFeedback, getCurrentLocation, formatTime, formatDate, AssignmentTask, localDateKey } from './types';
import { MapPin, Clock, CheckCircle, Play, Square, Navigation2, FileText, Loader2, User as UserIcon, Calendar, History, Save, Plus, Trash2, CheckSquare, CalendarDays, XCircle, AlertTriangle, ClipboardList, WifiOff, Coffee, Upload, Download, Bell } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { handleFirestoreError, OperationType } from './lib/firebase';
import { secureApi } from './lib/secureApi';
import { readOfflineQueue } from './lib/offlineQueue';
import NotificationCenter from './components/NotificationCenter';
import PrivacyPanel from './components/PrivacyPanel';
import { useLanguage } from './i18n';

const LiveLocationMap = dynamic(() => import('./components/LiveLocationMap'), { ssr: false });

export default function EmployeeView() {
  const { user } = useAuth();
  const { locale } = useLanguage(); const fr = locale === 'fr';
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
  const [privacy, setPrivacy] = useState<PrivacySettings>({ controllerName: 'Barlicious & Koelverhuur', contactEmail: '', locationDays: 90, notificationDays: 180, auditDays: 730, errorDays: 180, backupDays: 365 });
  const [accessEvents, setAccessEvents] = useState<AccessEvent[]>([]); const [pilot, setPilot] = useState<PilotProgram | null>(null); const [pilotFeedback, setPilotFeedback] = useState<PilotFeedback[]>([]);
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
    setPrivacy(data.privacy); setAccessEvents(data.accessEvents); setPilot(data.pilot); setPilotFeedback(data.pilotFeedback);
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
    <div className="employee-shell max-w-lg mx-auto w-full space-y-6 pb-28">
      {queueCount > 0 && <div className="ops-chip-warning w-full justify-start p-3"><WifiOff className="w-4 h-4" />{queueCount} actie{queueCount === 1 ? '' : 's'} wachten op internet.</div>}
      <div className="employee-nav ops-nav fixed bottom-3 left-3 right-3 z-50 max-w-lg mx-auto p-1.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`ops-nav-btn flex-col gap-1 relative ${activeTab === 'dashboard' ? 'ops-nav-btn-active' : ''}`}
        >
          <Calendar className="w-4 h-4" />
          <span>{fr ? "Aujourd'hui" : 'Vandaag'}</span>
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {unacknowledgedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`ops-nav-btn flex-col gap-1 ${activeTab === 'planning' ? 'ops-nav-btn-active' : ''}`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Planning</span>
        </button>
        <button onClick={() => setActiveTab('reports')} className={`ops-nav-btn flex-col gap-1 ${activeTab === 'reports' ? 'ops-nav-btn-active' : ''}`}><AlertTriangle className="w-4 h-4" /><span>{fr ? 'Signaler' : 'Melden'}</span></button>
        <button onClick={() => setActiveTab('notifications')} className={`ops-nav-btn flex-col gap-1 relative ${activeTab === 'notifications' ? 'ops-nav-btn-active' : ''}`}><Bell className="w-4 h-4" /><span>{fr ? 'Messages' : 'Berichten'}</span>{notifications.some(item => !item.readAt) && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />}</button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`ops-nav-btn flex-col gap-1 ${activeTab === 'profile' ? 'ops-nav-btn-active' : ''}`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{fr ? 'Profil' : 'Mijn Profiel'}</span>
        </button>
      </div>

      {activeTab === 'dashboard' && <DashboardTab userId={user.id} shifts={shifts} breaks={breaks} assignments={assignments} plannedShifts={plannedShifts} loading={loading} onChanged={loadData} />}
      {activeTab === 'planning' && <EmployeePlanningTab userId={user.id} shifts={plannedShifts} attachments={attachments} onChanged={loadData} />}
      {activeTab === 'reports' && <ReportsTab shifts={shifts} plannedShifts={plannedShifts} incidents={incidents} corrections={correctionRequests} onChanged={loadData} />}
      {activeTab === 'notifications' && <NotificationCenter notifications={notifications} push={push} onChanged={loadData} />}
      {activeTab === 'profile' && <div className="space-y-6"><ProfileTab user={user} /><PrivacyPanel privacy={privacy} accessEvents={accessEvents} pilot={pilot} feedback={pilotFeedback} onChanged={loadData} /></div>}
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
               <div key={a.id} className="ops-panel flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
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

      {todaysPlanned.length > 0 && <div className="ops-card p-5 space-y-3">
        <h2 className="font-bold text-zinc-900">Vandaag gepland</h2>
        {todaysPlanned.map(item => <div key={item.id} className="ops-panel p-3 flex justify-between gap-3"><div><div className="font-bold">{item.title}</div><div className="text-sm text-zinc-500">{item.startTime}â€“{item.endTime}{item.customerName ? ` Â· ${item.customerName}` : ''}</div></div>{item.customerLatitude !== undefined && item.customerLongitude !== undefined && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${item.customerLatitude},${item.customerLongitude}`} className="ops-btn-primary shrink-0 px-3 text-xs gap-1"><Navigation2 className="w-3.5 h-3.5" />Route</a>}</div>)}
      </div>}

      {/* Time Tracking Card */}
      <div className="ops-card overflow-hidden">
        <div className="p-8 text-center space-y-6">
          <h2 className="text-xl font-bold text-zinc-800">Urenregistratie</h2>
          
          {activeShift ? (
            <div className="space-y-6">
              <div className="ops-chip-success px-5 py-2.5">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                <span>Ingeklokt sinds {formatTime(activeShift.clockIn)}</span>
              </div>
              {activeShift.clockInLoc?.accuracy > 0 && <div className="text-xs font-semibold text-zinc-500">GPS-nauwkeurigheid: Â±{Math.round(activeShift.clockInLoc.accuracy)} m{activeShift.clockInDistance !== undefined ? ` Â· afstand locatie: ${Math.round(activeShift.clockInDistance)} m` : ''}</div>}
              
              <div className="ops-panel text-left space-y-4 p-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Dienst Status</label>
                  <select 
                    value={shiftStatus} 
                    onChange={e => setShiftStatus(e.target.value as typeof shiftStatus)}
                    className="ops-input w-full p-3 font-medium text-sm"
                  >
                    <option value="Normaal">Normaal</option>
                    <option value="Vertraagd">Vertraagd</option>
                    <option value="Gedeeltelijk afgerond">Gedeeltelijk afgerond</option>
                    <option value="Probleem gemeld">Probleem gemeld</option>
                  </select>
    #^¹êÚ$z{-®éÜj×“°¢Ó°¢&WGW&âÆF—b6Æ74æÖSÒ'76R×’ÓB#à¢ÆF—b6Æ74æÖSÒ'‚Ó#ãÆƒ"6Æ74æÖSÒ'FW‡BÓ'†ÂföçBÖ&öÆBFW‡B×¦–æ2Ó“#åvVV¶÷fW'¦–6‡CÂöƒ#ãÇ6Æ74æÖSÒ'FW‡B×6ÒFW‡B×¦–æ2ÓS×BÓ#äF–Vç7FVâÂ&÷WFRÂ6†V6¶Æ—7BVâFö7VÖVçFVâãÂ÷ãÂöF—cà¢¶W'&÷"bbÆF—b6Æ74æÖSÒ'&÷VæFVB×†Â&÷&FW"&÷&FW"×&VBÓ#&r×&VBÓSÓ2FW‡B×6ÒföçB×6VÖ–&öÆBFW‡B×&VBÓs#ç¶W'&÷'ÓÂöF—cçÐ¢²W6öÖ–æræÆVæwF‚bbÆF—b6Æ74æÖSÒ&&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÓ'†ÂÓ‚FW‡BÖ6VçFW"FW‡B×¦–æ2ÓS#äW"7FâæörvVVâvWV&Æ–6VW&FRF–Vç7FVâ¶Æ"ãÂöF—cçÐ¢·W6öÖ–æræÖ‡6†–gBÓâ°¢6öç7B6öæf—&ÖF–öâÒ6†–gBæ6öæf—&ÖF–öç5·W6W$–EÒÇÂwVæF–ærs°¢&WGW&âÆ'F–6ÆR¶W“×·6†–gBæ–GÒ6Æ74æÖSÒ&&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÕ³#G…ÒÓR6†F÷r×6Ò76R×’ÓB#à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2×7F'B§W7F–g’Ö&WGvVVâvÓ2#ãÆF—cãÆF—b6Æ74æÖSÒ'FW‡B×‡2WW&66RG&6¶–ær×v–FRföçBÖ&öÆBFW‡B×¦–æ2ÓC#ç¶f÷&ÖDFFR‡6†–gBæFFR—ÓÂöF—cãÆƒ26Æ74æÖSÒ'FW‡BÖÆrföçBÖW‡G&&öÆBFW‡B×¦–æ2Ó“×BÓ#ç·6†–gBçF—FÆWÓÂöƒ3ãÂöF—cãÇ7â6Æ74æÖS×¶FW‡B×‡2föçBÖ&öÆB‚Ó2’ÓãR&÷VæFVBÖgVÆÂG¶6öæf—&ÖF–öâÓÓÒv6öæf—&ÖVBròv&rÖVÖW&ÆBÓFW‡BÖVÖW&ÆBÓsr¢6öæf—&ÖF–öâÓÓÒvFV6Æ–æVBròv&r×&VBÓFW‡B×&VBÓsr¢v&rÖÖ&W"ÓFW‡BÖÖ&W"ÓƒwÖÓç¶6öæf—&ÖF–öâÓÓÒv6öæf—&ÖVBròt&WfW7F–vBr¢6öæf—&ÖF–öâÓÓÒvFV6Æ–æVBròtvWvV–vW&Br¢tçGvö÷&BæöF–rwÓÂ÷7ããÂöF—cà¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó"vÓ2FW‡B×6Ò#ãÆF—b6Æ74æÖSÒ&&r×¦–æ2ÓS&÷VæFVB×†ÂÓ2#ãÇ7â6Æ74æÖSÒ&&Æö6²FW‡B×‡2FW‡B×¦–æ2ÓCföçBÖ&öÆBWW&66RÖ"Ó#åW&VãÂ÷7ããÇ7â6Æ74æÖSÒ&föçBÖ&öÆB#ç·6†–gBç7F'EF–ÖWÞ(	7·6†–gBæVæEF–ÖWÓÂ÷7ããÂöF—cãÆF—b6Æ74æÖSÒ&&r×¦–æ2ÓS&÷VæFVB×†ÂÓ2#ãÇ7â6Æ74æÖSÒ&&Æö6²FW‡B×‡2FW‡B×¦–æ2ÓCföçBÖ&öÆBWW&66RÖ"Ó#åW¦SÂ÷7ããÇ7â6Æ74æÖSÒ&föçBÖ&öÆB#ç·6†–gBæ'&V´Ö–çWFW7ÒÖ–âãÂ÷7ããÂöF—cãÂöF—cà¢·6†–gBæ7W7FöÖW$æÖRbbÆF—b6Æ74æÖSÒ&fÆW‚—FV×2×7F'BvÓ"FW‡B×6ÒFW‡B×¦–æ2Óc#ãÄÖ–â6Æ74æÖSÒ'rÓB‚ÓB×BÓãR6‡&–æ²Ó"óãÆF—cãÆF—b6Æ74æÖSÒ&föçBÖ&öÆBFW‡B×¦–æ2Óƒ#ç·6†–gBæ7W7FöÖW$æÖWÓÂöF—cãÆF—cç·6†–gBæ7W7FöÖW$FG&W77ÓÂöF—cç·6†–gBæ7W7FöÖW$ÆF—GVFRÓÒVæFVf–æVBbb6†–gBæ7W7FöÖW$Æöæv—GVFRÓÒVæFVf–æVBbbÆ6Æ74æÖSÒ'FW‡B×¦–æ2Ó“VæFW&Æ–æRföçB×6VÖ–&öÆB"F&vWCÒ%ö&Ææ²"&VÃÒ&æ÷&VfW'&W""‡&Vc×¶‡GG3¢ò÷wwrævöövÆRæ6öÒöÖ2÷6V&6‚óö“ÓgVW'“ÒG·6†–gBæ7W7FöÖW$ÆF—GVFWÒÂG·6†–gBæ7W7FöÖW$Æöæv—GVFWÖÓä÷VâÆö6F–SÂöçÓÂöF—cãÂöF—cçÐ¢·6†–gBææ÷FW2bbÇ6Æ74æÖSÒ'FW‡B×6ÒFW‡B×¦–æ2Óc&r×¦–æ2ÓS&÷VæFVB×†ÂÓ2#ç·6†–gBææ÷FW7ÓÂ÷çÐ¢·6†–gBæ6†V6¶Æ—7BæÆVæwF‚âbbÆF—b6Æ74æÖSÒ&&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ276R×’Ó"#ãÆF—b6Æ74æÖSÒ'FW‡B×‡2WW&66RföçBÖ&öÆBG&6¶–ær×v–FRFW‡B×¦–æ2ÓCfÆW‚—FV×2Ö6VçFW"vÓ"#ãÄ6Æ—&ö&DÆ—7B6Æ74æÖSÒ'rÓB‚ÓB"óä6†V6¶Æ—7CÂöF—cç·6†–gBæ6†V6¶Æ—7BæÖ‚‡F6²Â–æFW‚’Óâ²6öç7BF6´–CÕ7G&–ær†–æFW‚“²6öç7BFöæSÒ‡6†–gBæ6†V6¶Æ—7E7FFW5·W6W$–EÒÇÂµÒ’æ–æ6ÇVFW2‡F6´–B“²&WGW&âÆÆ&VÂ¶W“×·F6´–GÒ6Æ74æÖSÒ&fÆW‚—FV×2×7F'BvÓ2FW‡B×6ÒföçB×6VÖ–&öÆB7W'6÷"×ö–çFW"#ãÆ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×¶FöæWÒF—6&ÆVC×¶'W7”–BÓÓÒ6†–gBæ–GÒöä6†ævS×²‚’ÓâFövvÆUF6²‡6†–gBÂF6´–B—Ò6Æ74æÖSÒ&×BÓãRrÓB‚ÓB66VçB×¦–æ2Ó“"óãÇ7â6Æ74æÖS×¶FöæRòvÆ–æR×F‡&÷Vv‚FW‡B×¦–æ2ÓCr¢wFW‡B×¦–æ2ÓswÓç·F6·ÓÂ÷7ããÂöÆ&VÃã²Ò—ÓÂöF—cçÐ¢ÆF—b6Æ74æÖSÒ&&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ276R×’Ó"#ãÆF—b6Æ74æÖSÒ'FW‡B×‡2WW&66RföçBÖ&öÆBG&6¶–ær×v–FRFW‡B×¦–æ2ÓC#äf÷Fþ(	—2VâFö7VÖVçFVãÂöF—cç¶GF6†ÖVçG2æf–ÇFW"†—FVÒÓâ—FVÒæVçF—G•G—RÓÓÒwÆææVE÷6†–gBrbb—FVÒæVçF—G”–BÓÓÒ6†–gBæ–B’æÖ†—FVÒÓâÆ'WGFöâ¶W“×¶—FVÒæ–GÒG—SÒ&'WGFöâ"öä6Æ–6³×²‚’ÓâF÷væÆöB†—FVÒ—Ò6Æ74æÖSÒ'rÖgVÆÂFW‡BÖÆVgBfÆW‚—FV×2Ö6VçFW"vÓ"FW‡B×6ÒföçB×6VÖ–&öÆBFW‡B×¦–æ2Ós&r×¦–æ2ÓS&÷VæFVBÖÆrÓ"#ãÄF÷væÆöB6Æ74æÖSÒ'rÓB‚ÓB"óãÇ7â6Æ74æÖSÒ'G'Væ6FR#ç¶—FVÒæf–ÆVæÖWÓÂ÷7ããÂö'WGFöãâ—ÓÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"&÷&FW"&÷&FW"ÖF6†VB&÷&FW"×¦–æ2Ó3&÷VæFVBÖÆrÓ2FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2Óc7W'6÷"×ö–çFW"#ãÅWÆöB6Æ74æÖSÒ'rÓB‚ÓB"óä&W7FæBFöWföVvVãÆ–çWBG—SÒ&f–ÆR"66WCÒ&–ÖvRò¢ÂçFbÂæFö2ÂæFö7‚ÂçG‡B"×VÇF—ÆR6Æ74æÖSÒ&†–FFVâ"öä6†ævS×¶WfVçBÓâWÆöB‡6†–gBæ–BÂWfVçBçF&vWBæf–ÆW2—ÒóãÂöÆ&VÃãÂöF—cà¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó"vÓ2#ãÆ'WGFöâF—6&ÆVC×¶'W7”–BÓÓÒ6†–gBæ–GÒöä6Æ–6³×²‚’Óâ&W7öæB‡6†–gBæ–BÂvFV6Æ–æVBr—Ò6Æ74æÖSÒ'’Ó2&÷VæFVB×†Â&÷&FW"&÷&FW"×&VBÓ#FW‡B×&VBÓsföçBÖ&öÆBfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"F—6&ÆVC¦÷6—G’ÓC#ãÅ„6—&6ÆR6Æ74æÖSÒ'rÓB‚ÓB"óåvV–vW&VãÂö'WGFöããÆ'WGFöâF—6&ÆVC×¶'W7”–BÓÓÒ6†–gBæ–GÒöä6Æ–6³×²‚’Óâ&W7öæB‡6†–gBæ–BÂv6öæf—&ÖVBr—Ò6Æ74æÖSÒ'’Ó2&÷VæFVB×†Â&r×¦–æ2Ó“FW‡B×v†—FRföçBÖ&öÆBfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"F—6&ÆVC¦÷6—G’ÓC#ç¶'W7”–BÓÓÒ6†–gBæ–BòÄÆöFW#"6Æ74æÖSÒ'rÓB‚ÓBæ–ÖFR×7–â"óâ¢Ä6†V6´6—&6ÆR6Æ74æÖSÒ'rÓB‚ÓB"óçÔ&WfW7F–vVãÂö'WGFöããÂöF—cà¢Âö'F–6ÆSã°¢Ò—Ð¢ÂöF—cã°§Ð ¦gVæ7F–öâ&W÷'G5F"‡²6†–gG2ÂÆææVE6†–gG2Â–æ6–FVçG2Â6÷'&V7F–öç2Âöä6†ævVBÓ¢²6†–gG3¢6†–gEµÓ²ÆææVE6†–gG3¢ÆææVE6†–gEµÓ²–æ6–FVçG3¢–æ6–FVçEµÓ²6÷'&V7F–öç3¢6÷'&V7F–öå&WVW7EµÓ²öä6†ævVC¢‚’Óâ&öÖ—6SÇfö–CâÒ’°¢6öç7B¶ÖöFRÂ6WDÖöFUÒÒW6U7FFSÂv–æ6–FVçBrÂv6÷'&V7F–öâsâ‚v–æ6–FVçBr“°¢6öç7B¶'W7’Â6WD'W7•ÒÒW6U7FFR†fÇ6R“°¢6öç7B¶ÖW76vRÂ6WDÖW76vUÒÒW6U7FFR‚rr“°¢6öç7B¶6FVv÷'’Â6WD6FVv÷'•ÒÒW6U7FFR‚u66†FRr“°¢6öç7B·6WfW&—G’Â6WE6WfW&—G•ÒÒW6U7FFSÂvÆ÷rrÂvÖVF—VÒrÂv†–v‚sâ‚vÖVF—VÒr“°¢6öç7B¶FW67&—F–öâÂ6WDFW67&—F–öåÒÒW6U7FFR‚rr“°¢6öç7B·ÆææVE6†–gD–BÂ6WEÆææVE6†–gD–EÒÒW6U7FFR‚rr“°¢6öç7B¶–æ6–FVçDf–ÆW2Â6WD–æ6–FVçDf–ÆW5ÒÒW6U7FFSÄf–ÆUµÓâ…µÒ“°¢6öç7B·6†–gD–BÂ6WE6†–gD–EÒÒW6U7FFR‚rr“°¢6öç7B·&WVW7FVD6Æö6´–âÂ6WE&WVW7FVD6Æö6´–åÒÒW6U7FFR‚rr“°¢6öç7B·&WVW7FVD6Æö6´÷WBÂ6WE&WVW7FVD6Æö6´÷WEÒÒW6U7FFR‚rr“°¢6öç7B·&V6öâÂ6WE&V6öåÒÒW6U7FFR‚rr“° ¢6öç7B7V&Ö—D–æ6–FVçBÒ7–æ2†WfVçC¢&V7Bäf÷&ÔWfVçB’Óâ°¢WfVçBç&WfVçDFVfVÇB‚“²6WD'W7’‡G'VR“²6WDÖW76vR‚rr“°¢G'’°¢ÆWB–æ6–FVçDÆö6F–öã°¢G'’²–æ6–FVçDÆö6F–öâÒv—BvWD7W'&VçDÆö6F–öâ‚“²Ò6F6‚²–æ6–FVçDÆö6F–öâÒVæFVf–æVC²Ð¢6öç7B²FFÒÒv—B6V7W&T’æ7&VFT–æ6–FVçB‡²ÆææVE6†–gD–C¢ÆææVE6†–gD–BÇÂVæFVf–æVBÂ6FVv÷'’Â6WfW&—G’ÂFW67&—F–öâÂÆö6F–öã¢–æ6–FVçDÆö6F–öâÂö67W'&VDC¢FFRææ÷r‚’Ò“°¢f÷"†6öç7Bf–ÆRöb–æ6–FVçDf–ÆW2ç6Æ–6RƒÂR’’v—B6V7W&T’çWÆöDGF6†ÖVçB‚v–æ6–FVçBrÂFFæ–BÂf–ÆR“°¢6WDFW67&—F–öâ‚rr“²6WD–æ6–FVçDf–ÆW2…µÒ“²6WDÖW76vR‚t–æ6–FVçB—2fV–Æ–rvVÖVÆBâr“²v—Böä6†ævVB‚“°¢Ò6F6‚†W'&÷"’²6WDÖW76vR†W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢t–æ6–FVçBÖVÆFVâ—2Ö—6ÇV·Bâr“²Ð¢f–æÆÇ’²6WD'W7’†fÇ6R“²Ð¢Ó° ¢6öç7B7V&Ö—D6÷'&V7F–öâÒ7–æ2†WfVçC¢&V7Bäf÷&ÔWfVçB’Óâ°¢WfVçBç&WfVçDFVfVÇB‚“²6WD'W7’‡G'VR“²6WDÖW76vR‚rr“°¢G'’°¢6öç7B&W7VÇBÒv—B6V7W&T’æ7&VFT6÷'&V7F–öå&WVW7B‡²6†–gD–BÂ&WVW7FVD6Æö6´–ã¢&WVW7FVD6Æö6´–âòæWrFFR‡&WVW7FVD6Æö6´–â’ævWEF–ÖR‚’¢VæFVf–æVBÂ&WVW7FVD6Æö6´÷WC¢&WVW7FVD6Æö6´÷WBòæWrFFR‡&WVW7FVD6Æö6´÷WB’ævWEF–ÖR‚’¢VæFVf–æVBÂ&V6öâÒ“°¢6WE&V6öâ‚rr“²6WE&WVW7FVD6Æö6´–â‚rr“²6WE&WVW7FVD6Æö6´÷WB‚rr“²6WDÖW76vR‡&W7VÇBçVWVVBòt6÷'&V7F–WfW'¦öV²7FBöffÆ–æR¶Æ"âr¢t6÷'&V7F–WfW'¦öV²—2–ævVF–VæBâr“²v—Böä6†ævVB‚’æ6F6‚‚‚’ÓâVæFVf–æVB“°¢Ò6F6‚†W'&÷"’²6WDÖW76vR†W'&÷"–ç7Fæ6VöbW'&÷"òW'&÷"æÖW76vR¢t6÷'&V7F–WfW'¦öV²—2Ö—6ÇV·Bâr“²Ð¢f–æÆÇ’²6WD'W7’†fÇ6R“²Ð¢Ó° ¢&WGW&âÆF—b6Æ74æÖSÒ'76R×’ÓR#à¢ÆF—cãÆƒ"6Æ74æÖSÒ'FW‡BÓ'†ÂföçBÖ&öÆBFW‡B×¦–æ2Ó“#äÖVÆFVãÂöƒ#ãÇ6Æ74æÖSÒ'FW‡B×6ÒFW‡B×¦–æ2ÓS×BÓ#äÆVr–æ6–FVçFVâf7Böbg&rVVâF–¦G66÷'&V7F–RâãÂ÷ãÂöF—cà¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó"vÓ"&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓãR#ãÆ'WGFöâöä6Æ–6³×²‚’Óâ6WDÖöFR‚v–æ6–FVçBr—Ò6Æ74æÖS×¶’Ó2&÷VæFVBÖÆrföçBÖ&öÆBFW‡B×6ÒG¶ÖöFRÓÓÒv–æ6–FVçBròv&r×¦–æ2Ó“FW‡B×v†—FRr¢wFW‡B×¦–æ2ÓcwÖÓä–æ6–FVçCÂö'WGFöããÆ'WGFöâöä6Æ–6³×²‚’Óâ6WDÖöFR‚v6÷'&V7F–öâr—Ò6Æ74æÖS×¶’Ó2&÷VæFVBÖÆrföçBÖ&öÆBFW‡B×6ÒG¶ÖöFRÓÓÒv6÷'&V7F–öâròv&r×¦–æ2Ó“FW‡B×v†—FRr¢wFW‡B×¦–æ2ÓcwÖÓåF–¦F6÷'&V7F–SÂö'WGFöããÂöF—cà¢¶ÖW76vRbbÆF—b6Æ74æÖSÒ&&r×¦–æ2Ó&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2FW‡B×6ÒföçB×6VÖ–&öÆBFW‡B×¦–æ2Ós#ç¶ÖW76vWÓÂöF—cçÐ¢¶ÖöFRÓÓÒv–æ6–FVçBròÆf÷&Òöå7V&Ö—C×·7V&Ö—D–æ6–FVçGÒ6Æ74æÖSÒ&&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÕ³#G…ÒÓR76R×’ÓB#à¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆB#ävWÆæFRF–Vç7CÇ6VÆV7BfÇVS×·ÆææVE6†–gD–GÒöä6†ævS×¶RÓâ6WEÆææVE6†–gD–B†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2&r×v†—FR#ãÆ÷F–öâfÇVSÒ"#äæ–WBvV¶÷VÆCÂö÷F–öãç·ÆææVE6†–gG2æÖ†—FVÒÓâÆ÷F–öâ¶W“×¶—FVÒæ–GÒfÇVS×¶—FVÒæ–GÓç¶—FVÒæFFWÒ+r¶—FVÒçF—FÆWÓÂö÷F–öãâ—ÓÂ÷6VÆV7CãÂöÆ&VÃà¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó"vÓ2#ãÆÆ&VÂ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆB#ä6FVv÷&–SÇ6VÆV7BfÇVS×¶6FVv÷'—Òöä6†ævS×¶RÓâ6WD6FVv÷'’†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2&r×v†—FR#ãÆ÷F–öãå66†FSÂö÷F–öããÆ÷F–öãäöævWfÃÂö÷F–öããÆ÷F–öãåfV–Æ–v†V–CÂö÷F–öããÆ÷F–öãä¶ÆçFÖVÆF–æsÂö÷F–öããÆ÷F–öãä÷fW&–sÂö÷F–öããÂ÷6VÆV7CãÂöÆ&VÃãÆÆ&VÂ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆB#äW&ç7CÇ6VÆV7BfÇVS×·6WfW&—G—Òöä6†ævS×¶RÓâ6WE6WfW&—G’†RçF&vWBçfÇVR2G—Vöb6WfW&—G’—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2&r×v†—FR#ãÆ÷F–öâfÇVSÒ&Æ÷r#äÆsÂö÷F–öããÆ÷F–öâfÇVSÒ&ÖVF—VÒ#äÖ–FFVÃÂö÷F–öããÆ÷F–öâfÇVSÒ&†–v‚#ä†öösÂö÷F–öããÂ÷6VÆV7CãÂöÆ&VÃãÂöF—cà¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆB#åvB—2W"vV&WW&CóÇFW‡F&V&WV—&VBfÇVS×¶FW67&—F–öçÒöä6†ævS×¶RÓâ6WDFW67&—F–öâ†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2‚Ó3"&W6—¦RÖæöæR"óãÂöÆ&VÃà¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"vÓ"&÷&FW"&÷&FW"ÖF6†VB&÷&FW"×¦–æ2Ó3&÷VæFVB×†ÂÓBFW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2Óc7W'6÷"×ö–çFW"#ãÅWÆöB6Æ74æÖSÒ'rÓB‚ÓB"óäf÷Fþ(	—2öbFö7VÖVçFVâ‡¶–æ6–FVçDf–ÆW2æÆVæwF‡Ò“Æ–çWBG—SÒ&f–ÆR"66WCÒ&–ÖvRò¢ÂçFbÂæFö2ÂæFö7‚ÂçG‡B"×VÇF—ÆR6Æ74æÖSÒ&†–FFVâ"öä6†ævS×¶RÓâ6WD–æ6–FVçDf–ÆW2„'&’æg&öÒ†RçF&vWBæf–ÆW2ÇÂµÒ’ç6Æ–6RƒÂR’—ÒóãÂöÆ&VÃà¢Æ'WGFöâF—6&ÆVC×¶'W7—Ò6Æ74æÖSÒ'rÖgVÆÂ&r×&VBÓcFW‡B×v†—FR&÷VæFVB×†Â’ÓBföçBÖ&öÆBfÆW‚§W7F–g’Ö6VçFW"vÓ"#ç¶'W7’bbÄÆöFW#"6Æ74æÖSÒ'rÓR‚ÓRæ–ÖFR×7–â"óçÔ–æ6–FVçBÖVÆFVãÂö'WGFöãà¢Âöf÷&Óâ¢Æf÷&Òöå7V&Ö—C×·7V&Ö—D6÷'&V7F–öçÒ6Æ74æÖSÒ&&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÕ³#G…ÒÓR76R×’ÓB#à¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆB#åF–¦G&Vv—7G&F–SÇ6VÆV7B&WV—&VBfÇVS×·6†–gD–GÒöä6†ævS×¶RÓâ6WE6†–gD–B†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2&r×v†—FR#ãÆ÷F–öâfÇVSÒ"#å6VÆV7FVW"ââãÂö÷F–öãç·6†–gG2ç6Æ–6RƒÂ3’æÖ†—FVÒÓâÆ÷F–öâ¶W“×¶—FVÒæ–GÒfÇVS×¶—FVÒæ–GÓç¶f÷&ÖDFFR†—FVÒæ6Æö6´–â—Ò+r¶f÷&ÖEF–ÖR†—FVÒæ6Æö6´–â—×¶—FVÒæ6Æö6´÷WBò(	2G¶f÷&ÖEF–ÖR†—FVÒæ6Æö6´÷WB—Ö¢r+r7F–VbwÓÂö÷F–öãâ—ÓÂ÷6VÆV7CãÂöÆ&VÃà¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó"vÓ2#ãÆÆ&VÂ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆB#äæ–WWvR7F'GF–¦CÆ–çWBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×·&WVW7FVD6Æö6´–çÒöä6†ævS×¶RÓâ6WE&WVW7FVD6Æö6´–â†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2"óãÂöÆ&VÃãÆÆ&VÂ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆB#äæ–WWvRV–æGF–¦CÆ–çWBG—SÒ&FFWF–ÖRÖÆö6Â"fÇVS×·&WVW7FVD6Æö6´÷WGÒöä6†ævS×¶RÓâ6WE&WVW7FVD6Æö6´÷WB†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2"óãÂöÆ&VÃãÂöF—cà¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆB#å&VFVãÇFW‡F&V&WV—&VBfÇVS×·&V6öçÒöä6†ævS×¶RÓâ6WE&V6öâ†RçF&vWBçfÇVR—Ò6Æ74æÖSÒ&×BÓãRrÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2‚Ó#‚&W6—¦RÖæöæR"óãÂöÆ&VÃà¢Æ'WGFöâF—6&ÆVC×¶'W7—Ò6Æ74æÖSÒ'rÖgVÆÂ&r×¦–æ2Ó“FW‡B×v†—FR&÷VæFVB×†Â’ÓBföçBÖ&öÆB#ä6÷'&V7F–Rçg&vVãÂö'WGFöãà¢Âöf÷&ÓçÐ¢ÆF—b6Æ74æÖSÒ'76R×’Ó"#ãÆƒ26Æ74æÖSÒ&föçBÖ&öÆBFW‡B×¦–æ2Óƒ#äÖ–¦â&V6VçFRÖVÆF–ævVãÂöƒ3ç¶–æ6–FVçG2ç6Æ–6RƒÂR’æÖ†—FVÒÓâÆF—b¶W“×¶—FVÒæ–GÒ6Æ74æÖSÒ&&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2FW‡B×6Ò#ãÆF—b6Æ74æÖSÒ&föçBÖ&öÆB#ç¶—FVÒæ6FVv÷'—Ò+r¶—FVÒç6WfW&—G’ÓÓÒv†–v‚ròv†öörr¢—FVÒç6WfW&—G’ÓÓÒvÖVF—VÒròvÖ–FFVÂr¢vÆrwÓÂöF—cãÆF—b6Æ74æÖSÒ'FW‡B×¦–æ2ÓSÆ–æRÖ6Æ×Ó"#ç¶—FVÒæFW67&—F–öçÓÂöF—cãÂöF—câ—×¶6÷'&V7F–öç2ç6Æ–6RƒÂR’æÖ†—FVÒÓâÆF—b¶W“×¶—FVÒæ–GÒ6Æ74æÖSÒ&&r×v†—FR&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ2FW‡B×6ÒfÆW‚§W7F–g’Ö&WGvVVâvÓ"#ãÇ7â6Æ74æÖSÒ&föçB×6VÖ–&öÆB#åF–¦F6÷'&V7F–R+r¶f÷&ÖDFFR†—FVÒæ7&VFVDB—ÓÂ÷7ããÇ7â6Æ74æÖSÒ&föçBÖ&öÆB6—FÆ—¦R#ç¶—FVÒç7FGW7ÓÂ÷7ããÂöF—câ—ÓÂöF—cà¢ÂöF—cã°§Ð ¦gVæ7F–öâ&öf–ÆUF"‡²W6W"Ó¢²W6W#¢W6W"Ò’°¢6öç7B¶æÖRÂ6WDæÖUÒÒW6U7FFR‡W6W"ææÖRÇÂrr“°¢6öç7B·†öæRÂ6WE†öæUÒÒW6U7FFR‡W6W"ç†öæRÇÂrr“°¢6öç7B¶f–Æ&–Æ—G’Â6WDf–Æ&–Æ—G•ÒÒW6U7FFR‡W6W"æf–Æ&–Æ—G’ÇÂrr“°¢6öç7B¶f–Æ&–Æ—G•66†VGVÆRÂ6WDf–Æ&–Æ—G•66†VGVÆUÒÒW6U7FFSÅvVV¶Ç”f–Æ&–Æ—G“â‚‚’ÓâW6W"æf–Æ&–Æ—G•66†VGVÆRÇÂ°¢ss¢²Væ&ÆVC¢fÇ6RÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢ss¢²Væ&ÆVC¢G'VRÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢s"s¢²Væ&ÆVC¢G'VRÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢s2s¢²Væ&ÆVC¢G'VRÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢sBs¢²Væ&ÆVC¢G'VRÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢sRs¢²Væ&ÆVC¢G'VRÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢sbs¢²Væ&ÆVC¢fÇ6RÂ7F'C¢s“£rÂVæC¢ss£rÒÀ¢Ò“°¢6öç7B¶—5WFF–ærÂ6WD—5WFF–æuÒÒW6U7FFR†fÇ6R“°¢6öç7B¶×6rÂ6WD×6uÒÒW6U7FFR‡²FW‡C¢rrÂG—S¢rrÒ“° ¢6öç7B¶†—7F÷'”76–væÖVçG2Â6WD†—7F÷'”76–væÖVçG5ÒÒW6U7FFSÄ76–væÖVçEµÓâ…µÒ“°¢6öç7B¶†—7F÷'•6†–gG2Â6WD†—7F÷'•6†–gG5ÒÒW6U7FFSÅ6†–gEµÓâ…µÒ“°¢6öç7B¶ÆöF–æt†—7F÷'’Â6WDÆöF–æt†—7F÷'•ÒÒW6U7FFR‡G'VR“° ¢W6TVffV7B‚‚’Óâ°¢ÆWB7F—fRÒG'VS°¢6öç7BÆöBÒ7–æ2‚’Óâ°¢G'’°¢6öç7B²FFÒÒv—B6V7W&T’ç6æ6†÷B‚“°¢–b‚7F—fR’&WGW&ã°¢6WD†—7F÷'”76–væÖVçG2†FFæ76–væÖVçG2æf–ÇFW"†—FVÒÓâ—FVÒç7FGW2ÓÓÒv6ö×ÆWFVBr’“°¢6WD†—7F÷'•6†–gG2†FFç6†–gG2“°¢6WDÆöF–æt†—7F÷'’†fÇ6R“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"†W'&÷"“°¢–b†7F—fR’6WDÆöF–æt†—7F÷'’†fÇ6R“°¢Ð¢Ó°¢fö–BÆöB‚“°¢6öç7BF–ÖW"Òv–æF÷rç6WD–çFW'fÂ†ÆöBÂ“°¢&WGW&â‚’Óâ²7F—fRÒfÇ6S²v–æF÷ræ6ÆV$–çFW'fÂ‡F–ÖW"“²Ó°¢ÒÂ·W6W"æ–EÒ“° ¢6öç7B†æFÆU6fRÒ7–æ2†S¢&V7Bäf÷&ÔWfVçB’Óâ°¢Rç&WfVçDFVfVÇB‚“°¢6WD—5WFF–ær‡G'VR“°¢6WD×6r‡²FW‡C¢rrÂG—S¢rrÒ“°¢G'’°¢v—B6V7W&T’çWFFU&öf–ÆR‡²æÖRÂ†öæRÂf–Æ&–Æ—G’Âf–Æ&–Æ—G•66†VGVÆRÒ“°¢6WD×6r‡²FW‡C¢u&öf–VÂ7V66W7föÂ&–¦vWvW&·BrÂG—S¢w7V66W72rÒ“°¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"†W'"“°¢6WD×6r‡²FW‡C¢tW"—2VVâf÷WB÷vWG&VFVâ&–¢†WB÷6ÆâârÂG—S¢vW'&÷"rÒ“°¢Òf–æÆÇ’°¢6WD—5WFF–ær†fÇ6R“°¢Ð¢Ó° ¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'76R×’Ób#à¢ÆF—b6Æ74æÖSÒ&&r×v†—FR&÷VæFVBÕ³#G…Ò6†F÷rÕ³óG…óG…ó÷&v"ƒÃÃÃã2•Ò&÷&FW"&÷&FW"×¦–æ2Ó#óc÷fW&fÆ÷rÖ†–FFVâ#à¢ÆF—b6Æ74æÖSÒ'Ó‚76R×’Ób#à¢Æƒ"6Æ74æÖSÒ'FW‡B×†ÂföçBÖ&öÆBFW‡B×¦–æ2Óƒ#åW'6ööæÆ–¦¶RvVvWfVç3Âöƒ#à¢ ¢¶×6rçFW‡Bbb€¢ÆF—b6Æ74æÖS×¶ÓB&÷VæFVBÕ³'…ÒFW‡B×6ÒföçBÖÖVF—VÒ&÷&FW"G¶×6rçG—RÓÓÒw7V66W72ròv&rÖw&VVâÓSFW‡BÖw&VVâÓs&÷&FW"Öw&VVâÓ#r¢v&r×&VBÓSFW‡B×&VBÓs&÷&FW"×&VBÓ#wÖÓà¢¶×6rçFW‡GÐ¢ÂöF—cà¢—Ð ¢Æf÷&Òöå7V&Ö—C×¶†æFÆU6fWÒ6Æ74æÖSÒ'76R×’ÓB#à¢ÆF—cà¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2ÓsÖ"ÓãR#åföÆÆVF–vRæÓÂöÆ&VÃà¢Æ–çWBG—SÒ'FW‡B"fÇVS×¶æÖWÒöä6†ævS×¶RÓâ6WDæÖR†RçF&vWBçfÇVR—Ò&WV—&VB6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÕ³#G…ÒÓ2ãRfö7W3§&–ærÓBfö7W3§&–ær×¦–æ2Ó“ófö7W3¦&÷&FW"×¦–æ2Ó“÷WFÆ–æRÖæöæR&rÕ²4dddÒG&ç6—F–öâÖÆÂföçBÖÖVF—VÒ"óà¢ÂöF—cà¢ÆF—cà¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2ÓsÖ"ÓãR#åFVÆVfööæçVÖÖW#ÂöÆ&VÃà¢Æ–çWBG—SÒ'FVÂ"fÇVS×·†öæWÒöä6†ævS×¶RÓâ6WE†öæR†RçF&vWBçfÇVR—ÒÆ6V†öÆFW#Ò#G‡‚‡‚‡‚‡‚"6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÕ³#G…ÒÓ2ãRfö7W3§&–ærÓBfö7W3§&–ær×¦–æ2Ó“ófö7W3¦&÷&FW"×¦–æ2Ó“÷WFÆ–æRÖæöæR&rÕ²4dddÒG&ç6—F–öâÖÆÂföçBÖÖVF—VÒ"óà¢ÂöF—cà¢ÆF—cà¢ÆÆ&VÂ6Æ74æÖSÒ&&Æö6²FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2ÓsÖ"ÓãR#äÖ–¦â&W66†–¶&&†V–CÂöÆ&VÃà¢ÇFW‡F&VfÇVS×¶f–Æ&–Æ—G—Òöä6†ævS×¶RÓâ6WDf–Æ&–Æ—G’†RçF&vWBçfÇVR—ÒÆ6V†öÆFW#Ò$&–§bâÖÕg"&W66†–¶&"Â–â†WBvVV¶VæB–â÷fW&ÆVrâââ"&÷w3×³7Ò6Æ74æÖSÒ'rÖgVÆÂ&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÕ³#G…ÒÓ2ãRfö7W3§&–ærÓBfö7W3§&–ær×¦–æ2Ó“ófö7W3¦&÷&FW"×¦–æ2Ó“÷WFÆ–æRÖæöæR&rÕ²4dddÒG&ç6—F–öâÖÆÂföçBÖÖVF—VÒ&W6—¦RÖæöæR#ãÂ÷FW‡F&Và¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'76R×’Ó"#à¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2Ós#åf7FRvVV·W&Vâfö÷"6öæfÆ–7F6öçG&öÆSÂöF—cà¢µµ²srÂtÖuÒÅ²s"rÂtF’uÒÅ²s2rÂuvòuÒÅ²sBrÂtFòuÒÅ²sRrÂug"uÒÅ²sbrÂu¦uÒÅ²srÂu¦òuÕÒæÖ‚…¶¶W’ÂÆ&VÅÒ’Óâ°¢6öç7BF’Òf–Æ&–Æ—G•66†VGVÆU¶¶W•ÒÇÂ²Væ&ÆVC¢fÇ6RÂ7F'C¢s“£rÂVæC¢ss£rÓ°¢&WGW&âÆF—b¶W“×¶¶W—Ò6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Õ³C‡…óg%óg%ÒvÓ"—FV×2Ö6VçFW"&r×¦–æ2ÓS&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVB×†ÂÓ"ãR#à¢ÆÆ&VÂ6Æ74æÖSÒ&föçBÖ&öÆBFW‡B×6ÒfÆW‚—FV×2Ö6VçFW"vÓ"#ãÆ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×¶F’æVæ&ÆVGÒöä6†ævS×¶RÓâ6WDf–Æ&–Æ—G•66†VGVÆR†7W'&VçBÓâ‡²ââæ7W'&VçBÂ¶¶W•Ó¢²ââæF’ÂVæ&ÆVC¢RçF&vWBæ6†V6¶VBÒÒ’—Ò6Æ74æÖSÒ&66VçB×¦–æ2Ó“"óç¶Æ&VÇÓÂöÆ&VÃà¢Æ–çWB&–ÖÆ&VÃ×¶7F'BG¶Æ&VÇÖÒG—SÒ'F–ÖR"F—6&ÆVC×²F’æVæ&ÆVGÒfÇVS×¶F’ç7F'GÒöä6†ævS×¶RÓâ6WDf–Æ&–Æ—G•66†VGVÆR†7W'&VçBÓâ‡²ââæ7W'&VçBÂ¶¶W•Ó¢²ââæF’Â7F'C¢RçF&vWBçfÇVRÒÒ’—Ò6Æ74æÖSÒ&&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÖÆrÓ"FW‡B×6ÒF—6&ÆVC¦÷6—G’ÓC"óà¢Æ–çWB&–ÖÆ&VÃ×¶V–æFRG¶Æ&VÇÖÒG—SÒ'F–ÖR"F—6&ÆVC×²F’æVæ&ÆVGÒfÇVS×¶F’æVæGÒöä6†ævS×¶RÓâ6WDf–Æ&–Æ—G•66†VGVÆR†7W'&VçBÓâ‡²ââæ7W'&VçBÂ¶¶W•Ó¢²ââæF’ÂVæC¢RçF&vWBçfÇVRÒÒ’—Ò6Æ74æÖSÒ&&÷&FW"&÷&FW"×¦–æ2Ó#&÷VæFVBÖÆrÓ"FW‡B×6ÒF—6&ÆVC¦÷6—G’ÓC"óà¢ÂöF—cã°¢Ò—Ð¢ÂöF—cà¢Æ'WGFöâG—SÒ'7V&Ö—B"F—6&ÆVC×¶—5WFF–æwÒ6Æ74æÖSÒ'rÖgVÆÂ&r×¦–æ2Ó“†÷fW#¦&r×¦–æ2ÓƒFW‡B×v†—FRföçBÖ&öÆB’ÓB&÷VæFVBÕ³#G…ÒfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö6VçFW"76R×‚Ó"G&ç6—F–öâÖÆÂ6†F÷rÖÆr6†F÷rÕ³óG…óG…ó÷&v"ƒÃÃÃã•ÒF—6&ÆVC¦÷6—G’ÓS#à¢¶—5WFF–æròÄÆöFW#"6Æ74æÖSÒ'rÓR‚ÓRæ–ÖFR×7–â"óâ¢Å6fR6Æ74æÖSÒ'rÓR‚ÓR"óçÐ¢Ç7ãävVvWfVç2÷6ÆãÂ÷7ãà¢Âö'WGFöãà¢Âöf÷&Óà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&&r×v†—FR&÷VæFVBÕ³#G…Ò6†F÷rÕ³óG…óG…ó÷&v"ƒÃÃÃã2•Ò&÷&FW"&÷&FW"×¦–æ2Ó#óc÷fW&fÆ÷rÖ†–FFVâ#à¢ÆF—b6Æ74æÖSÒ'Ó‚76R×’Ób#à¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"76R×‚Ó"#à¢Ä†—7F÷'’6Æ74æÖSÒ'rÓb‚ÓbFW‡B×¦–æ2ÓC"óà¢Æƒ"6Æ74æÖSÒ'FW‡B×†ÂföçBÖ&öÆBFW‡B×¦–æ2Óƒ#äÖ–¦â†—7F÷&–V³Âöƒ#à¢ÂöF—cà ¢¶ÆöF–æt†—7F÷'’ò€¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö6VçFW"’ÓB#ãÄÆöFW#"6Æ74æÖSÒ'rÓb‚Óbæ–ÖFR×7–âFW‡B×¦–æ2Ó“"óãÂöF—cà¢’¢€¢ÆF—b6Æ74æÖSÒ'76R×’ÓR#à¢¶†—7F÷'•6†–gG2æf–ÇFW"‡2Óâ2æ6Æö6´÷WB’æÆVæwF‚ÓÓÒò€¢Ç6Æ74æÖSÒ'FW‡B×6ÒFW‡B×¦–æ2ÓS#ävVVâföÇFöö–FR6†–gG2vWföæFVâãÂ÷à¢’¢€¢†—7F÷'•6†–gG2æf–ÇFW"‡2Óâ2æ6Æö6´÷WB’ç6÷'B‚†Æ"’Óâ"æ6Æö6´–âÒæ6Æö6´–â’æÖ‡6†–gBÓâ°¢6öç7BGW&F–öä×2Ò6†–gBæ6Æö6´÷WBÒ6†–gBæ6Æö6´–ã°¢6öç7B†÷W'2ÒÖF‚æfÆö÷"†GW&F–öä×2òƒ¢c¢c’“°¢6öç7BÖ–çWFW2ÒÖF‚æfÆö÷"‚†GW&F–öä×2Rƒ¢c¢c’’òƒ¢c’“°¢ ¢6öç7B6†–gDFFTö&¢ÒæWrFFR‡6†–gBæ6Æö6´–â“°¢6öç7B6†–gDFFU7G"Ò6†–gDFFTö&¢ævWDgVÆÅ–V"‚’²rÒr²7G&–ær‡6†–gDFFTö&¢ævWDÖöçF‚‚’³’çE7F'Bƒ"Âsr’²rÒr²7G&–ær‡6†–gDFFTö&¢ævWDFFR‚’’çE7F'Bƒ"Âsr“°¢6öç7B6†–gD76–væÖVçG2Ò†—7F÷'”76–væÖVçG2æf–ÇFW"†ÓâæFFRÓÓÒ6†–gDFFU7G"“° ¢&WGW&â€¢ÆF—b¶W“×·6†–gBæ–GÒ6Æ74æÖSÒ&&rÕ²4dddÒÓR&÷VæFVBÕ³#G…Ò&÷&FW"&÷&FW"×¦–æ2Ó#óc#à¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2×7F'BÖ"ÓB#à¢ÆF—cà¢ÆF—b6Æ74æÖSÒ&föçBÖ&öÆBFW‡B×¦–æ2Ó“FW‡BÖÆrÖ"Ó#ç¶f÷&ÖDFFR‡6†–gBæ6Æö6´–â—ÓÂöF—cà¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"76R×‚Ó"FW‡B×6ÒFW‡B×¦–æ2ÓcföçBÖÖVF—VÒ#à¢Ä6Æö6²6Æ74æÖSÒ'rÓB‚ÓBFW‡B×¦–æ2ÓC"óà¢Ç7ãç¶f÷&ÖEF–ÖR‡6†–gBæ6Æö6´–â—ÒÒ¶f÷&ÖEF–ÖR‡6†–gBæ6Æö6´÷WB—ÓÂ÷7ãà¢Ç7â6Æ74æÖSÒ'FW‡B×¦–æ2ÓS#î(
#Â÷7ãà¢Ç7â6Æ74æÖSÒ'FW‡B×¦–æ2Ó“föçBÖ&öÆB#ç¶†÷W'7×R¶Ö–çWFW7ÖÒvWvW&·CÂ÷7ãà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó6Ó¦w&–BÖ6öÇ2Ó"vÓ2Ö"ÓR#à¢ÆF—b6Æ74æÖSÒ&&r×v†—FRÓ2&÷VæFVBÕ³'…Ò&÷&FW"&÷&FW"×¦–æ2Ó#fÆW‚—FV×2×7F'B76R×‚Ó26†F÷rÕ³óG…óG…ó÷&v"ƒÃÃÃã2•Ò#à¢ÆF—b6Æ74æÖSÒ&×BÓãR#ãÄÖ–â6Æ74æÖSÒ'rÓB‚ÓBFW‡BÖw&VVâÓS"óãÂöF—cà¢ÆF—cà¢Ç7â6Æ74æÖSÒ&&Æö6²FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓCWW&66RG&6¶–ær×v–FW"Ö"ÓãR#ä–ævV¶Æö·BvVö6F–SÂ÷7ãà¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒföçBÖÖVF—VÒFW‡B×¦–æ2ÓsG'Væ6FR#à¢·6†–gBæ6Æö6´–äÆö3òæÆBòG·6†–gBæ6Æö6´–äÆö2æÆBçFôf—†VBƒR—ÒÂG·6†–gBæ6Æö6´–äÆö2æÆærçFôf—†VBƒR—Ö¢tÆö6F–Ræ–WB&W66†–¶&"wÐ¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'FW‡B×‡2FW‡B×¦–æ2ÓS×BÓãRföçBÖÖVF—VÒ#ä¶f÷&ÖEF–ÖR‡6†–gBæ6Æö6´–â—ÓÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&&r×v†—FRÓ2&÷VæFVBÕ³'…Ò&÷&FW"&÷&FW"×¦–æ2Ó#fÆW‚—FV×2×7F'B76R×‚Ó26†F÷rÕ³óG…óG…ó÷&v"ƒÃÃÃã2•Ò#à¢ÆF—b6Æ74æÖSÒ&×BÓãR#ãÄÖ–â6Æ74æÖSÒ'rÓB‚ÓBFW‡BÖÖ&W"ÓS"óãÂöF—cà¢ÆF—cà¢Ç7â6Æ74æÖSÒ&&Æö6²FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓCWW&66RG&6¶–ær×v–FW"Ö"ÓãR#åV—FvV¶Æö·BvVöÆö6F–SÂ÷7ãà¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒföçBÖÖVF—VÒFW‡B×¦–æ2ÓsG'Væ6FR#à¢·6†–gBæ6Æö6´÷WDÆö3òæÆBòG·6†–gBæ6Æö6´÷WDÆö2æÆBçFôf—†VBƒR—ÒÂG·6†–gBæ6Æö6´÷WDÆö2æÆærçFôf—†VBƒR—Ö¢tÆö6F–Ræ–WB&W66†–¶&"wÐ¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'FW‡B×‡2FW‡B×¦–æ2ÓS×BÓãRföçBÖÖVF—VÒ#ä¶f÷&ÖEF–ÖR‡6†–gBæ6Æö6´÷WB—ÓÂöF—cà¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'76R×’Ó2#à¢Ç7â6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓCWW&66RG&6¶–ær×v–FW"fÆW‚—FV×2Ö6VçFW"76R×‚ÓãR&÷&FW"Ö"&÷&FW"×¦–æ2Ó#óc"Ó"#à¢Ä6†V6µ7V&R6Æ74æÖSÒ'rÓB‚ÓB"óà¢Ç7ãäfvW&öæFR÷G&6‡FVâbF¶VãÂ÷7ãà¢Â÷7ãà¢·6†–gD76–væÖVçG2æÆVæwF‚âò€¢6†–gD76–væÖVçG2æÖ†76–væÖVçBÓâ°¢6öç7BF6·5F÷FÂÒ76–væÖVçBçF6·3òæÆVæwF‚ÇÂ°¢6öç7BF6·4FöæRÒ76–væÖVçBçF6·3òæf–ÇFW"‡BÓâBæ6ö×ÆWFVB’æÆVæwF‚ÇÂ°¢ ¢&WGW&â€¢ÆF—b¶W“×¶76–væÖVçBæ–GÒ6Æ74æÖSÒ&&r×v†—FRÓB&÷VæFVBÕ³'…Ò&÷&FW"&÷&FW"×¦–æ2Ó#6†F÷rÕ³óG…óG…ó÷&v"ƒÃÃÃã2•Ò#à¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2×7F'BÖ"Ó"#à¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡B×¦–æ2Óƒ#ç¶76–væÖVçBæ7W7FöÖW$æÖRÇÂtöæ&V¶VæFR¶ÆçBwÓÂ÷7ãà¢·F6·5F÷FÂâò€¢Ç7â6Æ74æÖS×¶FW‡B×‡2föçBÖ&öÆB‚Ó"ãR’Ó&÷VæFVBÖgVÆÂG·F6·4FöæRÓÓÒF6·5F÷FÂòv&rÖw&VVâÓFW‡BÖw&VVâÓsr¢v&r×¦–æ2ÓFW‡B×¦–æ2ÓcwÖÓà¢·F6·4FöæWÒ÷·F6·5F÷FÇÒF¶Và¢Â÷7ãà¢’¢€¢Ç7â6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆB‚Ó"ãR’Ó&÷VæFVBÖgVÆÂ&r×¦–æ2ÓóSFW‡B×¦–æ2Óc#ävVVâF¶VãÂ÷7ãà¢—Ð¢ÂöF—cà¢¶76–væÖVçBçF6·2bb76–væÖVçBçF6·2æÆVæwF‚âbb€¢ÇVÂ6Æ74æÖSÒ'76R×’ÓãR×BÓ2BÓ2&÷&FW"×B&÷&FW"×¦–æ2Ó##à¢¶76–væÖVçBçF6·2æÖ‡BÓâ€¢ÆÆ’¶W“×·Bæ–GÒ6Æ74æÖSÒ&fÆW‚—FV×2×7F'B76R×‚Ó"FW‡B×6ÒFW‡B×¦–æ2Óc#à¢·Bæ6ö×ÆWFVBòÄ6†V6µ7V&R6Æ74æÖSÒ'rÓB‚ÓBFW‡BÖw&VVâÓS6‡&–æ²Ó×BÓãR"óâ¢Å7V&R6Æ74æÖSÒ'rÓB‚ÓB6‡&–æ²Ó×BÓãRFW‡B×¦–æ2ÓS"óçÐ¢Ç7â6Æ74æÖS×·Bæ6ö×ÆWFVBòvÆ–æR×F‡&÷Vv‚FW‡B×¦–æ2ÓCr¢rwÓç·BçFW‡GÓÂ÷7ãà¢ÂöÆ“à¢’—Ð¢Â÷VÃà¢—Ð¢ÂöF—cà¢“°¢Ò¢’¢€¢ÆF—b6Æ74æÖSÒ'FW‡B×6ÒFW‡B×¦–æ2ÓS—FÆ–2‚Ó"’Ó#ävVVâ÷G&6‡FVâvV¶÷VÆBâFW¦R6†–gBãÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢“°¢Ò¢—Ð¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢ÂöF—cà¢§Ð ¦gVæ7F–öâ76–væÖVçD6&B‡²76–væÖVçBÓ¢²76–væÖVçC¢76–væÖVçC²¶W“ó¢7G&–ærÂçVÖ&W"Ò’°¢6öç7B¶æ÷FW2Â6WDæ÷FW5ÒÒW6U7FFR†76–væÖVçBçv÷&´æ÷FW2ÇÂrr“°¢6öç7B·F6·2Â6WEF6·5ÒÒW6U7FFSÄ76–væÖVçEF6µµÓâ†76–væÖVçBçF6·2ÇÂµÒ“°¢6öç7B¶æWuF6µFW‡BÂ6WDæWuF6µFW‡EÒÒW6U7FFR‚rr“°¢6öç7B¶—5WFF–ærÂ6WD—5WFF–æuÒÒW6U7FFR†fÇ6R“° ¢W6TVffV7B‚‚’Óâ°¢6öç7BF–ÖW"Òv–æF÷rç6WEF–ÖV÷WB‚‚’Óâ6WEF6·2†76–væÖVçBçF6·2ÇÂµÒ’Â“°¢&WGW&â‚’Óâv–æF÷ræ6ÆV%F–ÖV÷WB‡F–ÖW"“°¢ÒÂ¶76–væÖVçBçF6·5Ò“° ¢6öç7B†æFÆUWFFRÒ7–æ2‡WFFW3¢'F–ÃÄ76–væÖVçCâ’Óâ°¢6WD—5WFF–ær‡G'VR“°¢G'’°¢v—B6V7W&T’çWFFT76–væÖVçDFWF–Ç2€¢76–væÖVçBæ–BÀ¢‡WFFW2çF6·2276–væÖVçEF6µµÒÂVæFVf–æVB’ÇÂF6·2À¢G—VöbWFFW2çv÷&´æ÷FW2ÓÓÒw7G&–ærròWFFW2çv÷&´æ÷FW2¢æ÷FW2À¢“°¢Ò6F6‚†W'"’°¢6öç6öÆRæW'&÷"†W'"“°¢Òf–æÆÇ’°¢6WD—5WFF–ær†fÇ6R“°¢Ð¢Ó° ¢6öç7B†æFÆTFEF6²Ò7–æ2†S¢&V7Bäf÷&ÔWfVçB’Óâ°¢Rç&WfVçDFVfVÇB‚“°¢–b‚æWuF6µFW‡BçG&–Ò‚’’&WGW&ã°¢6öç7BæWuF6²Ò²–C¢FFRææ÷r‚’çFõ7G&–ær‚’ÂFW‡C¢æWuF6µFW‡BçG&–Ò‚’Â6ö×ÆWFVC¢fÇ6RÓ°¢6öç7BWFFVEF6·2Ò²ââçF6·2ÂæWuF6µÓ°¢6WEF6·2‡WFFVEF6·2“°¢6WDæWuF6µFW‡B‚rr“°¢v—B†æFÆUWFFR‡²F6·3¢WFFVEF6·2Ò“°¢Ó° ¢6öç7B†æFÆUFövvÆUF6²Ò7–æ2‡F6´–C¢7G&–ær’Óâ°¢6öç7BWFFVEF6·2ÒF6·2æÖ‡BÓâBæ–BÓÓÒF6´–Bò²ââçBÂ6ö×ÆWFVC¢Bæ6ö×ÆWFVBÒ¢B“°¢6WEF6·2‡WFFVEF6·2“°¢v—B†æFÆUWFFR‡²F6·3¢WFFVEF6·2Ò“°¢Ó° ¢6öç7B†æFÆTFVÆWFUF6²Ò7–æ2‡F6´–C¢7G&–ær’Óâ°¢6öç7BWFFVEF6·2ÒF6·2æf–ÇFW"‡BÓâBæ–BÓÒF6´–B“°¢6WEF6·2‡WFFVEF6·2“°¢v—B†æFÆUWFFR‡²F6·3¢WFFVEF6·2Ò“°¢Ó° ¢6öç7B†æFÆT'&—fRÒ7–æ2‚’Óâ°¢6WD—5WFF–ær‡G'VR“°¢G'’°¢6öç7BÆö6F–öâÒv—BvWD7W'&VçDÆö6F–öâ‚“°¢v—B6V7W&T’çG&ç6—F–öä76–væÖVçB‡²76–væÖVçD–C¢76–væÖVçBæ–BÂ7FGW3¢v'&—fVBrÂÆö6F–öâÒ“°¢Òf–æÆÇ’°¢6WD—5WFF–ær†fÇ6R“°¢Ð¢Ó° ¢6öç7B†æFÆT6ö×ÆWFRÒ7–æ2‚’Óâ°¢6WD—5WFF–ær‡G'VR“°¢G'’°¢6öç7BÆö6F–öâÒv—BvWD7W'&VçDÆö6F–öâ‚“°¢v—B6V7W&T’çG&ç6—F–öä76–væÖVçB‡²76–væÖVçD–C¢76–væÖVçBæ–BÂ7FGW3¢v6ö×ÆWFVBrÂÆö6F–öâÂæ÷FW2Ò“°¢Òf–æÆÇ’°¢6WD—5WFF–ær†fÇ6R“°¢Ð¢Ó° ¢&WGW&â€¢ÆF—b6Æ74æÖS×¶÷2Ö6&B÷fW&fÆ÷rÖ†–FFVâG&ç6—F–öâÖÆÂG¶76–væÖVçBç7FGW2ÓÓÒv6ö×ÆWFVBròv&÷&FW"ÖVÖW&ÆBÓCócr¢rwÖÓà¢ÆF—b6Æ74æÖSÒ'Ób76R×’ÓR#à¢ÆF—b6Æ74æÖSÒ&fÆW‚§W7F–g’Ö&WGvVVâ—FV×2×7F'B#à¢ÆF—cà¢ÆF—b6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"76R×‚Ó"Ö"Ó#à¢Æƒ26Æ74æÖSÒ&föçBÖ&öÆBFW‡BÖÆrFW‡B×¦–æ2Ó“#ç¶76–væÖVçBæ7W7FöÖW$æÖRÇÂtöæ&V¶VæFR¶ÆçBwÓÂöƒ3à¢¶76–væÖVçBç7F'EF–ÖRbb€¢Ç7â6Æ74æÖSÒ&&r×¦–æ2ÓFW‡B×¦–æ2ÓcFW‡B×‡2föçBÖ&öÆB‚Ó"’Ó&÷VæFVBÖÖBfÆW‚—FV×2Ö6VçFW"76R×‚Ó#à¢Ä6Æö6²6Æ74æÖSÒ'rÓ2ãR‚Ó2ãR"óà¢Ç7ãç¶76–væÖVçBç7F'EF–ÖWÓÂ÷7ãà¢Â÷7ãà¢—Ð¢ÂöF—cà¢Ç6Æ74æÖSÒ'FW‡B×¦–æ2ÓS×BÓãRÆVF–ær×&VÆ†VB#ç¶76–væÖVçBæFW67&—F–öçÓÂ÷à¢ÂöF—cà¢¶76–væÖVçBç7FGW2ÓÓÒv6ö×ÆWFVBrbb€¢Ç7â6Æ74æÖSÒ&&rÖw&VVâÓFW‡BÖw&VVâÓsÓ"&÷VæFVBÖgVÆÂ6‡&–æ²Ó#à¢Ä6†V6´6—&6ÆR6Æ74æÖSÒ'rÓb‚Ób"óà¢Â÷7ãà¢—Ð¢ÂöF—cà ¢¶76–væÖVçBç7FGW2ÓÓÒwVæF–ærrbb€¢ÆF—b6Æ74æÖSÒ'76R×’ÓB#à¢ÆF—cà¢Ç7â6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓC&Æö6²Ö"Ó"WW&66RG&6¶–ær×v–FW"#äÆö6F–RfW&–f–6F–SÂ÷7ãà¢ÄÆ—fTÆö6F–öäÖóà¢ÂöF—cà¢Æ'WGFöà¢öä6Æ–6³×¶†æFÆT'&—fWÐ¢F—6&ÆVC×¶—5WFF–æwÐ¢6Æ74æÖSÒ&÷2Ö'Fâ×6V6öæF'’rÖgVÆÂ76R×‚Ó"’ÓB ¢à¢¶—5WFF–æròÄÆöFW#"6Æ74æÖSÒ'rÓR‚ÓRæ–ÖFR×7–â"óâ¢Äæf–vF–öã"6Æ74æÖSÒ'rÓR‚ÓR"óçÐ¢Ç7ãäÖ&¶VW"Ç2ævV¶öÖVãÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢—Ð ¢¶76–væÖVçBç7FGW2ÓÓÒv'&—fVBrbb€¢ÆF—b6Æ74æÖSÒ'76R×’ÓRBÓB&÷&FW"×B&÷&FW"×¦–æ2Ó##à¢ÆF—b6Æ74æÖSÒ&÷2×æVÂfÆW‚—FV×2Ö6VçFW"76R×‚Ó"FW‡B×6ÒföçBÖÖVF—VÒÓ2ãR#à¢Ä6Æö6²6Æ74æÖSÒ'rÓB‚ÓBFW‡B×¦–æ2Ó“"óà¢Ç7ãäævV¶öÖVâöÒ¶f÷&ÖEF–ÖR†76–væÖVçBæ'&—fÅF–ÖR—ÓÂ÷7ãà¢ÂöF—cà¢ ¢ÆF—b6Æ74æÖSÒ'76R×’Ó2#à¢ÆÆ&VÂ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2ÓƒfÆW‚—FV×2Ö6VçFW"76R×‚Ó"#à¢Ä6†V6µ7V&R6Æ74æÖSÒ'rÓB‚ÓBFW‡B×¦–æ2ÓC"óà¢Ç7ãä6†V6¶Æ—7BòV—FvWföW&FRF¶VãÂ÷7ãà¢ÂöÆ&VÃà¢ ¢·F6·2æÆVæwF‚âbb€¢ÆF—b6Æ74æÖSÒ'76R×’Ó"Ö"Ó2#à¢·F6·2æÖ‡F6²Óâ€¢ÆF—b¶W“×·F6²æ–GÒ6Æ74æÖSÒ&÷2×æVÂfÆW‚—FV×2Ö6VçFW"§W7F–g’Ö&WGvVVâÓ2#à¢ÆÆ&VÂ6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"76R×‚Ó27W'6÷"×ö–çFW"fÆW‚Ó#à¢Æ–çWB ¢G—SÒ&6†V6¶&÷‚" ¢6†V6¶VC×·F6²æ6ö×ÆWFVGÒ ¢öä6†ævS×²‚’Óâ†æFÆUFövvÆUF6²‡F6²æ–B—Ð¢6Æ74æÖSÒ'rÓR‚ÓRFW‡B×¦–æ2Ó“&÷VæFVB&÷&FW"×¦–æ2Ó#fö7W3§&–ær×¦–æ2Ó“ó7W'6÷"×ö–çFW" ¢óà¢Ç7â6Æ74æÖS×¶FW‡B×6ÒföçBÖÖVF—VÒG·F6²æ6ö×ÆWFVBòwFW‡B×¦–æ2ÓCÆ–æR×F‡&÷Vv‚r¢wFW‡B×¦–æ2ÓswÖÓà¢·F6²çFW‡GÐ¢Â÷7ãà¢ÂöÆ&VÃà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ†æFÆTFVÆWFUF6²‡F6²æ–B—Ò6Æ74æÖSÒ'FW‡B×¦–æ2ÓC†÷fW#§FW‡B×&VBÓSG&ç6—F–öâÖ6öÆ÷'2Ó"F—FÆSÒ%F²fW'v–¦FW&Vâ#à¢ÅG&6ƒ"6Æ74æÖSÒ'rÓB‚ÓB"óà¢Âö'WGFöãà¢ÂöF—cà¢’—Ð¢ÂöF—cà¢—Ð ¢Æf÷&Òöå7V&Ö—C×¶†æFÆTFEF6·Ò6Æ74æÖSÒ&fÆW‚—FV×2Ö6VçFW"76R×‚Ó"#à¢Æ–çWB ¢G—SÒ'FW‡B" ¢fÇVS×¶æWuF6µFW‡GÒ ¢öä6†ævS×¶RÓâ6WDæWuF6µFW‡B†RçF&vWBçfÇVR—Ð¢Æ6V†öÆFW#Ò$æ–WWvRF²FöWföVvVââââ ¢6Æ74æÖSÒ&÷2Ö–çWBfÆW‚ÓÓ2FW‡B×6Ò ¢óà¢Æ'WGFöâG—SÒ'7V&Ö—B"F—6&ÆVC×²æWuF6µFW‡BçG&–Ò‚’ÇÂ—5WFF–æwÒ6Æ74æÖSÒ&÷2Ö'Fâ×&–Ö'’Ö–â×rÓÓ2#à¢ÅÇW26Æ74æÖSÒ'rÓR‚ÓR"óà¢Âö'WGFöãà¢Âöf÷&Óà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'76R×’Ó"ãRBÓ"&÷&FW"×B&÷&FW"×¦–æ2Ó##à¢ÆÆ&VÂ6Æ74æÖSÒ'FW‡B×6ÒföçBÖ&öÆBFW‡B×¦–æ2ÓƒfÆW‚—FV×2Ö6VçFW"76R×‚Ó"#à¢Äf–ÆUFW‡B6Æ74æÖSÒ'rÓB‚ÓBFW‡B×¦–æ2ÓC"óà¢Ç7ãä÷fW&–vRæ÷F—F–W3Â÷7ãà¢ÂöÆ&VÃà¢ÇFW‡F&V¢fÇVS×¶æ÷FW7Ð¢öä6†ævS×²†R’Óâ6WDæ÷FW2†RçF&vWBçfÇVR—Ð¢6Æ74æÖSÒ&÷2Ö–çWBrÖgVÆÂÓB&W6—¦RÖæöæR ¢&÷w3×³7Ð¢Æ6V†öÆFW#Ò$FWF–Ç2÷fW"ÆWfW&–ærÂ÷ÖW&¶–ævVâ¶ÆçBâââ ¢óà¢ÂöF—cà¢ ¢ÆF—b6Æ74æÖSÒ'BÓ"#à¢Ç7â6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓC&Æö6²Ö"Ó"WW&66RG&6¶–ær×v–FW"#äÆö6F–RfW&–f–6F–RfW'G&V³Â÷7ãà¢ÄÆ—fTÆö6F–öäÖóà¢ÂöF—cà ¢Æ'WGFöà¢öä6Æ–6³×¶†æFÆT6ö×ÆWFWÐ¢F—6&ÆVC×¶—5WFF–æwÐ¢6Æ74æÖSÒ&÷2Ö'Fâ×&–Ö'’rÖgVÆÂ76R×‚Ó"’ÓB×BÓB ¢à¢¶—5WFF–æròÄÆöFW#"6Æ74æÖSÒ'rÓR‚ÓRæ–ÖFR×7–â"óâ¢Ä6†V6´6—&6ÆR6Æ74æÖSÒ'rÓR‚ÓR"óçÐ¢Ç7ãä÷G&6‡Bg&öæFVâbfW'G&V¶¶VãÂ÷7ãà¢Âö'WGFöãà¢ÂöF—cà¢—Ð ¢¶76–væÖVçBç7FGW2ÓÓÒv6ö×ÆWFVBrbb€¢ÆF—b6Æ74æÖSÒ'BÓB&÷&FW"×B&÷&FW"Öw&VVâÓóS76R×’Ó2FW‡B×6Ò#à¢ÆF—b6Æ74æÖSÒ&w&–Bw&–BÖ6öÇ2Ó"vÓB#à¢ÆF—b6Æ74æÖSÒ&÷2×æVÂÓ2#à¢Ç7â6Æ74æÖSÒ'FW‡B×¦–æ2ÓS&Æö6²FW‡B×‡2föçBÖÖVF—VÒÖ"ÓWW&66RG&6¶–ær×v–FW"#äæ¶ö×7CÂ÷7ãà¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡B×¦–æ2Ó“#ç¶f÷&ÖEF–ÖR†76–væÖVçBæ'&—fÅF–ÖR—ÓÂ÷7ãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&÷2×æVÂÓ2#à¢Ç7â6Æ74æÖSÒ'FW‡B×¦–æ2ÓS&Æö6²FW‡B×‡2föçBÖÖVF—VÒÖ"ÓWW&66RG&6¶–ær×v–FW"#åfW'G&V³Â÷7ãà¢Ç7â6Æ74æÖSÒ&föçBÖ&öÆBFW‡B×¦–æ2Ó“#ç¶f÷&ÖEF–ÖR†76–væÖVçBæFW'GW&UF–ÖR—ÓÂ÷7ãà¢ÂöF—cà¢ÂöF—cà¢ ¢¶76–væÖVçBçF6·2bb76–væÖVçBçF6·2æÆVæwF‚âbb€¢ÆF—b6Æ74æÖSÒ&÷2×æVÂ×BÓBÓB#à¢Ç7â6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓC&Æö6²Ö"Ó2WW&66RG&6¶–ær×v–FW"#åV—FvWföW&FRF¶VãÂ÷7ãà¢ÇVÂ6Æ74æÖSÒ'76R×’Ó"#à¢¶76–væÖVçBçF6·2æÖ‡BÓâ€¢ÆÆ’¶W“×·Bæ–GÒ6Æ74æÖS×¶fÆW‚—FV×2Ö6VçFW"76R×‚Ó"FW‡B×6ÒG·Bæ6ö×ÆWFVBòwFW‡B×¦–æ2Ósr¢wFW‡B×¦–æ2ÓCwÖÓà¢·Bæ6ö×ÆWFVBòÄ6†V6µ7V&R6Æ74æÖSÒ'rÓB‚ÓBFW‡BÖw&VVâÓS6‡&–æ²Ó"óâ¢Å7V&R6Æ74æÖSÒ'rÓB‚ÓB6‡&–æ²Ó"óçÐ¢Ç7â6Æ74æÖS×·Bæ6ö×ÆWFVBòvÆ–æR×F‡&÷Vv‚÷6—G’Ósr¢rwÓç·BçFW‡GÓÂ÷7ãà¢ÂöÆ“à¢’—Ð¢Â÷VÃà¢ÂöF—cà¢—Ð ¢¶76–væÖVçBçv÷&´æ÷FW2bb€¢ÆF—b6Æ74æÖSÒ&÷2×æVÂ×BÓ2ÓBFW‡B×¦–æ2ÓsÆVF–ær×&VÆ†VB#à¢Ç7â6Æ74æÖSÒ'FW‡B×‡2föçBÖ&öÆBFW‡B×¦–æ2ÓC&Æö6²Ö"Ó"WW&66RG&6¶–ær×v–FW"#äæ÷F—F–W3Â÷7ãà¢¶76–væÖVçBçv÷&´æ÷FW7Ð¢ÂöF—cà¢—Ð¢ÂöF—cà¢—Ð¢ÂöF—cà¢ÂöF—cà¢“°§Ð