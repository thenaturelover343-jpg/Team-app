import React, { useState, useEffect } from 'react';
import { localDateKey } from './types';
import { User as UserIcon, Calendar, CalendarDays, WifiOff, Bell, AlertTriangle } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { secureApi } from './lib/secureApi';
import { readOfflineQueue } from './lib/offlineQueue';
import NotificationCenter from './components/NotificationCenter';
import PrivacyPanel from './components/PrivacyPanel';
import { useLanguage } from './i18n';
import { useLiveRefresh } from './hooks/useLiveRefresh';
import { DashboardTab } from './employee/DashboardTab';
import { EmployeePlanningTab } from './employee/EmployeePlanningTab';
import { ReportsTab } from './employee/ReportsTab';
import { ProfileTab } from './employee/ProfileTab';

export default function EmployeeView() {
  const { user, snapshot, refreshUser } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planning' | 'reports' | 'notifications' | 'profile'>('dashboard');

  const shifts = snapshot?.shifts ?? [];
  const assignments = (snapshot?.assignments ?? []).filter(item => item.date === localDateKey());
  const plannedShifts = snapshot?.plannedShifts ?? [];
  const breaks = snapshot?.breaks ?? [];
  const attachments = snapshot?.attachments ?? [];
  const incidents = snapshot?.incidents ?? [];
  const correctionRequests = snapshot?.correctionRequests ?? [];
  const notifications = snapshot?.notifications ?? [];
  const push = snapshot?.push ?? { supported: false, enabled: false, publicKey: '' };
  const privacy = snapshot?.privacy ?? { controllerName: 'Barlicious & Koelverhuur', contactEmail: '', locationDays: 90, notificationDays: 180, auditDays: 730, errorDays: 180, backupDays: 365 };
  const accessEvents = snapshot?.accessEvents ?? [];
  const pilot = snapshot?.pilot ?? null;
  const pilotFeedback = snapshot?.pilotFeedback ?? [];
  const [queueCount, setQueueCount] = useState(0);
  const loadData = refreshUser;

  useLiveRefresh(loadData, Boolean(user), 30_000);

  useEffect(() => {
    const updateCount = () => setQueueCount(readOfflineQueue().length);
    const sync = async () => {
      if (!navigator.onLine) return updateCount();
      await secureApi.flushOfflineQueue();
      updateCount();
      await loadData().catch(() => undefined);
    };
    updateCount();
    void sync();
    window.addEventListener('online', sync);
    window.addEventListener('barlicious-queue-change', updateCount);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('barlicious-queue-change', updateCount); };
  }, [loadData]);

  if (!user) return null;

  const unacknowledgedCount = assignments.filter(a => a.status === 'pending' && a.acknowledged === false).length;

  return (
    <div className="employee-shell max-w-lg mx-auto w-full space-y-6 pb-28">
      {queueCount > 0 && <div className="ops-chip-warning w-full justify-start p-3"><WifiOff className="w-4 h-4" />{queueCount} actie{queueCount === 1 ? '' : 's'} wachten op internet.</div>}
      <div className="employee-nav ops-nav fixed bottom-3 left-3 right-3 z-50 max-w-lg mx-auto p-1.5">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`ops-nav-btn flex-col gap-1 relative ${activeTab === 'dashboard' ? 'ops-nav-btn-active' : ''}`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('today')}</span>
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {unacknowledgedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`ops-nav-btn flex-col gap-1 ${activeTab === 'planning' ? 'ops-nav-btn-active' : ''}`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>{t('planning')}</span>
        </button>
        <button onClick={() => setActiveTab('reports')} className={`ops-nav-btn flex-col gap-1 ${activeTab === 'reports' ? 'ops-nav-btn-active' : ''}`}><AlertTriangle className="w-4 h-4" /><span>{t('report')}</span></button>
        <button onClick={() => setActiveTab('notifications')} className={`ops-nav-btn flex-col gap-1 relative ${activeTab === 'notifications' ? 'ops-nav-btn-active' : ''}`}><Bell className="w-4 h-4" /><span>{t('messages')}</span>{notifications.some(item => !item.readAt) && <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />}</button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`ops-nav-btn flex-col gap-1 ${activeTab === 'profile' ? 'ops-nav-btn-active' : ''}`}
        >
          <UserIcon className="w-4 h-4" />
          <span>{t('profile')}</span>
        </button>
      </div>

      {activeTab === 'dashboard' && <DashboardTab userId={user.id} shifts={shifts} breaks={breaks} assignments={assignments} plannedShifts={plannedShifts} attachments={attachments} loading={!snapshot} onChanged={loadData} />}
      {activeTab === 'planning' && <EmployeePlanningTab userId={user.id} shifts={plannedShifts} attachments={attachments} onChanged={loadData} />}
      {activeTab === 'reports' && <ReportsTab shifts={shifts} plannedShifts={plannedShifts} incidents={incidents} corrections={correctionRequests} onChanged={loadData} />}
      {activeTab === 'notifications' && <NotificationCenter notifications={notifications} push={push} onChanged={loadData} />}
      {activeTab === 'profile' && <div className="space-y-6"><ProfileTab key={`${user.id}:${user.firstName || ''}:${user.lastName || ''}:${user.phone || ''}:${user.address || ''}`} user={user} /><PrivacyPanel privacy={privacy} accessEvents={accessEvents} pilot={pilot} feedback={pilotFeedback} onChanged={loadData} subtle /></div>}
    </div>
  );
}
