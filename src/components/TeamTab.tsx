import React, { useState } from 'react';
import type { User } from '../types';
import { secureApi } from '../lib/secureApi';
import { sendEmailSignInLink } from '../lib/firebase';
import { useLanguage } from '../i18n';

export default function TeamTab({ users, onChanged }: { users: User[]; onChanged?: () => Promise<void> }) {
  const { t } = useLanguage();
  const [errorMsg, setErrorMsg] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const message = (error: unknown) => error instanceof Error ? error.message : 'De bewerking is mislukt.';

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setInviteUrl('');
    setCopied(false);
    setIsSubmitting(true);
    try {
      const result = await secureApi.inviteEmployee({ name, email, phone, role: inviteRole });
      setInviteUrl(result.data.inviteUrl || result.data.resetLink || '');
      try { await sendEmailSignInLink(email, result.data.inviteUrl, false); } catch { /* link blijft kopieerbaar als mail niet vertrekt */ }
      setName('');
      setEmail('');
      setPhone('');
      setInviteRole('employee');
      await onChanged?.();
    } catch (error: unknown) {
      setErrorMsg(message(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const toggleRole = async (user: User) => {
    try {
      const newRole = user.role === 'admin' ? 'employee' : 'admin';
      await secureApi.setEmployeeAccess({ uid: user.id, role: newRole, active: user.active !== false });
      await onChanged?.();
    } catch (error: unknown) {
      setErrorMsg(message(error));
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await secureApi.setEmployeeAccess({ uid: user.id, role: user.role, active: user.active === false });
      await onChanged?.();
    } catch (error: unknown) {
      setErrorMsg(message(error));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t('teamTitle')}</h2>
      <form onSubmit={invite} className="ops-card p-6 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input value={name} onChange={event => setName(event.target.value)} required placeholder={t('fullName')} className="ops-input p-3" />
        <input value={email} onChange={event => setEmail(event.target.value)} required type="email" placeholder={t('email')} className="ops-input p-3" />
        <input value={phone} onChange={event => setPhone(event.target.value)} type="tel" placeholder={t('phoneOptional')} className="ops-input p-3" />
        <select
          value={inviteRole}
          onChange={event => setInviteRole(event.target.value === 'admin' ? 'admin' : 'employee')}
          className="ops-input p-3 font-medium"
          aria-label="Rol"
        >
          <option value="employee">{t('roleEmployee')}</option>
          <option value="admin">{t('roleAdmin')}</option>
        </select>
        <button disabled={isSubmitting} className="ops-btn-primary p-3 disabled:opacity-50">
          {isSubmitting ? '…' : t('inviteBtn')}
        </button>
      </form>
      {inviteUrl && (
        <div className="ops-panel p-4 text-sm space-y-3">
          <p>{t('inviteOk')}</p>
          <code className="block break-all text-xs opacity-80">{inviteUrl}</code>
          <button type="button" onClick={copy} className="ops-btn-secondary px-4">{copied ? t('copied') : t('copyLink')}</button>
        </div>
      )}
      {errorMsg && <div className="ops-chip-danger w-full justify-start px-4 py-3 text-sm">{errorMsg}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.length === 0 && <div className="ops-panel p-5 text-sm col-span-full">{t('emptyTeam')}</div>}
        {users.map(u => (
          <div key={u.id} className={`ops-card p-5 space-y-4 ${u.active === false ? 'opacity-70' : ''}`}>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 ops-panel rounded-full flex items-center justify-center font-bold">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <h3 className="font-bold truncate">{u.name}</h3>
                <p className="text-sm text-zinc-500 truncate">{u.email}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'ops-chip-info' : 'ops-chip-success'}`}>
                {u.role === 'admin' ? t('roleAdmin') : t('roleEmployee')}
              </span>
              <button onClick={() => toggleRole(u)} className="text-sm font-medium">
                {u.role === 'admin' ? t('makeEmployee') : t('makeAdmin')}
              </button>
              <button
                onClick={() => toggleActive(u)}
                className={`text-sm font-medium ${u.active === false ? 'text-green-400' : 'text-red-400'}`}
              >
                {u.active === false ? t('activate') : t('deactivate')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
