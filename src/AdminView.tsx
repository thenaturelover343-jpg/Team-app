import React, { useState, Suspense, lazy } from 'react';
import { Calendar, Clock, User as UserIcon, Users, CalendarDays, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useLanguage } from './i18n';
import { useLiveRefresh } from './hooks/useLiveRefresh';
import { useAuth } from './hooks/useAuth';
import { TabFallback } from './admin/TabFallback';
import { PlanningTab } from './admin/PlanningTab';
import { TimesheetsTab } from './admin/TimesheetsTab';
import { AdminReportsTab } from './admin/AdminReportsTab';
import { CustomersTab } from './admin/CustomersTab';

const WeekPlanner = lazy(() => import('./components/WeekPlanner'));
const ControlCenter = lazy(() => import('./components/ControlCenter'));
const TeamTab = lazy(() => import('./components/TeamTab'));

export default function AdminView() {
  const { t } = useLanguage();
  const { snapshot, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'control' | 'week' | 'planning' | 'timesheets' | 'reports' | 'customers' | 'team'>('control');

  const users = snapshot?.users ?? [];
  const shifts = snapshot?.shifts ?? [];
  const assignments = snapshot?.assignments ?? [];
  const customers = snapshot?.customers ?? [];
  const plannedShifts = snapshot?.plannedShifts ?? [];
  const incidents = snapshot?.incidents ?? [];
  const correctionRequests = snapshot?.correctionRequests ?? [];
  const notifications = snapshot?.notifications ?? [];
  const push = snapshot?.push ?? { supported: false, enabled: false, publicKey: '' };
  const loadData = refreshUser;
  useLiveRefresh(loadData, true, 30_000);

  return (
    <div className="admin-shell max-w-6xl mx-auto w-full space-y-7 pb-12">
      <div className="admin-nav ops-nav p-1.5">
        <button onClick={() => setActiveTab('control')} className={`ops-nav-btn relative ${activeTab === 'control' ? 'ops-nav-btn-active' : ''}`}><ShieldCheck className="w-4 h-4" /><span>{t('navControl')}</span>{notifications.some(item => !item.readAt) && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />}</button>
        <button
          onClick={() => setActiveTab('week')}
          className={`ops-nav-btn ${activeTab === 'week' ? 'ops-nav-btn-active' : ''}`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>{t('navWeek')}</span>
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`ops-nav-btn ${activeTab === 'planning' ? 'ops-nav-btn-active' : ''}`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('navJobs')}</span>
        </button>
        <button
          onClick={() => setActiveTab('timesheets')}
          className={`ops-nav-btn ${activeTab === 'timesheets' ? 'ops-nav-btn-active' : ''}`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('navHours')}</span>
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`ops-nav-btn ${activeTab === 'customers' ? 'ops-nav-btn-active' : ''}`}
        >
          <Users className="w-4 h-4" />
          <span>{t('navCustomers')}</span>
        </button>
        <button onClick={() => setActiveTab('reports')} className={`ops-nav-btn ${activeTab === 'reports' ? 'ops-nav-btn-active' : ''}`}><AlertTriangle className="w-4 h-4" /><span>{t('navReports')}</span></button>
        <button
          onClick={() => setActiveTab('team')}
          className={`ops-nav-btn ${activeTab === 'team' ? 'ops-nav-btn-active' : ''}`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{t('navTeam')}</span>
        </button>
      </div>

      {activeTab === 'control' && <Suspense fallback={<TabFallback />}><ControlCenter users={users} plannedShifts={plannedShifts} shifts={shifts} assignments={assignments} notifications={notifications} push={push} onChanged={loadData} /></Suspense>}
      {activeTab === 'week' && <Suspense fallback={<TabFallback />}><WeekPlanner users={users} customers={customers} shifts={plannedShifts} onChanged={loadData} /></Suspense>}
      {activeTab === 'planning' && <PlanningTab users={users} assignments={assignments} customers={customers} plannedShifts={plannedShifts} onChanged={loadData} />}
      {activeTab === 'timesheets' && <TimesheetsTab users={users} shifts={shifts} assignments={assignments} />}
      {activeTab === 'reports' && <AdminReportsTab users={users} incidents={incidents} corrections={correctionRequests} onChanged={loadData} />}
      {activeTab === 'customers' && <CustomersTab customers={customers} onChanged={loadData} />}
      {activeTab === 'team' && <Suspense fallback={<TabFallback />}><TeamTab users={users} onChanged={loadData} /></Suspense>}
    </div>
  );
}
