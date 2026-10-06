import React, { useState } from 'react';
import { User, Shift, Assignment, formatTime, formatDate } from '../types';
import { MapPin, Clock, Square, Loader2, History, Save, CheckSquare } from 'lucide-react';
import { secureApi } from '../lib/secureApi';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

export function ProfileTab({ user }: { user: User }) {
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [historyAssignments, setHistoryAssignments] = useState<Assignment[]>([]);
  const [historyShifts, setHistoryShifts] = useState<Shift[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const loadHistory = React.useCallback(async () => {
    try {
      const { data } = await secureApi.snapshot();
      setHistoryAssignments(data.assignments.filter(item => item.status === 'completed' && item.userId === user.id));
      setHistoryShifts(data.shifts.filter(item => item.userId === user.id));
    } catch (error) { console.error(error); }
    finally { setLoadingHistory(false); }
  }, [user.id]);
  useLiveRefresh(loadHistory, true, 30_000);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setIsUpdating(true); setMsg({ text: '', type: '' });
    try {
      const name = `${firstName} ${lastName}`.trim();
      await secureApi.updateProfile({ firstName, lastName, phone, address, name });
      setMsg({ text: 'Profiel succesvol bijgewerkt!', type: 'success' });
    } catch (err) {
      console.error(err);
      setMsg({ text: 'Er is een fout opgetreden bij het opslaan.', type: 'error' });
    } finally { setIsUpdating(false); }
  };
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
        <div className="p-8 space-y-6">
          <h2 className="text-xl font-bold text-zinc-800">Persoonlijke Gegevens</h2>
          {msg.text && (<div className={`p-4 rounded-[12px] text-sm font-medium border ${msg.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>)}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-bold text-zinc-700 mb-1.5">Voornaam</label><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Vul je voornaam in" className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" /></div>
              <div><label className="block text-sm font-bold text-zinc-700 mb-1.5">Achternaam</label><input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Vul je achternaam in" className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" /></div>
            </div>
            <div><label className="block text-sm font-bold text-zinc-700 mb-1.5">Telefoonnummer</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="04xx xx xx xx" className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" /></div>
            <div><label className="block text-sm font-bold text-zinc-700 mb-1.5">Adres</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} required placeholder="Straat, nummer, postcode, plaats" className="w-full border border-zinc-200 rounded-[24px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" /></div>
            <button type="submit" disabled={isUpdating} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 rounded-[24px] flex items-center justify-center space-x-2 transition-all shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] disabled:opacity-50">{isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}<span>Gegevens Opslaan</span></button>
          </form>
        </div>
      </div>
      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
        <div className="p-8 space-y-6">
           <div className="flex items-center space-x-2"><History className="w-6 h-6 text-zinc-400" /><h2 className="text-xl font-bold text-zinc-800">Mijn Historiek</h2></div>
           {loadingHistory ? (<div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-zinc-900" /></div>) : (
             <div className="space-y-5">
               {historyShifts.filter(s => s.clockOut).length === 0 ? (<p className="text-sm text-zinc-500">Geen voltooide shifts gevonden.</p>) : (
                 historyShifts.filter(s => s.clockOut).sort((a,b) => b.clockIn - a.clockIn).map(shift => {
                   const durationMs = shift.clockOut! - shift.clockIn;
                   const hours = Math.floor(durationMs / (1000 * 60 * 60));
                   const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                   const shiftDateObj = new Date(shift.clockIn);
                   const shiftDateStr = shiftDateObj.getFullYear() + '-' + String(shiftDateObj.getMonth()+1).padStart(2, '0') + '-' + String(shiftDateObj.getDate()).padStart(2, '0');
                   const shiftAssignments = historyAssignments.filter(a => a.date === shiftDateStr);
                   return (
                     <div key={shift.id} className="bg-[#FAFAFA] p-5 rounded-[24px] border border-zinc-200/60">
                       <div className="flex justify-between items-start mb-4"><div><div className="font-bold text-zinc-900 text-lg mb-1">{formatDate(shift.clockIn)}</div><div className="flex items-center space-x-2 text-sm text-zinc-600 font-medium"><Clock className="w-4 h-4 text-zinc-400" /><span>{formatTime(shift.clockIn)} - {formatTime(shift.clockOut!)}</span><span className="text-zinc-500">•</span><span className="text-zinc-900 font-bold">{hours}u {minutes}m gewerkt</span></div></div></div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                          <div className="bg-white p-3 rounded-[12px] border border-zinc-200 flex items-start space-x-3 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]"><div className="mt-0.5"><MapPin className="w-4 h-4 text-green-500" /></div><div><span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Ingeklokt Geocatie</span><div className="text-sm font-medium text-zinc-700 truncate">{shift.clockInLoc?.lat ? `${shift.clockInLoc.lat.toFixed(5)}, ${shift.clockInLoc.lng.toFixed(5)}` : 'Locatie niet beschikbaar'}</div><div className="text-xs text-zinc-500 mt-0.5 font-medium">@ {formatTime(shift.clockIn)}</div></div></div>
                          <div className="bg-white p-3 rounded-[12px] border border-zinc-200 flex items-start space-x-3 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]"><div className="mt-0.5"><MapPin className="w-4 h-4 text-amber-500" /></div><div><span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Uitgeklokt Geolocatie</span><div className="text-sm font-medium text-zinc-700 truncate">{shift.clockOutLoc?.lat ? `${shift.clockOutLoc.lat.toFixed(5)}, ${shift.clockOutLoc.lng.toFixed(5)}` : 'Locatie niet beschikbaar'}</div><div className="text-xs text-zinc-500 mt-0.5 font-medium">@ {formatTime(shift.clockOut!)}</div></div></div>
                       </div>
                       <div className="space-y-3">
                         <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-zinc-200/60 pb-2"><CheckSquare className="w-4 h-4" /><span>Afgeronde Opdrachten & Taken</span></span>
                         {shiftAssignments.length > 0 ? (shiftAssignments.map(assignment => {
                              const tasksTotal = assignment.tasks?.length || 0;
                              const tasksDone = assignment.tasks?.filter(t => t.completed).length || 0;
                              return (<div key={assignment.id} className="bg-white p-4 rounded-[12px] border border-zinc-200 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]"><div className="flex justify-between items-start mb-2"><span className="font-bold text-zinc-800">{assignment.customerName || 'Onbekende Klant'}</span>{tasksTotal > 0 ? (<span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tasksDone === tasksTotal ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>{tasksDone}/{tasksTotal} taken</span>) : (<span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-100/50 text-zinc-600">Geen taken</span>)}</div>{assignment.tasks && assignment.tasks.length > 0 && (<ul className="space-y-1.5 mt-3 pt-3 border-t border-zinc-200">{assignment.tasks.map(t => (<li key={t.id} className="flex items-start space-x-2 text-sm text-zinc-600">{t.completed ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : <Square className="w-4 h-4 shrink-0 mt-0.5 text-zinc-500" />}<span className={t.completed ? 'line-through text-zinc-400' : ''}>{t.text}</span></li>))}</ul>)}</div>);
                           })) : (<div className="text-sm text-zinc-500 italic px-2 py-1">Geen opdrachten gekoppeld aan deze shift.</div>)}
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
