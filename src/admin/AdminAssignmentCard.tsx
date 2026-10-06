import React, { useState } from 'react';
import { User, Assignment, Customer, formatTime, formatDate } from '../types';
import { MapPin, Clock, Square, Loader2, Calendar, CheckSquare, User as UserIcon } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';
import { CustomerSelect } from '../components/CustomerSelect';

export function AdminAssignmentCard({ assignment, users, customers, onChanged }: { assignment: Assignment; users: User[]; customers: Customer[]; onChanged: () => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editUserId, setEditUserId] = useState(assignment.userId);
  const [editDate, setEditDate] = useState(assignment.date);
  const [editStartTime, setEditStartTime] = useState(assignment.startTime || '09:00');
  const [editCustomerId, setEditCustomerId] = useState(assignment.customerId);
  const [editSiteAddress, setEditSiteAddress] = useState(assignment.siteAddress || assignment.customerAddress || '');
  const [editDescription, setEditDescription] = useState(assignment.description);
  const emp = users.find(u => u.id === assignment.userId);
  const customer = customers.find(c => c.id === assignment.customerId);
  const employees = users.filter(u => u.active !== false && u.isEmployee !== false);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId || !editCustomerId || !editDate) return;
    const selectedCustomer = customers.find(c => c.id === editCustomerId);
    if (!selectedCustomer) return;
    setIsSaving(true);
    try {
      await secureApi.saveAssignment({ id: assignment.id, userId: editUserId, date: editDate, startTime: editStartTime, customerId: editCustomerId, description: editDescription, siteAddress: editSiteAddress.trim() || selectedCustomer.address });
      setIsEditing(false);
      await onChanged();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assignments/${assignment.id}`);
    } finally { setIsSaving(false); }
  };
  const handleDelete = async () => {
    if (!window.confirm('Zeker dat je deze opdracht wilt verwijderen?')) return;
    try { await secureApi.deleteAssignment(assignment.id); await onChanged(); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `assignments/${assignment.id}`); }
  };
  if (isEditing) {
    return (
      <div className="p-6 bg-zinc-900/50 border-b border-zinc-200">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Medewerker</label><select value={editUserId} onChange={e => setEditUserId(e.target.value)} required className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm"><option value="">Selecteer medewerker...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Datum</label><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm" /></div>
            <div><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Starttijd</label><input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} required className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm" /></div>
            <div className="md:col-span-3"><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Klant</label><CustomerSelect customers={customers} value={editCustomerId} onChange={id => { setEditCustomerId(id); const selected = customers.find(c => c.id === id); if (selected) setEditSiteAddress(selected.address); }} required placeholderOption="Selecteer klant..." selectClassName="ops-input w-full p-3 font-medium text-sm" /></div>
            <div className="md:col-span-3"><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Opdrachtadres</label><input type="text" value={editSiteAddress} onChange={e => setEditSiteAddress(e.target.value)} className="ops-input w-full p-3 font-medium text-sm" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Beschrijving / Instructies</label><textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Leveren koelaanhangwagen en aansluiten..." className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium resize-none h-24 text-sm" /></div>
          </div>
          <div className="flex justify-end space-x-2 pt-2"><button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-zinc-600 font-bold hover:bg-zinc-100/50 rounded-lg transition-colors text-sm">Annuleren</button><button type="submit" disabled={isSaving} className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-50 flex items-center space-x-2 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] text-sm">{isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}<span>Opslaan</span></button></div>
        </form>
      </div>
    );
  }
  return (
    <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-[#FAFAFA]/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center space-x-3 mb-1.5"><span className="font-bold text-lg text-zinc-900">{customer?.name || assignment.customerName || 'Onbekende Klant'}</span><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${assignment.status === 'completed' ? 'bg-green-100 text-green-700' : assignment.status === 'arrived' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100/50 text-zinc-600'}`}>{assignment.status === 'completed' ? 'Afgewerkt' : assignment.status === 'arrived' ? 'Ter plaatse' : 'Gepland'}</span></div>
        <div className="text-sm font-medium text-zinc-500 mb-3 space-y-1">{(assignment.siteAddress || customer?.address) && (<div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /><div><div className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Opdrachtadres</div><span>{assignment.siteAddress || customer?.address}</span></div></div>)}{customer?.address && assignment.siteAddress && assignment.siteAddress !== customer.address && (<div className="text-xs text-zinc-500 pl-5">Klantadres: {customer.address}</div>)}</div>
        <p className="text-zinc-600 mb-4 leading-relaxed">{assignment.description}</p>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-zinc-500 bg-[#FAFAFA] inline-flex px-4 py-2 rounded-[12px] border border-zinc-200">
          <div className="flex items-center space-x-2"><Calendar className="w-4 h-4" /><span>{formatDate(assignment.date)}</span></div>
          {assignment.startTime && (<div className="flex items-center space-x-2 border-l border-zinc-200/60 pl-4"><Clock className="w-4 h-4" /><span>{assignment.startTime}</span></div>)}
          <div className="flex items-center space-x-2 border-l border-zinc-200/60 pl-4"><UserIcon className="w-4 h-4" /><span>{emp?.name || 'Onbekend'}</span></div>
          <div className="flex items-center space-x-1 border-l border-zinc-200/60 pl-4">
            <button onClick={() => setIsEditing(true)} className="text-zinc-900 hover:text-zinc-900 p-1.5 hover:bg-zinc-900 rounded-lg transition-colors" title="Opdracht bewerken"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
            <button onClick={handleDelete} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Opdracht verwijderen"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
          </div>
        </div>
      </div>
      {assignment.status === 'completed' && (
        <div className="bg-white rounded-[16px] p-4 text-sm md:w-72 shrink-0 border-2 border-zinc-200 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
          <div className="flex justify-between mb-1.5"><span className="text-zinc-500 font-medium">Aankomst:</span><span className="font-bold text-zinc-900">{formatTime(assignment.arrivalTime!)}</span></div>
          <div className="flex justify-between mb-3 pb-3 border-b border-zinc-200"><span className="text-zinc-500 font-medium">Vertrek:</span><span className="font-bold text-zinc-900">{formatTime(assignment.departureTime!)}</span></div>
          {assignment.tasks && assignment.tasks.length > 0 && (<div className="mb-4"><span className="font-bold text-zinc-400 block text-xs uppercase tracking-wider mb-2">Checklist</span><ul className="space-y-1.5">{assignment.tasks.map(t => (<li key={t.id} className={`text-xs flex items-center space-x-1.5 ${t.completed ? 'text-zinc-500' : 'text-zinc-400'}`}>{t.completed ? <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}<span className={t.completed ? 'line-through' : ''}>{t.text}</span></li>))}</ul></div>)}
          {assignment.workNotes && (<div className="text-zinc-600 leading-relaxed mb-2"><span className="font-bold text-zinc-400 block text-xs uppercase tracking-wider mb-1">Uitgevoerd werk</span>{assignment.workNotes}</div>)}
          {assignment.materials && (<div className="text-zinc-600 leading-relaxed mb-2"><span className="font-bold text-zinc-400 block text-xs uppercase tracking-wider mb-1">Materialen</span>{assignment.materials}</div>)}
          {assignment.completionNotes && (<div className="text-zinc-600 leading-relaxed"><span className="font-bold text-zinc-400 block text-xs uppercase tracking-wider mb-1">Extra notities</span>{assignment.completionNotes}</div>)}
        </div>
      )}
    </div>
  );
}
