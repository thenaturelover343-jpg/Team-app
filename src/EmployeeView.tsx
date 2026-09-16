import React, { useState, useEffect, useRef } from 'react';
import { User, Shift, Assignment, getCurrentLocation, formatTime, formatDate, AssignmentTask, localDateKey, normalizeAssignment, normalizeShift } from './types';
import { MapPin, Clock, CheckCircle, Play, Square, Navigation2, FileText, Loader2, User as UserIcon, Calendar, History, Save, Plus, Trash2, CheckSquare } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import LiveLocationMap from './components/LiveLocationMap';
import { secureApi } from './lib/secureApi';

export default function EmployeeView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const alertedAssignments = useRef<Set<string>>(new Set());

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!assignments.length || !('Notification' in window) || Notification.permission !== 'granted') return;

    const intervalId = setInterval(() => {
      const now = new Date();
      assignments.forEach(assignment => {
        if (assignment.status === 'pending' && assignment.startTime && !alertedAssignments.current.has(assignment.id)) {
          const [hours, minutes] = assignment.startTime.split(':').map(Number);
          const assignmentTime = new Date();
          assignmentTime.setHours(hours, minutes, 0, 0);
          
          const timeDiff = assignmentTime.getTime() - now.getTime();
          const minutesDiff = Math.floor(timeDiff / (1000 * 60));
          
          if (minutesDiff > 0 && minutesDiff <= 15) {
            new Notification('Binnenkort verwacht', {
              body: `Uw opdracht bij ${assignment.customerName} start over ${minutesDiff} minuten.`,
              icon: '/favicon.ico'
            });
            alertedAssignments.current.add(assignment.id);
          }
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [assignments]);

  useEffect(() => {
    if (!user) return;
    
    const qShifts = query(
      collection(db, 'shifts'),
      where('userId', '==', user.id)
    );

    const unSubShifts = onSnapshot(qShifts, (snap) => {
      setShifts(snap.docs.map(d => normalizeShift(d.id, d.data())));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'shifts'));

    const todayStr = localDateKey();
    const qAssignments = query(
      collection(db, 'assignments'),
      where('userId', '==', user.id),
      where('date', '==', todayStr)
    );

    const unSubAssignments = onSnapshot(qAssignments, (snap) => {
      setAssignments(snap.docs.map(d => normalizeAssignment(d.id, d.data())));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'assignments'));

    return () => {
      unSubShifts();
      unSubAssignments();
    };
  }, [user]);

  if (!user) return null;

  const unacknowledgedCount = assignments.filter(a => a.status === 'pending' && a.acknowledged === false).length;

  return (
    <div className="max-w-lg mx-auto w-full space-y-6 pb-12">
      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 p-1.5 flex space-x-1.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all relative ${activeTab === 'dashboard' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
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
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'profile' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Mijn Profiel</span>
        </button>
      </div>

      {activeTab === 'dashboard' ? <DashboardTab shifts={shifts} assignments={assignments} loading={loading} /> : <ProfileTab user={user} />}
    </div>
  );
}

function DashboardTab({ shifts, assignments, loading }: { shifts: Shift[], assignments: Assignment[], loading: boolean }) {
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftStatus, setShiftStatus] = useState<'Normaal' | 'Vertraagd' | 'Gedeeltelijk afgerond' | 'Probleem gemeld'>('Normaal');
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );

  const activeShift = shifts.find(s => !s.clockOut);

  // Sync state if active shift already has notes (though usually set at clock out)
  useEffect(() => {
    if (activeShift) {
      if (activeShift.notes && !shiftNotes) setShiftNotes(activeShift.notes);
      if (activeShift.statusTag && shiftStatus === 'Normaal') setShiftStatus(activeShift.statusTag);
    }
  }, [activeShift]);

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
      await secureApi.clockIn(loc);
      setShiftNotes('');
      setShiftStatus('Normaal');
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
      await secureApi.clockOut({
        location: loc,
        notes: shiftNotes,
        statusTag: shiftStatus
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kon locatie niet ophalen. Zorg dat locatievoorzieningen aan staan.');
    } finally {
      setIsLocating(false);
    }
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

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
  };

  return (
    <div className="space-y-6">
      {notificationPermission === 'default' && (
        <div className="bg-zinc-100 border border-zinc-200 p-4 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-zinc-900 text-sm font-medium">
            Zet meldingen aan om een herinnering te krijgen 15 minuten voor een opdracht start.
          </div>
          <button 
            onClick={requestNotificationPermission}
            className="whitespace-nowrap bg-zinc-900 text-white px-4 py-2 rounded-[12px] font-bold text-sm hover:bg-zinc-900 transition-colors"
          >
            Meldingen aanzetten
          </button>
        </div>
      )}
      
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

function ProfileTab({ user }: { user: User }) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [availability, setAvailability] = useState(user.availability || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [historyAssignments, setHistoryAssignments] = useState<Assignment[]>([]);
  const [historyShifts, setHistoryShifts] = useState<Shift[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    // Fetch completed assignments for history
    const qAssignments = query(
      collection(db, 'assignments'),
      where('userId', '==', user.id),
      where('status', '==', 'completed')
    );
    const unSubA = onSnapshot(qAssignments, (snap) => {
      setHistoryAssignments(snap.docs.map(d => normalizeAssignment(d.id, d.data())));
    });

    // Fetch shifts for history
    const qShifts = query(
      collection(db, 'shifts'),
      where('userId', '==', user.id)
    );
    const unSubS = onSnapshot(qShifts, (snap) => {
      setHistoryShifts(snap.docs.map(d => normalizeShift(d.id, d.data())));
      setLoadingHistory(false);
    });

    return () => {
      unSubA();
      unSubS();
    };
  }, [user.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMsg({ text: '', type: '' });
    try {
      await updateDoc(doc(db, 'users', user.id), {
        name,
        phone,
        availability
      });
      setMsg({ text: 'Profiel succesvol bijgewerkt!', type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
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
    setTasks(assignment.tasks || []);
  }, [assignment.tasks]);

  const handleUpdate = async (updates: Partial<Assignment>) => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'assignments', assignment.id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assignments/${assignment.id}`);
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
