import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Assignment, Attachment, AssignmentTask, getCurrentLocation, formatTime } from '../types';
import { MapPin, Clock, CheckCircle, Square, FileText, Loader2, Plus, Trash2, CheckSquare, Upload, Download } from 'lucide-react';
import { secureApi } from '../lib/secureApi';

const LiveLocationMap = dynamic(() => import('../components/LiveLocationMap'), { ssr: false });

export function AssignmentCard({ assignment, attachments, onChanged }: { assignment: Assignment; attachments: Attachment[]; onChanged: () => Promise<void> }) {
  const [notes, setNotes] = useState(assignment.workNotes || '');
  const [materials, setMaterials] = useState(assignment.materials || '');
  const [completionNotes, setCompletionNotes] = useState(assignment.completionNotes || '');
  const [tasks, setTasks] = useState<AssignmentTask[]>(assignment.tasks || []);
  const [newTaskText, setNewTaskText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [photoError, setPhotoError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTasks(assignment.tasks || []);
      setNotes(assignment.workNotes || '');
      setMaterials(assignment.materials || '');
      setCompletionNotes(assignment.completionNotes || '');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [assignment.tasks, assignment.workNotes, assignment.materials, assignment.completionNotes]);
  const jobAddress = assignment.siteAddress || assignment.customerAddress || '';
  const persistDetails = async (nextTasks = tasks, nextNotes = notes, nextMaterials = materials, nextCompletion = completionNotes) => {
    await secureApi.updateAssignmentDetails(assignment.id, nextTasks, nextNotes, nextMaterials, nextCompletion);
  };
  const handleUpdate = async (updates: Partial<{ tasks: AssignmentTask[]; workNotes: string; materials: string; completionNotes: string }>) => {
    setIsUpdating(true);
    try {
      const nextTasks = updates.tasks || tasks;
      const nextNotes = typeof updates.workNotes === 'string' ? updates.workNotes : notes;
      const nextMaterials = typeof updates.materials === 'string' ? updates.materials : materials;
      const nextCompletion = typeof updates.completionNotes === 'string' ? updates.completionNotes : completionNotes;
      await persistDetails(nextTasks, nextNotes, nextMaterials, nextCompletion);
      await onChanged();
    } catch (err) { console.error(err); }
    finally { setIsUpdating(false); }
  };
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask = { id: Date.now().toString(), text: newTaskText.trim(), completed: false };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks); setNewTaskText('');
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
      await onChanged();
    } finally { setIsUpdating(false); }
  };
  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError(''); setIsUpdating(true);
    try {
      for (const file of Array.from(files).slice(0, 5)) await secureApi.uploadAttachment('assignment', assignment.id, file);
      await onChanged();
    } catch (err) { setPhotoError(err instanceof Error ? err.message : 'Uploaden mislukt.'); }
    finally { setIsUpdating(false); }
  };
  const downloadPhoto = async (item: Attachment) => {
    const blob = await secureApi.downloadAttachment(item.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = item.filename; link.click();
    URL.revokeObjectURL(url);
  };
  const handleComplete = async () => {
    setPhotoError('');
    if (!notes.trim()) { setPhotoError('Vul in wat is gedaan voordat je afrondt.'); return; }
    setIsUpdating(true);
    try {
      await persistDetails();
      const location = await getCurrentLocation();
      await secureApi.transitionAssignment({ assignmentId: assignment.id, status: 'completed', location, notes: notes.trim(), workNotes: notes.trim(), materials, completionNotes });
      await onChanged();
    } catch (err) { setPhotoError(err instanceof Error ? err.message : 'Afronden mislukt.'); }
    finally { setIsUpdating(false); }
  };
  return (
    <div className={`ops-card overflow-hidden transition-all ${assignment.status === 'completed' ? 'border-emerald-400/60' : ''}`}>
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1"><h3 className="font-bold text-lg text-zinc-900 break-words">{assignment.customerName || 'Onbekende Klant'}</h3>{assignment.startTime && (<span className="bg-zinc-100 text-zinc-600 text-xs font-bold px-2 py-1 rounded-md inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /><span>{assignment.startTime}</span></span>)}</div>
            {jobAddress && (<div className="text-sm text-zinc-500 mt-2 flex items-start gap-1.5"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /><div><div className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Opdrachtadres</div><div className="break-words">{jobAddress}</div>{assignment.customerAddress && assignment.siteAddress && assignment.siteAddress !== assignment.customerAddress && (<div className="text-xs mt-1">Klantadres: {assignment.customerAddress}</div>)}</div></div>)}
            <p className="text-zinc-500 mt-1.5 leading-relaxed break-words">{assignment.description}</p>
          </div>
          {assignment.status === 'completed' && (<span className="bg-green-100 text-green-700 p-2 rounded-full shrink-0"><CheckCircle className="w-6 h-6" /></span>)}
        </div>
        {assignment.status === 'pending' && (<div className="space-y-3"><p className="text-sm text-zinc-600">Aankomst start vanzelf als de dag loopt en dit scherm open blijft. Lukt de gps niet, leg de aankomst dan zelf vast.</p><button onClick={handleArrive} disabled={isUpdating} className="text-sm font-bold text-zinc-700 underline">{isUpdating ? 'Bezig…' : 'Zelf aankomst vastleggen'}</button></div>)}
        {assignment.status === 'arrived' && (
          <div className="space-y-5 pt-4 border-t border-zinc-200">
            <div className="ops-panel flex items-center space-x-2 text-sm font-medium p-3.5"><Clock className="w-4 h-4 text-zinc-900" /><span>Aangekomen om {formatTime(assignment.arrivalTime!)}{assignment.departureTime ? ` · vertrokken om ${formatTime(assignment.departureTime)}` : ''}</span></div>
            <div className="space-y-3">
              <label className="text-sm font-bold text-zinc-800 flex items-center space-x-2"><CheckSquare className="w-4 h-4 text-zinc-400" /><span>Checklist / Uitgevoerde taken</span></label>
              {tasks.length > 0 && (<div className="space-y-2 mb-3">{tasks.map(task => (<div key={task.id} className="ops-panel flex items-center justify-between gap-2 p-3"><label className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"><input type="checkbox" checked={task.completed} onChange={() => handleToggleTask(task.id)} className="w-5 h-5 text-zinc-900 rounded border-zinc-200 focus:ring-zinc-900/10 cursor-pointer shrink-0" /><span className={`text-sm font-medium break-words ${task.completed ? 'text-zinc-400 line-through' : 'text-zinc-700'}`}>{task.text}</span></label><button onClick={() => handleDeleteTask(task.id)} className="text-zinc-400 hover:text-red-500 transition-colors p-1 shrink-0" title="Taak verwijderen"><Trash2 className="w-4 h-4" /></button></div>))}</div>)}
              <form onSubmit={handleAddTask} className="flex items-center gap-2"><input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Nieuwe taak toevoegen..." className="ops-input flex-1 min-w-0 p-3 text-sm" /><button type="submit" disabled={!newTaskText.trim() || isUpdating} className="ops-btn-primary min-w-11 p-3 shrink-0"><Plus className="w-5 h-5" /></button></form>
            </div>
            <div className="space-y-2.5 pt-2 border-t border-zinc-200"><label className="text-base font-extrabold text-zinc-900 flex items-center space-x-2"><FileText className="w-5 h-5 text-zinc-900" /><span>Wat is gedaan</span></label><p className="text-xs text-zinc-500">Verplicht bij afronden. Voorbeeld: twee kranen gekuist + materiaal.</p><textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => handleUpdate({ workNotes: notes })} className="ops-input w-full p-4 resize-none text-base" rows={4} required placeholder="Bv. twee kranen gekuist, pakking vervangen..." /></div>
            <div className="space-y-2"><label className="text-sm font-bold text-zinc-800 flex items-center gap-2"><Upload className="w-4 h-4 text-zinc-400" />Foto’s van de opdracht</label>{attachments.length > 0 && (<div className="space-y-2">{attachments.map(item => (<button key={item.id} type="button" onClick={() => downloadPhoto(item)} className="w-full text-left flex items-center gap-2 text-sm font-semibold text-zinc-700 ops-panel rounded-lg p-2"><Download className="w-4 h-4 shrink-0" /><span className="truncate">{item.filename}</span></button>))}</div>)}<label className="flex items-center justify-center gap-2 border border-dashed border-zinc-300 rounded-lg p-3 text-sm font-bold text-zinc-600 cursor-pointer w-full"><Upload className="w-4 h-4" />Foto toevoegen<input type="file" accept="image/*" multiple className="hidden" onChange={event => uploadPhotos(event.target.files)} /></label>{photoError && <div className="ops-chip-danger w-full justify-start p-2 text-xs">{photoError}</div>}</div>
            <div className="pt-2"><span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Locatie Verificatie Vertrek</span><LiveLocationMap /></div>
            {photoError && <div className="ops-chip-danger w-full justify-start p-3 text-sm font-semibold">{photoError}</div>}
            <button onClick={handleComplete} disabled={isUpdating} className="ops-btn-primary w-full space-x-2 py-4 mt-2">{isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}<span>Markeer als klaar</span></button>
          </div>
        )}
        {assignment.status === 'completed' && (
          <div className="pt-4 border-t border-green-100/50 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4"><div className="ops-panel p-3"><span className="text-zinc-500 block text-xs font-medium mb-1 uppercase tracking-wider">Aankomst</span><span className="font-bold text-zinc-900">{formatTime(assignment.arrivalTime!)}</span></div><div className="ops-panel p-3"><span className="text-zinc-500 block text-xs font-medium mb-1 uppercase tracking-wider">Vertrek</span><span className="font-bold text-zinc-900">{formatTime(assignment.departureTime!)}</span></div></div>
            {assignment.tasks && assignment.tasks.length > 0 && (<div className="ops-panel mt-4 p-4"><span className="text-xs font-bold text-zinc-400 block mb-3 uppercase tracking-wider">Uitgevoerde Taken</span><ul className="space-y-2">{assignment.tasks.map(t => (<li key={t.id} className={`flex items-center space-x-2 text-sm ${t.completed ? 'text-zinc-700' : 'text-zinc-400'}`}>{t.completed ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0" /> : <Square className="w-4 h-4 shrink-0" />}<span className={t.completed ? 'line-through opacity-70' : ''}>{t.text}</span></li>))}</ul></div>)}
            {assignment.workNotes && (<div className="ops-panel mt-3 p-4 text-zinc-700 leading-relaxed"><span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Uitgevoerd werk</span>{assignment.workNotes}</div>)}
            {assignment.materials && (<div className="ops-panel mt-3 p-4 text-zinc-700 leading-relaxed"><span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Materialen</span>{assignment.materials}</div>)}
            {assignment.completionNotes && (<div className="ops-panel mt-3 p-4 text-zinc-700 leading-relaxed"><span className="text-xs font-bold text-zinc-400 block mb-2 uppercase tracking-wider">Extra notities</span>{assignment.completionNotes}</div>)}
            {attachments.length > 0 && (<div className="ops-panel mt-3 p-4 space-y-2"><span className="text-xs font-bold text-zinc-400 block uppercase tracking-wider">Foto’s</span>{attachments.map(item => (<button key={item.id} type="button" onClick={() => downloadPhoto(item)} className="w-full text-left flex items-center gap-2 text-sm font-semibold"><Download className="w-4 h-4" /><span className="truncate">{item.filename}</span></button>))}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
