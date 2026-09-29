import React, { useState } from 'react';
import { Customer } from '../types';
import { MapPin, Loader2, Plus, Users } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';

export function CustomersTab({ customers, onChanged }: { customers: Customer[]; onChanged: () => Promise<void> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [btwNumber, setBtwNumber] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    
    setIsSubmitting(true);
    try {
      await secureApi.saveCustomer({ name, address, phone, email, btwNumber, latitude: latitude === '' ? '' : Number(latitude), longitude: longitude === '' ? '' : Number(longitude) });
      setName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setBtwNumber('');
      setLatitude('');
      setLongitude('');
      setIsAdding(false);
      await onChanged();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedCustomers = [...customers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Klanten & Locaties</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="ops-btn-primary space-x-2 px-5 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nieuwe Klant</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="ops-card p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-900"></div>
          <h3 className="font-bold text-lg text-zinc-800">Nieuwe Klant Toevoegen</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Naam (Klant of Evenement)</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)} required
                className="ops-input w-full p-3.5 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Adres / Locatie</label>
              <input 
                type="text" value={address} onChange={e => setAddress(e.target.value)} required
                className="ops-input w-full p-3.5 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Telefoonnummer (Optioneel)</label>
              <input 
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="ops-input w-full p-3.5 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">E-mail (Optioneel)</label>
              <input 
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="ops-input w-full p-3.5 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">BTW-nummer</label>
              <input 
                type="text" value={btwNumber} onChange={e => setBtwNumber(e.target.value)}
                placeholder="BE0123456789"
                className="ops-input w-full p-3.5 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Breedtegraad (GPS)</label>
              <input type="number" step="any" min="-90" max="90" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="50.8503" className="ops-input w-full p-3.5 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Lengtegraad (GPS)</label>
              <input type="number" step="any" min="-180" max="180" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="4.3517" className="ops-input w-full p-3.5 font-medium" />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsAdding(false)} className="ops-btn-secondary px-5">Annuleren</button>
            <button type="submit" disabled={isSubmitting} className="ops-btn-primary px-8 space-x-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Opslaan</span>
            </button>
          </div>
        </form>
      )}

      <div className="ops-card divide-y divide-white/10 overflow-hidden">
        {sortedCustomers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <Users className="w-12 h-12 text-zinc-500 mb-4" />
            <p className="font-medium">Nog geen klanten toegevoegd.</p>
          </div>
        ) : (
          sortedCustomers.map(c => (
            <div key={c.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAFAFA]/50 transition-colors">
              <div>
                <h3 className="font-bold text-lg text-zinc-900 mb-1">{c.name}</h3>
                <div className="text-sm font-medium text-zinc-500 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{c.address}</span>
                </div>
              </div>
              <div className="flex flex-col md:items-end text-sm text-zinc-600 font-medium space-y-1">
                {c.phone && <div>Tel: {c.phone}</div>}
                {c.email && <div>E-mail: {c.email}</div>}
                {c.btwNumber && <div>BTW-nummer: {c.btwNumber}</div>}
                {c.latitude !== undefined && c.longitude !== undefined && <div>GPS: {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
