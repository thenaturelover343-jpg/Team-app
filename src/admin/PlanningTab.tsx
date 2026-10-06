import React, { useState } from 'react';
import { User, Assignment, Customer, localDateKey } from '../types';
import { Loader2, Plus, ListTodo } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';
import { AdminAssignmentCard } from './AdminAssignmentCard';

export function PlanningTab({ users, assignments, customers, onChanged }: { users: User[]; assignments: Assignment[]; customers: Customer[]; onChanged: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [startTime, setStartTime] = useState('09:00');
  const [customerId, setCustomerId] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [description, setDescription] = useState('');

  const employees = users.filter(u => u.active !== false && u.isEmployee !== false);

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    const selected = customers.find(c => c.id === id);
    setSiteAddress(selected?.address || '');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !customerId || !date) return;
    
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (!selectedCustomer) return;

    setIsSubmitting(true);
    try {
      await secureApi.saveAssignment({ userId, date, startTime, customerId, description, siteAddress: siteAddress.trim() || selectedCustomer.address });
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
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Medewerker</label>
                  <select 
                    value={userId} onChange={e => setUserId(e.target.value)} required
                    className="ops-input w-full p-3.5 font-medium"
                  >
                    <option value="">Selecteer medewerker...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
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
                <button type="submit" disabled={isSubmitting} className="ops-btn-primary px-8 space-x-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Inplannen</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      <div className="ops-card divide-y divide-white/10 overflow-hidden">
        {sortedAssignments.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <ListTodo className="w-12 h-12 text-zinc-500 mb-4" />
            <p className="font-medium">Geen opdrachten gevonden.</p>
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
