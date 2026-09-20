import React, { Suspense, lazy, useEffect, useState } from 'react';
import { UserCircle, Loader2, LogOut, Eye, EyeOff } from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AppUpdateBanner } from './components/AppUpdateBanner';
import { AuthProvider, useAuth } from './hooks/useAuth';
import {
  completeEmailLinkSignIn,
  loginWithEmail,
  loginWithGoogle,
  logout,
  mapAuthErrorToDutch,
  pendingEmailLinkSignIn,
  registerWithEmail,
  resetPassword,
  sendEmailSignInLink,
} from './lib/firebase';
import { LanguageProvider, LanguageSwitch, useLanguage } from './i18n';
import { secureApi } from './lib/secureApi';
import { readInviteTokenFromLocation } from './lib/inviteLink';
import { readSessionHint, type SessionHint } from './lib/sessionHint';

const EmployeeView = lazy(() => import('./EmployeeView'));
const AdminView = lazy(() => import('./AdminView'));

function BootAppShell({ hint }: { hint: SessionHint }) {
  const { t } = useLanguage();
  return (
    <div className="app-shell app-boot-shell min-h-screen font-sans">
      <header className="topbar sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="min-h-[72px] py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="brand-mark flex items-center justify-center font-bold shrink-0">
                <img src="/brand-logo.svg" alt="" className="w-full h-full object-contain rounded-[inherit]" />
              </div>
              <span className="font-bold text-lg tracking-tight">Team</span>
            </div>
            <div className="user-pill flex items-center gap-2 pl-2 pr-3 py-1.5">
              <span className="text-sm font-bold truncate max-w-[120px]">{hint.name}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="content-shell max-w-6xl mx-auto px-4 py-8 flex min-h-[40vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
        <p className="font-medium tracking-wide text-zinc-500">{t('sessionRestore')}</p>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.4 3.5-5.1 3.5-3.1 0-5.6-2.5-5.6-5.6S8.9 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z" />
    </svg>
  );
}

function AppContent() {
  const { user, loading, accessError, redirectAuthError } = useAuth();
  const { locale, t } = useLanguage();
  const fr = locale === 'fr';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [inviteToken] = useState(() => readInviteTokenFromLocation());
  const [invite, setInvite] = useState<{ email: string; name: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));
  const [creating, setCreating] = useState(false);
  const [sessionHint] = useState(() => readSessionHint());
  const [needsEmailForLink, setNeedsEmailForLink] = useState(false);
  const [viewAsEmployee, setViewAsEmployee] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem('adminViewAsEmployee') === '1';
  });

  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    secureApi.lookupInvite(inviteToken).then(result => {
      if (!active) return;
      setInvite(result.data);
      setEmail(result.data.email);
      setInviteLoading(false);
    }).catch(error => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : t('inviteInvalid'));
      setInviteLoading(false);
    });
    return () => { active = false; };
  }, [inviteToken, t]);

  useEffect(() => {
    if (pendingEmailLinkSignIn()) {
      try {
        if (!window.localStorage.getItem('barliciousEmailForSignIn')) setNeedsEmailForLink(true);
      } catch {
        setNeedsEmailForLink(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!invite || !pendingEmailLinkSignIn()) return;
    let active = true;
    setIsSubmitting(true);
    completeEmailLinkSignIn(invite.email).then(() => {
      if (active) setNeedsEmailForLink(false);
    }).catch(error => {
      if (active) setAuthError(mapAuthErrorToDutch(error));
    }).finally(() => {
      if (active) setIsSubmitting(false);
    });
    return () => { active = false; };
  }, [invite]);

  const toggleEmployeePreview = () => {
    setViewAsEmployee(prev => {
      const next = !prev;
      try { sessionStorage.setItem('adminViewAsEmployee', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setIsSubmitting(true);
    try {
      if (pendingEmailLinkSignIn()) {
        await completeEmailLinkSignIn(email);
        setNeedsEmailForLink(false);
        return;
      }
      const wantsCreate = creating || Boolean(invite);
      if (wantsCreate) {
        if (password !== password2) {
          setAuthError(t('passwordsMismatch'));
          return;
        }
        try {
          await registerWithEmail(email, password);
        } catch (err: unknown) {
          const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
          if (code === 'auth/email-already-in-use') await loginWithEmail(email, password);
          else throw err;
        }
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: unknown) {
      console.error(err);
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setAuthError('E-mail of wachtwoord is onjuist.');
      } else {
        setAuthError(mapAuthErrorToDutch(err) || t('genericError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError('');
    setAuthNotice('');
    if (!email) {
      setAuthError(t('fillEmailFirst'));
      return;
    }
    try {
      await resetPassword(email);
    } catch { /* same copy either way */ }
    setAuthNotice(t('resetSent'));
  };

  const handleEmailLink = async () => {
    setAuthError('');
    setAuthNotice('');
    if (!email) {
      setAuthError(t('fillEmailFirst'));
      return;
    }
    setIsSubmitting(true);
    try {
      await sendEmailSignInLink(email);
      setAuthNotice(t('emailLinkSent'));
    } catch (err) {
      setAuthError(mapAuthErrorToDutch(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    setAuthNotice('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      console.error(err);
      setAuthError(mapAuthErrorToDutch(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user) {
    return (
    <div className="app-shell min-h-screen font-sans selection:bg-cyan-400/30">
      <a href="#main-content" className="skip-link">{t('skip')}</a>
      <header className="topbar sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="min-h-[72px] py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="brand-mark flex items-center justify-center font-bold shrink-0">
                <img src="/brand-logo.svg" alt="Barlicious Operations" className="w-full h-full object-contain rounded-[inherit]" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xl hidden sm:block tracking-tight text-zinc-900">Barlicious <span className="brand-subtitle">Operations</span></span>
                <span className="font-bold text-lg sm:hidden tracking-tight text-zinc-900">Team</span>
              </div>
            </div>

            <div className="header-actions flex flex-wrap items-center justify-end gap-2 sm:gap-3 max-w-full">
              <LanguageSwitch />
              <PWAInstallButton />
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={toggleEmployeePreview}
                  className="ops-btn-primary inline-flex items-center justify-center p-2 shrink-0"
                  title={viewAsEmployee ? t('backAdmin') : t('viewEmployee')}
                  aria-label={viewAsEmployee ? t('backAdmin') : t('viewEmployee')}
                >
                  {viewAsEmployee ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
              <div className="user-pill flex items-center gap-2 sm:gap-3 pl-2 pr-2 sm:pr-3 py-1.5 shrink-0">
                <div className="ops-panel w-8 h-8 rounded-full flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="user-pill-copy flex flex-col pr-2 sm:pr-3 border-r border-zinc-200">
                  <span className="text-sm font-bold text-zinc-900 leading-tight truncate max-w-[100px]">{user.name}</span>
                  <span className="text-xs text-zinc-400 leading-tight capitalize">
                    {user.role === 'admin' && viewAsEmployee ? (fr ? 'admin · aperçu' : 'beheerder · preview') : user.role}
                  </span>
                </div>
                <button onClick={logout} aria-label={t('logout')} className="text-zinc-400 hover:text-zinc-900 transition-colors" title={t('logout')}>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <AppUpdateBanner />

      <main id="main-content" tabIndex={-1} className="content-shell max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>}>
          {user.role === 'admin' && !viewAsEmployee ? <AdminView /> : <EmployeeView />}
        </Suspense>
      </main>
    </div>
    );
  }

  if (loading && sessionHint) {
    return <BootAppShell hint={sessionHint} />;
  }

  if (!user) {
    return (
      <div className="login-shell min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden">
        <AppUpdateBanner />
        <div className="login-language absolute top-4 right-4 z-10"><LanguageSwitch /></div>
        <div className="auth-card ops-card max-w-md w-full p-5 sm:p-9 space-y-6 sm:space-y-8">
          <div className="text-center space-y-3">
            <div className="brand-mark brand-mark-hero flex items-center justify-center mx-auto mb-2">
              <img src="/brand-logo.svg" alt="Barlicious Team" className="w-[88%] h-[88%] object-contain" />
            </div>
            <div className="eyebrow">{t('fieldOps')}</div>
            <p className="text-zinc-500">{invite ? t('inviteLead') : creating ? t('createAccountLead') : t('loginLead')}</p>
            {invite && <p className="text-sm font-bold">{invite.name} · {invite.email}</p>}
          </div>

          {(authError || accessError || redirectAuthError) && (
            <div className="p-3 bg-red-50 text-red-700 rounded-[12px] text-sm font-medium text-center border border-red-100">
              {authError || accessError || redirectAuthError}
            </div>
          )}
          {authNotice && (
            <div className="p-3 bg-green-50 text-green-700 rounded-[12px] text-sm font-medium text-center border border-green-100">{authNotice}</div>
          )}

          {needsEmailForLink && (
            <p className="text-sm text-center text-zinc-500">{t('confirmEmail')}</p>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5" htmlFor="login-email">{t('email')}</label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="username email"
                inputMode="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                readOnly={Boolean(invite)}
                placeholder="nina.v@example.com"
                className="ops-input p-3.5 font-medium"
              />
            </div>
            {!needsEmailForLink && (
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5" htmlFor="login-password">{t('password')}</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name={invite || creating ? 'new-password' : 'current-password'}
                  autoComplete={invite || creating ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="ops-input p-3.5 font-medium pr-12"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            )}
            {(invite || creating) && !needsEmailForLink && (
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-1.5" htmlFor="login-password2">{t('passwordConfirm')}</label>
                <input
                  id="login-password2"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required
                  minLength={6}
                  className="ops-input p-3.5 font-medium"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="ops-btn-primary w-full py-4 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              <span>{needsEmailForLink ? t('confirmEmailBtn') : invite || creating ? t('inviteActivate') : t('signIn')}</span>
            </button>
          </form>
          {!needsEmailForLink && !invite && (
            <button
              type="button"
              onClick={() => { setCreating(v => !v); setAuthError(''); setAuthNotice(''); }}
              className="w-full text-sm font-bold text-zinc-600 hover:text-zinc-900"
            >
              {creating ? t('backToSignIn') : t('createAccount')}
            </button>
          )}
          {!needsEmailForLink && (
          <button type="button" onClick={handlePasswordReset} className="w-full text-sm font-bold text-zinc-600 hover:text-zinc-900">
            {t('forgot')}
          </button>
          )}
          {!needsEmailForLink && (
          <button type="button" onClick={handleEmailLink} disabled={isSubmitting} className="ops-btn-secondary w-full py-3 disabled:opacity-50">
            {t('emailLink')}
          </button>
          )}

          <div className="flex items-center gap-3 text-zinc-400 text-sm">
            <span className="h-px flex-1 bg-zinc-200" />
            <span>{t('or')}</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isSubmitting}
            className="ops-btn-secondary w-full py-4 disabled:opacity-50"
          >
            <GoogleMark />
            <span>{t('google')}</span>
          </button>

          <p className="text-center text-xs text-zinc-500">{t('accountsAdmin')}</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function App() {
  return (
    <LanguageProvider><AuthProvider><AppContent /></AuthProvider></LanguageProvider>
  );
}
