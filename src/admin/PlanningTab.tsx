import React, { useState } from 'react';
import { User, Assignment, Customer, PlannedShift, localDateKey, weekStartKey } from '../types';
import { Loader2, Plus, ListTodo } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';
import { AdminAssignmentCard } from './AdminAssignmentCard';

export function PlanningTab({ users, assignments, customers, plannedShifts = [], onChanged }: { users: User[]; assignments: Assignment[]; customers: Customer[]; plannedShifts?: PlannedShift[]; onChanged: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [date, setDate] = useState(localDateKey());
  const [startTime, setStartTime] = useState('09:00');
  const [customerId, setCustomerId] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [description, setDescription] = useState('');

  const employees = users.filter(u => u.active !== false && u.isEmployee !== false);

  const toggleMember = (id: string) => {
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    const selected = customers.find(c => c.id === id);
    setSiteAddress(selected?.address || '');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberIds.length || !customerId || !date) return;

    const selectedCustomer = customers.find(c => c.id === customerId);
    if (!selectedCustomer) return;

    setIsSubmitting(true);
    try {
      await secureApi.saveAssignment({
        memberIds,
        userId: memberIds[0],
        date,
        startTime,
        customerId,
        description,
        siteAddress: siteAddress.trim() || selectedCustomer.address,
      });
      setMemberIds([]);
      setCustomerId('');
      setSiteAddress('');
      setDescription('');
      setIsAdding(false);
      await onChanged();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'assignments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedAssignments = [...assignments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const weekStart = weekStartKey();
  const weekDiensten = plannedShifts
    .filter(s => s.status === 'published' && s.date >= weekStart)
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-1">
        <h2 className="ops-page-title tracking-tight">Alle Opdrachten</h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="ops-btn-primary w-full sm:w-auto space-x-2 px-5 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nieuwe Opdracht</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="ops-card p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-900"></div>
          <h3 className="font-bold text-lg text-zinc-800">Opdracht Inplannen</h3>

          {customers.length === 0 ? (
             <div className="ops-chip-warning w-full justify-start p-4 text-sm">
               Voeg eerst een klant toe in het tabblad “Klantenbeheer” voordat je een opdracht kunt inplannen.
             </div>
          ) : employees.length === 0 ? (
             <div className="ops-chip-warning w-full justify-start p-4 text-sm">
               Er zijn nog geen medewerkers geregistreerd. Medewerkers moeten eerst een account aanmaken.
             </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Medewerkers</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {employees.map(e => (
                      <label key={e.id} className={`ops-panel flex items-center gap-3 p-3 cursor-pointer ${memberIds.includes(e.id) ? 'border-cyan-400/60 bg-cyan-400/10' : ''}`}>
                        <input type="checkbox" checked={memberIds.includes(e.id)} onChange={() => toggleMember(e.id)} className="w-4 h-4 accent-cyan-500" />
                        <span className="font-semibold text-sm">{e.name}</span>
                      </label>
                    ))}
                  </div>
                  {!memberIds.length && <p className="text-xs text-amber-700 mt-1.5 font-medium">Selecteer minstens één medewerker.</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Datum</label>
                  <input
                    type="date" value={date} onChange={e => setDate(e.target.value)} required
                    className="ops-input w-full p-3.5 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Starttijd</label>
                  <input
                    type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                    className="ops-input w-full p-3.5 font-medium"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Klant</label>
                  <select
                    value={customerId} onChange={e => selectCustomer(e.target.value)} required
                    className="ops-input w-full p-3.5 font-medium"
                  >
                    <option value="">Selecteer klant...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.address}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Opdrachtadres</label>
                  <input
                    type="text"
                    value={siteAddress}
                    onChange={e => setSiteAddress(e.target.value)}
                    placeholder="Adres waar de job plaatsvindt (mag afwijken van klantadres)"
                    className="ops-input w-full p-3.5 font-medium"
                  />
                  <p className="text-xs text-zinc-500 mt-1.5">Standaard het klantadres. Pas aan als de job elders uitgevoerd wordt.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Beschrijving / Instructies</label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Leveren koelaanhangwagen en aansluiten..."
                    className="ops-input w-full p-3.5 font-medium resize-none h-28"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsAdding(false)} className="ops-btn-secondary px-5">Annuleren</button>
                <button type="submit" disabled={isSubmitting || !memberIds.length} className="ops-btn-primary px-8 space-x-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Inplannen{memberIds.length > 1 ? ` (${memberIds.length})` : ''}</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      <div className="ops-card divide-y divide-white/10 overflow-hidden">
        {sortedAssignments.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center gap-3">
            <ListTodo className="w-12 h-12 text-zinc-500 mb-1" />
            <p className="font-medium">Geen klantopdrachten gevonden.</p>
            <p className="text-sm max-w-md">Weekdiensten (planning met medewerkers) staan onder <span className="font-bold text-zinc-700">Weekplanner</span>, niet hier. Hier beheert u losse klantopdrachten.</p>
            {weekDiensten.length > 0 && (
              <div className="mt-2 w-full max-w-lg text-left ops-panel p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">Gepubliceerd deze week ({weekDiensten.length})</div>
                {weekDiensten.slice(0, 8).map(s => (
                  <div key={s.id} className="text-sm font-semibold text-zinc-800 flex justify-between gap-2">
                    <span>{s.date} · {s.title}</span>
                    <span className="text-zinc-500 font-medium">{s.startTime}–{s.endTime}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          sortedAssignments.map(a => (
            <AdminAssignmentCard key={a.id} assignment={a} users={users} customers={customers} onChanged={onChanged} />
          ))
        )}
      </div>
    </div>
  );
}
