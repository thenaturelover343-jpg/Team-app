import React, { useState, useEffect } from 'react';
import { User, Assignment, Shift, Customer, CorrectionRequest, Incident, PlannedShift, PushState, TeamNotification, formatDate, formatTime, localDateKey } from './types';
import { Calendar, Clock, MapPin, Plus, User as UserIcon, ListTodo, Loader2, Users, CheckSquare, Square, Download, BarChart2, CalendarDays, AlertTriangle, ShieldCheck } from 'lucide-react';
import { handleFirestoreError, OperationType } from './lib/firebase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { secureApi } from './lib/secureApi';
import WeekPlanner from './components/WeekPlanner';
import ControlCenter from './components/ControlCenter';

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<'control' | 'week' | 'planning' | 'timesheets' | 'reports' | 'customers' | 'team'>('control');
  
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plannedShifts, setPlannedShifts] = useState<PlannedShift[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [notifications, setNotifications] = useState<TeamNotification[]>([]);
  const [push, setPush] = useState<PushState>({ supported: false, enabled: false, publicKey: '' });
  const [loading, setLoading] = useState(true);

  const loadData = React.useCallback(async () => {
    const { data } = await secureApi.snapshot();
    setUsers(data.users);
    setShifts(data.shifts);
    setAssignments(data.assignments);
    setCustomers(data.customers);
    setPlannedShifts(data.plannedShifts);
    setIncidents(data.incidents);
    setCorrectionRequests(data.correctionRequests);
    setNotifications(data.notifications);
    setPush(data.push);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!active) return;
        await loadData();
      } catch (error) {
        console.error(error);
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [loadData]);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-900" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
      <div className="bg-white rounded-[16px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 p-1.5 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-1.5">
        <button onClick={() => setActiveTab('control')} className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all relative ${activeTab === 'control' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}><ShieldCheck className="w-4 h-4" /><span>Controle</span>{notifications.some(item => !item.readAt) && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}</button>
        <button
          onClick={() => setActiveTab('week')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'week' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Weekplanner</span>
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'planning' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
        >
          <Calendar className="w-4 h-4" />
          <span>Opdrachten</span>
        </button>
        <button
          onClick={() => setActiveTab('timesheets')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'timesheets' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
        >
          <Clock className="w-4 h-4" />
          <span>Urenregistratie (GPS)</span>
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'customers' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
        >
          <Users className="w-4 h-4" />
          <span>Klantenbeheer</span>
        </button>
        <button onClick={() => setActiveTab('reports')} className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'reports' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}><AlertTriangle className="w-4 h-4" /><span>Meldingen</span></button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-3 px-4 rounded-[12px] font-bold text-sm flex items-center justify-center space-x-2 transition-all ${activeTab === 'team' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-600 hover:bg-zinc-100/50'}`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Team</span>
        </button>
      </div>

      {activeTab === 'control' && <ControlCenter users={users} plannedShifts={plannedShifts} shifts={shifts} notifications={notifications} push={push} onChanged={loadData} />}
      {activeTab === 'week' && <WeekPlanner users={users} customers={customers} shifts={plannedShifts} onChanged={loadData} />}
      {activeTab === 'planning' && <PlanningTab users={users} assignments={assignments} customers={customers} />}
      {activeTab === 'timesheets' && <TimesheetsTab users={users} shifts={shifts} assignments={assignments} />}
      {activeTab === 'reports' && <AdminReportsTab users={users} incidents={incidents} corrections={correctionRequests} onChanged={loadData} />}
      {activeTab === 'customers' && <CustomersTab customers={customers} />}
      {activeTab === 'team' && <TeamTab users={users} />}
    </div>
  );
}

function AdminReportsTab({ users, incidents, corrections, onChanged }: { users: User[]; incidents: Incident[]; corrections: CorrectionRequest[]; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState('');
  const review = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    try { await secureApi.reviewCorrectionRequest(id, status); await onChanged(); } finally { setBusyId(''); }
  };
  const userName = (id: string) => users.find(user => user.id === id)?.name || 'Onbekende medewerker';
  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold text-zinc-900">Incidenten en correcties</h2><p className="text-sm text-zinc-500 mt-1">Behandel meldingen van medewerkers.</p></div>
    <section className="space-y-3"><h3 className="font-bold text-lg">Openstaande tijdcorrecties</h3>{corrections.filter(item => item.status === 'pending').length === 0 && <div className="bg-white border border-zinc-200 rounded-xl p-5 text-zinc-500">Geen openstaande verzoeken.</div>}{corrections.filter(item => item.status === 'pending').map(item => <article key={item.id} className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3"><div className="flex justify-between gap-3"><div><div className="font-bold">{userName(item.userId)}</div><div className="text-sm text-zinc-500">{formatDate(item.createdAt)}</div></div><span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full h-fit">In behandeling</span></div><p className="text-sm text-zinc-700">{item.reason}</p><div className="text-sm bg-zinc-50 rounded-xl p-3">{item.requestedClockIn && <div>Nieuwe start: <strong>{new Date(item.requestedClockIn).toLocaleString('nl-BE')}</strong></div>}{item.requestedClockOut && <div>Nieuwe einde: <strong>{new Date(item.requestedClockOut).toLocaleString('nl-BE')}</strong></div>}</div><div className="grid grid-cols-2 gap-3"><button disabled={busyId === item.id} onClick={() => review(item.id, 'rejected')} className="border border-red-200 text-red-700 rounded-xl py-3 font-bold">Afwijzen</button><button disabled={busyId === item.id} onClick={() => review(item.id, 'approved')} className="bg-zinc-900 text-white rounded-xl py-3 font-bold">Goedkeuren</button></div></article>)}</section>
    <section className="space-y-3"><h3 className="font-bold text-lg">Incidentmeldingen</h3>{incidents.length === 0 && <div className="bg-white border border-zinc-200 rounded-xl p-5 text-zinc-500">Nog geen incidenten gemeld.</div>}{incidents.map(item => <article key={item.id} className={`bg-white border rounded-2xl p-5 ${item.severity === 'high' ? 'border-red-300' : 'border-zinc-200'}`}><div className="flex justify-between gap-3 mb-2"><div className="font-bold">{item.category} · {userName(item.userId)}</div><span className="text-xs font-bold uppercase">{item.severity}</span></div><p className="text-sm text-zinc-700">{item.description}</p><div className="text-xs text-zinc-400 mt-3">{new Date(item.occurredAt).toLocaleString('nl-BE')}{item.latitude !== undefined ? ` · GPS ${item.latitude.toFixed(5)}, ${item.longitude?.toFixed(5)}` : ''}</div></article>)}</section>
  </div>;
}

function CustomersTab({ customers }: { customers: Customer[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    
    setIsSubmitting(true);
    try {
      await secureApi.saveCustomer({ name, address, phone, email, latitude: latitude === '' ? '' : Number(latitude), longitude: longitude === '' ? '' : Number(longitude) });
      setName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setLatitude('');
      setLongitude('');
      setIsAdding(false);
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
          className="flex items-center space-x-2 bg-zinc-900 text-white px-5 py-2.5 rounded-[12px] text-sm font-bold hover:bg-zinc-900 transition-colors shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] shadow-[0_4px_14px_0_rgb(0,0,0,0.1)]"
        >
          <Plus className="w-4 h-4" />
          <span>Nieuwe Klant</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-8 rounded-[24px] border border-zinc-200 shadow-lg shadow-blue-900/5 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-900"></div>
          <h3 className="font-bold text-lg text-zinc-800">Nieuwe Klant Toevoegen</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Naam (Klant of Evenement)</label>
              <input 
                type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Adres / Locatie</label>
              <input 
                type="text" value={address} onChange={e => setAddress(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Telefoonnummer (Optioneel)</label>
              <input 
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">E-mail (Optioneel)</label>
              <input 
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Breedtegraad (GPS)</label>
              <input type="number" step="any" min="-90" max="90" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="50.8503" className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Lengtegraad (GPS)</label>
              <input type="number" step="any" min="-180" max="180" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="4.3517" className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium" />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-3 text-zinc-600 font-bold hover:bg-zinc-100/50 rounded-[12px] transition-colors">Annuleren</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-zinc-900 text-white font-bold rounded-[12px] hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center space-x-2 shadow-md">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Opslaan</span>
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 divide-y divide-slate-100 overflow-hidden">
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
                {c.latitude !== undefined && c.longitude !== undefined && <div>GPS: {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PlanningTab({ users, assignments, customers }: { users: User[], assignments: Assignment[], customers: Customer[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [userId, setUserId] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [startTime, setStartTime] = useState('09:00');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');

  const employees = users.filter(u => u.role === 'employee');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !customerId || !date) return;
    
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (!selectedCustomer) return;

    setIsSubmitting(true);
    try {
      await secureApi.saveAssignment({ userId, date, startTime, customerId, description });
      setCustomerId('');
      setDescription('');
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'assignments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedAssignments = [...assignments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-2xl font-bold text-zinc-800 tracking-tight">Alle Opdrachten</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-2 bg-zinc-900 text-white px-5 py-2.5 rounded-[12px] text-sm font-bold hover:bg-zinc-900 transition-colors shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] shadow-[0_4px_14px_0_rgb(0,0,0,0.1)]"
        >
          <Plus className="w-4 h-4" />
          <span>Nieuwe Opdracht</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white p-8 rounded-[24px] border border-zinc-200 shadow-lg shadow-blue-900/5 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-900"></div>
          <h3 className="font-bold text-lg text-zinc-800">Opdracht Inplannen</h3>
          
          {customers.length === 0 ? (
             <div className="p-4 bg-amber-50 text-amber-800 rounded-[12px] border border-amber-200 text-sm font-medium">
               Voeg eerst een klant toe in het tabblad “Klantenbeheer” voordat je een opdracht kunt inplannen.
             </div>
          ) : employees.length === 0 ? (
             <div className="p-4 bg-amber-50 text-amber-800 rounded-[12px] border border-amber-200 text-sm font-medium">
               Er zijn nog geen medewerkers geregistreerd. Medewerkers moeten eerst een account aanmaken.
             </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Medewerker</label>
                  <select 
                    value={userId} onChange={e => setUserId(e.target.value)} required
                    className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
                  >
                    <option value="">Selecteer medewerker...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Datum</label>
                  <input 
                    type="date" value={date} onChange={e => setDate(e.target.value)} required
                    className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Starttijd</label>
                  <input 
                    type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                    className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Klant / Locatie</label>
                  <select 
                    value={customerId} onChange={e => setCustomerId(e.target.value)} required
                    className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
                  >
                    <option value="">Selecteer klant...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.address}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-zinc-700 mb-1.5">Beschrijving / Instructies</label>
                  <textarea 
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Leveren koelaanhangwagen en aansluiten..."
                    className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium resize-none h-28"
                  />
                </div>
              </div>
              
              <div className="pt-2 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-3 text-zinc-600 font-bold hover:bg-zinc-100/50 rounded-[12px] transition-colors">Annuleren</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-3 bg-zinc-900 text-white font-bold rounded-[12px] hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center space-x-2 shadow-md">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Inplannen</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 divide-y divide-slate-100 overflow-hidden">
        {sortedAssignments.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <ListTodo className="w-12 h-12 text-zinc-500 mb-4" />
            <p className="font-medium">Geen opdrachten gevonden.</p>
          </div>
        ) : (
          sortedAssignments.map(a => (
            <AdminAssignmentCard key={a.id} assignment={a} users={users} customers={customers} />
          ))
        )}
      </div>
    </div>
  );
}

function AdminAssignmentCard({ assignment, users, customers }: { assignment: Assignment, users: User[], customers: Customer[], key?: string | number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit State
  const [editUserId, setEditUserId] = useState(assignment.userId);
  const [editDate, setEditDate] = useState(assignment.date);
  const [editStartTime, setEditStartTime] = useState(assignment.startTime || '09:00');
  const [editCustomerId, setEditCustomerId] = useState(assignment.customerId);
  const [editDescription, setEditDescription] = useState(assignment.description);

  const emp = users.find(u => u.id === assignment.userId);
  const customer = customers.find(c => c.id === assignment.customerId);
  const employees = users.filter(u => u.role === 'employee');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId || !editCustomerId || !editDate) return;

    const selectedCustomer = customers.find(c => c.id === editCustomerId);
    if (!selectedCustomer) return;

    setIsSaving(true);
    try {
      await secureApi.saveAssignment({
        id: assignment.id,
        userId: editUserId,
        date: editDate,
        startTime: editStartTime,
        customerId: editCustomerId,
        description: editDescription
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `assignments/${assignment.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (confirm('Zeker dat je deze opdracht wilt verwijderen?')) {
      secureApi.deleteAssignment(assignment.id).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `assignments/${assignment.id}`)
      );
    }
  };

  if (isEditing) {
    return (
      <div className="p-6 bg-zinc-900/50 border-b border-zinc-200">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Medewerker</label>
              <select 
                value={editUserId} onChange={e => setEditUserId(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm"
              >
                <option value="">Selecteer medewerker...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Datum</label>
              <input 
                type="date" value={editDate} onChange={e => setEditDate(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Starttijd</label>
              <input 
                type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Klant / Locatie</label>
              <select 
                value={editCustomerId} onChange={e => setEditCustomerId(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium text-sm"
              >
                <option value="">Selecteer klant...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.address}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Beschrijving / Instructies</label>
              <textarea 
                value={editDescription} onChange={e => setEditDescription(e.target.value)}
                placeholder="Leveren koelaanhangwagen en aansluiten..."
                className="w-full border border-zinc-200 rounded-[12px] p-3 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-white transition-all font-medium resize-none h-24 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-zinc-600 font-bold hover:bg-zinc-100/50 rounded-lg transition-colors text-sm">Annuleren</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg hover:bg-zinc-900 transition-colors disabled:opacity-50 flex items-center space-x-2 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] text-sm">
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Opslaan</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-[#FAFAFA]/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center space-x-3 mb-1.5">
          <span className="font-bold text-lg text-zinc-900">{customer?.name || assignment.customerName || 'Onbekende Klant'}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            assignment.status === 'completed' ? 'bg-green-100 text-green-700' :
            assignment.status === 'arrived' ? 'bg-amber-100 text-amber-700' :
            'bg-zinc-100/50 text-zinc-600'
          }`}>
            {assignment.status === 'completed' ? 'Afgewerkt' : assignment.status === 'arrived' ? 'Ter plaatse' : 'Gepland'}
          </span>
        </div>
        {customer && (
          <div className="text-sm font-medium text-zinc-500 mb-3 flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{customer.address}</span>
          </div>
        )}
        <p className="text-zinc-600 mb-4 leading-relaxed">{assignment.description}</p>
        
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-zinc-500 bg-[#FAFAFA] inline-flex px-4 py-2 rounded-[12px] border border-zinc-200">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(assignment.date)}</span>
          </div>
          {assignment.startTime && (
            <div className="flex items-center space-x-2 border-l border-zinc-200/60 pl-4">
              <Clock className="w-4 h-4" />
              <span>{assignment.startTime}</span>
            </div>
          )}
          <div className="flex items-center space-x-2 border-l border-zinc-200/60 pl-4">
            <UserIcon className="w-4 h-4" />
            <span>{emp?.name || 'Onbekend'}</span>
          </div>
          <div className="flex items-center space-x-1 border-l border-zinc-200/60 pl-4">
            <button 
              onClick={() => setIsEditing(true)}
              className="text-zinc-900 hover:text-zinc-900 p-1.5 hover:bg-zinc-900 rounded-lg transition-colors"
              title="Opdracht bewerken"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button 
              onClick={handleDelete}
              className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
              title="Opdracht verwijderen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>
        </div>
      </div>
      
      {assignment.status === 'completed' && (
        <div className="bg-white rounded-[16px] p-4 text-sm md:w-72 shrink-0 border-2 border-zinc-200 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
          <div className="flex justify-between mb-1.5">
            <span className="text-zinc-500 font-medium">Aankomst:</span>
            <span className="font-bold text-zinc-900">{formatTime(assignment.arrivalTime!)}</span>
          </div>
          <div className="flex justify-between mb-3 pb-3 border-b border-zinc-200">
            <span className="text-zinc-500 font-medium">Vertrek:</span>
            <span className="font-bold text-zinc-900">{formatTime(assignment.departureTime!)}</span>
          </div>

          {assignment.tasks && assignment.tasks.length > 0 && (
            <div className="mb-4">
              <span className="font-bold text-zinc-400 block text-xs uppercase tracking-wider mb-2">Checklist</span>
              <ul className="space-y-1.5">
                {assignment.tasks.map(t => (
                  <li key={t.id} className={`text-xs flex items-center space-x-1.5 ${t.completed ? 'text-zinc-500' : 'text-zinc-400'}`}>
                     {t.completed ? <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                     <span className={t.completed ? 'line-through' : ''}>{t.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-zinc-600 leading-relaxed relative group">
            <span className="font-bold text-zinc-400 block text-xs uppercase tracking-wider mb-1">Notities</span>
            “{assignment.workNotes}”
          </div>
        </div>
      )}
    </div>
  );
}

function TimesheetsTab({ users, shifts, assignments = [] }: { users: User[], shifts: Shift[], assignments?: Assignment[] }) {
  const sortedShifts = [...shifts].sort((a, b) => b.clockIn - a.clockIn);
  const [chartReferenceTime] = useState(() => Date.now());

  // Chart data for last 30 days
  const thirtyDaysAgo = chartReferenceTime - 30 * 24 * 60 * 60 * 1000;
  const chartDataMap = new Map<string, { name: string, uren: number }>();
  
  users.forEach(u => {
    if (u.role === 'employee') {
      chartDataMap.set(u.id, { name: u.name, uren: 0 });
    }
  });

  shifts.forEach(shift => {
    if (shift.clockOut && shift.clockIn > thirtyDaysAgo) {
      const hours = (shift.clockOut - shift.clockIn) / (1000 * 60 * 60);
      const entry = chartDataMap.get(shift.userId);
      if (entry) {
        entry.uren += hours;
      }
    }
  });

  const chartData = Array.from(chartDataMap.values())
    .map(d => ({ ...d, uren: Number(d.uren.toFixed(2)) }))
    .filter(d => d.uren > 0)
    .sort((a, b) => b.uren - a.uren);

  const handleExportCSV = () => {
    // Helper to get Year-Week
    const getYearWeek = (timestamp: number) => {
      const date = new Date(timestamp);
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    };

    // Aggregate data
    type WeeklyReport = {
      Naam: string;
      Email: string;
      Week: string;
      Uren_Gewerkt: number;
      Opdrachten_Voltooid: number;
      Taken_Afgevinkt: number;
    };
    const reports: Record<string, WeeklyReport> = {};

    // Group shifts by User and Week
    shifts.forEach(shift => {
      if (!shift.clockOut) return; // Only count completed shifts
      const user = users.find(u => u.id === shift.userId);
      if (!user) return;
      const week = getYearWeek(shift.clockIn);
      const key = `${user.id}_${week}`;
      
      const hours = (shift.clockOut - shift.clockIn) / (1000 * 60 * 60);

      if (!reports[key]) {
        reports[key] = {
          Naam: user.name,
          Email: user.email,
          Week: week,
          Uren_Gewerkt: 0,
          Opdrachten_Voltooid: 0,
          Taken_Afgevinkt: 0
        };
      }
      reports[key].Uren_Gewerkt += hours;
    });

    // Group assignments by User and Week
    assignments.forEach(assignment => {
      if (assignment.status !== 'completed' || !assignment.departureTime) return;
      const user = users.find(u => u.id === assignment.userId);
      if (!user) return;
      const week = getYearWeek(assignment.departureTime);
      const key = `${user.id}_${week}`;

      if (!reports[key]) {
        reports[key] = {
          Naam: user.name,
          Email: user.email,
          Week: week,
          Uren_Gewerkt: 0,
          Opdrachten_Voltooid: 0,
          Taken_Afgevinkt: 0
        };
      }
      reports[key].Opdrachten_Voltooid += 1;
      
      if (assignment.tasks) {
        const completedTasks = assignment.tasks.filter(t => t.completed).length;
        reports[key].Taken_Afgevinkt += completedTasks;
      }
    });

    // Generate CSV
    const rows = Object.values(reports).sort((a, b) => a.Week.localeCompare(b.Week) || a.Naam.localeCompare(b.Naam));
    
    if (rows.length === 0) {
      alert("Er zijn geen afgeronde shifts of opdrachten om te exporteren.");
      return;
    }

    const headers = ['Naam', 'Email', 'Week', 'Uren Gewerkt', 'Opdrachten Voltooid', 'Taken Afgevinkt'];
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        `"${row.Naam}","${row.Email}","${row.Week}","${row.Uren_Gewerkt.toFixed(2)}","${row.Opdrachten_Voltooid}","${row.Taken_Afgevinkt}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rapportage_Uren_Taken_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const MapLink = ({ loc, label }: { loc?: { lat: number, lng: number }, label: string }) => {
    if (!loc) return <span className="text-zinc-400 text-xs font-medium">Geen GPS</span>;
    return (
      <a 
        href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center space-x-1.5 text-zinc-900 hover:text-zinc-900 text-xs font-bold bg-zinc-900 px-2.5 py-1.5 rounded-lg transition-colors border border-zinc-200/50"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span>{label}</span>
      </a>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-800 px-1 tracking-tight">Inklok Registraties</h2>
        <button
          onClick={handleExportCSV}
          className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-[12px] text-sm font-bold transition-colors shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]"
        >
          <Download className="w-4 h-4" />
          <span>Exporteer CSV (Uren & Taken)</span>
        </button>
      </div>

      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 bg-zinc-900 text-zinc-900 rounded-[12px]">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-lg text-zinc-800 tracking-tight">Gewerkte Uren (Laatste 30 dagen)</h3>
        </div>
        
        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="uren" 
                  name="Gewerkte Uren"
                  fill="#3b82f6" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
            <BarChart2 className="w-8 h-8 mb-3 opacity-20" />
            <p className="font-medium text-sm">Geen uren geregistreerd in de afgelopen 30 dagen.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[24px] shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFAFA]/50 border-b border-zinc-200/60 text-zinc-500 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-5">Medewerker</th>
                <th className="px-6 py-5">Datum</th>
                <th className="px-6 py-5">Ingeklokt</th>
                <th className="px-6 py-5">Uitgeklokt</th>
                <th className="px-6 py-5">Status & Opmerking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedShifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 font-medium">
                    Geen urenregistraties gevonden.
                  </td>
                </tr>
              ) : (
                sortedShifts.map(shift => {
                  const emp = users.find(u => u.id === shift.userId);
                  return (
                    <tr key={shift.id} className="hover:bg-[#FAFAFA]/50 transition-colors">
                      <td className="px-6 py-5 font-bold text-zinc-900">{emp?.name || 'Onbekend'}</td>
                      <td className="px-6 py-5 text-zinc-600 font-medium">{formatDate(shift.clockIn)}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col space-y-2">
                          <span className="font-bold text-zinc-900 text-base">{formatTime(shift.clockIn)}</span>
                          <MapLink loc={shift.clockInLoc} label="Toon Kaart" />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {shift.clockOut ? (
                          <div className="flex flex-col space-y-2">
                            <span className="font-bold text-zinc-900 text-base">{formatTime(shift.clockOut)}</span>
                            <MapLink loc={shift.clockOutLoc} label="Toon Kaart" />
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            Actief
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col space-y-2 items-start">
                          {shift.statusTag && shift.statusTag !== 'Normaal' && (
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${
                              shift.statusTag === 'Probleem gemeld' ? 'bg-red-50 text-red-700 border-red-200' :
                              shift.statusTag === 'Vertraagd' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-zinc-900 text-zinc-900 border-zinc-200'
                            }`}>
                              {shift.statusTag}
                            </span>
                          )}
                          {shift.notes ? (
                            <span className="text-sm text-zinc-600 line-clamp-2 max-w-xs" title={shift.notes}>{shift.notes}</span>
                          ) : (
                            <span className="text-sm text-zinc-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function TeamTab({ users }: { users: User[] }) {
  const [errorMsg, setErrorMsg] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const message = (error: unknown) => error instanceof Error ? error.message : 'De bewerking is mislukt.';

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setInviteLink('');
    setIsSubmitting(true);
    try {
      const result = await secureApi.inviteEmployee({ name, email, phone });
      setInviteLink(result.data.resetLink || 'uitgenodigd');
      setName('');
      setEmail('');
      setPhone('');
    } catch (error: unknown) {
      setErrorMsg(message(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRole = async (user: User) => {
    try {
      const newRole = user.role === 'admin' ? 'employee' : 'admin';
      await secureApi.setEmployeeAccess({ uid: user.id, role: newRole, active: user.active !== false });
    } catch (error: unknown) {
      setErrorMsg(message(error));
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await secureApi.setEmployeeAccess({ uid: user.id, role: user.role, active: user.active === false });
    } catch (error: unknown) {
      setErrorMsg(message(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-zinc-900">Team Beheer</h2>
      </div>
      <form onSubmit={invite} className="bg-white p-6 rounded-[24px] border border-zinc-200 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input value={name} onChange={event => setName(event.target.value)} required placeholder="Volledige naam" className="border border-zinc-200 rounded-[12px] p-3" />
        <input value={email} onChange={event => setEmail(event.target.value)} required type="email" placeholder="E-mailadres" className="border border-zinc-200 rounded-[12px] p-3" />
        <input value={phone} onChange={event => setPhone(event.target.value)} type="tel" placeholder="Telefoon (optioneel)" className="border border-zinc-200 rounded-[12px] p-3" />
        <button disabled={isSubmitting} className="bg-zinc-900 text-white font-bold rounded-[12px] p-3 disabled:opacity-50">
          {isSubmitting ? 'Bezig…' : 'Medewerker uitnodigen'}
        </button>
      </form>
      {inviteLink && (
        <div className="p-4 bg-green-50 text-green-800 rounded-[12px] border border-green-200 text-sm break-all">
          De medewerker is uitgenodigd en kan nu met dit Google-e-mailadres aanmelden.
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 rounded-[12px] border border-red-200 text-sm font-medium">
          {errorMsg}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className={`bg-white p-5 rounded-[24px] border shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] space-y-4 ${u.active === false ? 'border-red-200 opacity-70' : 'border-zinc-200'}`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <h3 className="font-bold text-zinc-900 truncate">{u.name}</h3>
                <p className="text-sm text-zinc-500 truncate">{u.email}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                {u.role === 'admin' ? 'Beheerder' : 'Medewerker'}
              </span>
              <button
                onClick={() => toggleRole(u)}
                className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
              >
                {u.role === 'admin' ? 'Maak Medewerker' : 'Maak Beheerder'}
              </button>
              <button
                onClick={() => toggleActive(u)}
                className={`text-sm font-medium transition-colors ${u.active === false ? 'text-green-700' : 'text-red-600'}`}
              >
                {u.active === false ? 'Activeren' : 'Deactiveren'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
