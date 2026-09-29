import React, { useState, Suspense, lazy } from 'react';
import { User, Shift, Assignment, formatTime, formatDate } from '../types';
import { MapPin, Download, BarChart2 } from 'lucide-react';
import { TabFallback } from './TabFallback';

const HoursBarChart = lazy(() => import('../components/HoursBarChart'));

export function TimesheetsTab({ users, shifts, assignments = [] }: { users: User[], shifts: Shift[], assignments?: Assignment[] }) {
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
            <Suspense fallback={<TabFallback />}>
              <HoursBarChart data={chartData} />
            </Suspense>
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
