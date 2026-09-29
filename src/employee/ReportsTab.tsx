import React, { useState } from 'react';
import { Shift, PlannedShift, Incident, CorrectionRequest, getCurrentLocation, formatDate, formatTime } from '../types';
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
  </div>;
}
