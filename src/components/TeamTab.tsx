import React, { useState } from 'react';
import type { InviteRole, User } from '../types';
import { isAdminUser, isEmployeeUser, roleLabelNl } from '../lib/roles';
import { secureApi } from '../lib/secureApi';
import { sendEmailSignInLink } from '../lib/firebase';
import { useLanguage } from '../i18n';

export default function TeamTab({ users, onChanged }: { users: User[]; onChanged?: () => Promise<void> }) {
  const { t } = useLanguage();
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('employee');
  const [inviteUrl, setInviteUrl] = useState('');
  const [sharePhone, setSharePhone] = useState('');
  const [mailState, setMailState] = useState<'sent' | 'failed' | ''>('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const message = (error: unknown) => error instanceof Error ? error.message : 'De bewerking is mislukt.';

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setNotice('');
    setInviteUrl('');
    setSharePhone('');
    setMailState('');
    setCopied(false);
    setIsSubmitting(true);
    try {
      const result = await secureApi.inviteEmployee({ name, email, phone, role: inviteRole });
      if (result.data.existingUser) {
        setNotice(t('inviteMerged'));
        setName('');
        setEmail('');
        setPhone('');
        setInviteRole('employee');
        await onChanged?.();
        return;
      }
      const link = result.data.inviteUrl || result.data.resetLink || '';
      setInviteUrl(link);
      setSharePhone(phone);
      let sent = false;
      try {
        await sendEmailSignInLink(email, link, false);
        sent = true;
      } catch {
        sent = false;
      }
      setMailState(sent ? 'sent' : 'failed');
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

  const whatsAppHref = (link: string, rawPhone: string) => {
    const text = encodeURIComponent(`Je bent uitgenodigd voor Barlicious Team. Activeer je account via deze link:\n${link}`);
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `32${digits.slice(1)}`;
    return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
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

  const setAccess = async (user: User, isAdmin: boolean, isEmployee: boolean) => {
    try {
      setErrorMsg('');
      await secureApi.setEmployeeAccess({
        uid: user.id,
        isAdmin,
        isEmployee,
        active: user.active !== false,
      });
      await onChanged?.();
    } catch (error: unknown) {
      setErrorMsg(message(error));
    }
  };

  const toggleActive = async (user: User) => {
    const turningOff = user.active !== false;
    if (turningOff && !window.confirm(`${user.name} deactiveren? Die persoon kan dan niet meer inloggen.`)) return;
    try {
      await secureApi.setEmployeeAccess({
        uid: user.id,
        isAdmin: isAdminUser(user),
        isEmployee: isEmployeeUser(user),
        active: user.active === false,
      });
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
          onChange={event => setInviteRole(event.target.value as InviteRole)}
          className="ops-input p-3 font-medium"
          aria-label="Rol"
        >
          <option value="employee">{t('roleEmployee')}</option>
          <option value="admin">{t('roleAdmin')}</option>
          <option value="both">{t('roleBoth')}</option>
        </select>
        <button disabled={isSubmitting} className="ops-btn-primary p-3 disabled:opacity-50">
          {isSubmitting ? '…' : t('inviteBtn')}
        </button>
      </form>
      {notice && <div className="ops-panel p-4 text-sm font-medium">{notice}</div>}
      {inviteUrl && (
        <div className="ops-panel p-4 text-sm space-y-3">
          <p>{mailState === 'sent' ? t('inviteMailOk') : t('inviteMailFail')}</p>
          <code className="block break-all text-xs opacity-80">{inviteUrl}</code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="ops-btn-secondary px-4">{copied ? t('copied') : t('copyLink')}</button>
            <a className="ops-btn-secondary px-4 inline-flex items-center" href={whatsAppHref(inviteUrl, sharePhone)} target="_blank" rel="noreferrer">{t('whatsappShare')}</a>
          </div>
        </div>
      )}
      {errorMsg && <div className="ops-chip-danger w-full justify-start px-4 py-3 text-sm">{errorMsg}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.length === 0 && <div className="ops-panel p-5 text-sm col-span-full">{t('emptyTeam')}</div>}
        {users.map(u => {
          const admin = isAdminUser(u);
          const employee = isEmployeeUser(u);
          return (
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
              <div className="pt-4 border-t border-white/10 space-y-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${admin ? 'ops-chip-info' : 'ops-chip-success'}`}>
                  {roleLabelNl({ role: admin ? 'admin' : 'employee', isEmployee: employee })}
                </span>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setAccess(u, !admin, employee || !admin)}
                    className="font-medium"
                  >
                    {admin ? t('removeAdmin') : t('makeAdmin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccess(u, admin, !employee)}
                    className="font-medium"
                    disabled={!admin && employee}
                    title={!admin && employee ? t('employeeRequired') : undefined}
                  >
                    {employee ? t('removeEmployee') : t('makeEmployee')}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(u)}
                    className={`font-medium ${u.active === false ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {u.active === false ? t('activate') : t('deactivate')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
