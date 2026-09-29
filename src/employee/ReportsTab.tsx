import React, { useState } from 'react';
import { Shift, CorrectionRequest, Incident, PlannedShift, getCurrentLocation, formatTime, formatDate } from '../types';
import { Loader2, Upload } from 'lucide-react';
import { secureApi } from '../lib/secureApi';

export function ReportsTab({ shifts, plannedShifts, incidents, corrections, onChanged }: { shifts: Shift[]; plannedShifts: PlannedShift[]; incidents: Incident[]; corrections: CorrectionRequest[]; onChanged: () => Promise<void> }) {
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
