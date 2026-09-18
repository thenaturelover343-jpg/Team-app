'use client';

import React, { useState } from 'react';
import { Bell, BellOff, CheckCheck, Loader2, Send } from 'lucide-react';
import type { PushState, TeamNotification } from '../types';
import { secureApi } from '../lib/secureApi';
import { disablePush, enablePush, pushSupported } from '../lib/pushNotifications';

export default function NotificationCenter({ notifications, push, onChanged }: { notifications: TeamNotification[]; push: PushState; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const unread = notifications.filter(item => !item.readAt).length;

  const activate = async () => {
    setBusy('enable'); setMessage('');
    try {
      const subscription = await enablePush(push.publicKey);
      await secureApi.savePushSubscription(subscription.toJSON());
      await secureApi.testPush();
      setMessage('Pushmeldingen zijn actief. Er is een testmelding verstuurd.');
      await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Pushmeldingen konden niet worden geactiveerd.'); }
    finally { setBusy(''); }
  };

  const deactivate = async () => {
    setBusy('disable'); setMessage('');
    try {
      const endpoint = await disablePush();
      if (endpoint) await secureApi.deletePushSubscription(endpoint);
      setMessage('Pushmeldingen zijn op dit toestel uitgeschakeld.');
      await onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Uitschakelen is mislukt.'); }
    finally { setBusy(''); }
  };

  const markAll = async () => { setBusy('read'); await secureApi.markAllNotificationsRead(); await onChanged(); setBusy(''); };
  const markOne = async (id: string) => { await secureApi.markNotificationRead(id); await onChanged(); };

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-2xl font-bold text-zinc-900">Meldingen</h2><p className="text-sm text-zinc-500 mt-1">Planning, herinneringen en waarschuwingen op één plaats.</p></div>
      {unread > 0 && <span className="bg-red-600 text-white text-sm font-bold min-w-8 h-8 px-2 rounded-full flex items-center justify-center">{unread}</span>}
    </div>

    <section className="ops-card p-5 space-y-4">
      <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${push.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>{push.enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}</div><div><div className="font-bold">Echte pushmeldingen</div><div className="text-sm text-zinc-500">{push.enabled ? 'Actief op minstens één toestel' : 'Nog niet geactiveerd'}</div></div></div>
      {!push.supported && <p className="ops-chip-warning w-full justify-start p-3 text-sm">Push is tijdelijk niet geconfigureerd op de server (VAPID). Contacteer de beheerder.</p>}
      {!pushSupported() && <p className="ops-chip-warning w-full justify-start p-3 text-sm">Installeer de app op het beginscherm en open hem daarna opnieuw om pushmeldingen te gebruiken.</p>}
      {message && <p className="ops-panel p-3 text-sm font-semibold">{message}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={activate} disabled={busy !== '' || !push.supported || !pushSupported()} className="ops-btn-primary gap-2 py-3.5">{busy === 'enable' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}Meldingen activeren</button>
        {push.enabled && <button onClick={deactivate} disabled={busy !== ''} className="ops-btn-secondary">Op dit toestel uitzetten</button>}
      </div>
    </section>

    <div className="flex items-center justify-between"><h3 className="font-bold text-lg">Historiek</h3>{unread > 0 && <button onClick={markAll} disabled={busy !== ''} className="text-sm font-bold text-zinc-700 flex items-center gap-1.5"><CheckCheck className="w-4 h-4" />Alles gelezen</button>}</div>
    <div className="space-y-3">
      {notifications.length === 0 && <div className="ops-panel p-5 text-zinc-500">Nog geen meldingen.</div>}
      {notifications.map(item => <button key={item.id} onClick={() => !item.readAt && markOne(item.id)} className={`ops-panel w-full min-h-11 text-left p-4 transition-colors ${item.readAt ? '' : 'border-cyan-400/60 bg-cyan-400/10'}`}>
        <div className="flex justify-between gap-3"><div className="font-bold text-zinc-900">{item.title}</div>{!item.readAt && <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-blue-600 shrink-0" />}</div>
        <p className="text-sm text-zinc-600 mt-1">{item.body}</p>
        <div className="text-xs text-zinc-400 mt-2 flex items-center justify-between"><span>{new Date(item.createdAt).toLocaleString('nl-BE')}</span>{item.pushStatus === 'sent' && <span className="flex items-center gap-1"><Send className="w-3 h-3" />Push verstuurd</span>}</div>
      </button>)}
    </div>
  </div>;
}
