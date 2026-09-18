import React, { useState } from 'react';
import EmployeeView from './EmployeeView';
import AdminView from './AdminView';
import { UserCircle, Loader2, LogOut, Eye, EyeOff } from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { loginWithEmail, loginWithGoogle, logout, resetPassword } from './lib/firebase';
import { LanguageProvider, LanguageSwitch, useLanguage } from './i18n';

function AppContent() {
  const { user, loading, accessError } = useAuth();
  const { locale } = useLanguage(); const fr = locale === 'fr';
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  // Admins always land in beheer. Preview is session-only UI state (not persisted),
  // so a sticky adminViewAsEmployee=1 can never trap them on EmployeeView after login.
  const [viewAsEmployee, setViewAsEmployee] = useState(false);

  React.useEffect(() => {
    try { sessionStorage.removeItem('adminViewAsEmployee'); } catch { /* ignore */ }
  }, []);

  const toggleEmployeePreview = () => {
    setViewAsEmployee(prev => !prev);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setIsSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: unknown) {
      console.error(err);
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setAuthError('E-mail of wachtwoord is onjuist.');
      } else {
        setAuthError('Er is een fout opgetreden. Probeer het opnieuw.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError('');
    setAuthNotice('');
    if (!email) {
      setAuthError('Vul eerst uw e-mailadres in.');
      return;
    }
    try {
      await resetPassword(email);
      setAuthNotice('Als dit account bestaat, is een herstelmail verzonden.');
    } catch {
      setAuthNotice('Als dit account bestaat, is een herstelmail verzonden.');
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
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      if (code === 'auth/popup-blocked') {
        setAuthError('Sta pop-ups toe voor deze app en probeer opnieuw.');
      } else if (code !== 'auth/popup-closed-by-user') {
        setAuthError('Google-inloggen is mislukt. Probeer opnieuw.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-loading min-h-screen flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-zinc-500 font-medium tracking-wide">{fr ? 'Chargement…' : 'Bezig met laden...'}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-shell min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden"><div className="login-language absolute top-4 right-4 z-10"><LanguageSwitch /></div>
        <div className="auth-card ops-card max-w-md w-full p-5 sm:p-9 space-y-6 sm:space-y-8">
          <div className="text-center space-y-3">
            <div className="brand-mark brand-mark-hero flex items-center justify-center mx-auto mb-2">
              <img src="/brand-logo.svg" alt="Team" className="w-[88%] h-[88%] object-contain" />
            </div>
            <div className="eyebrow font-display">FIELD OPERATIONS</div>
            <p className="text-zinc-500">{fr ? 'Connectez-vous avec votre compte invité' : 'Log in met uw uitgenodigde account'}</p>
          </div>

          {(authError || accessError) && (
            <div className="p-3 bg-red-50 text-red-700 rounded-[12px] text-sm font-medium text-center border border-red-100">
              {authError || accessError}
            </div>
          )}
          {authNotice && (
            <div className="p-3 bg-green-50 text-green-700 rounded-[12px] text-sm font-medium text-center border border-green-100">{authNotice}</div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">{fr ? 'Adresse e-mail' : 'E-mailadres'}</label>
              <input 
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="ops-input p-3.5 font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">{fr ? 'Mot de passe' : 'Wachtwoord'}</label>
              <input 
                type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="ops-input p-3.5 font-medium"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="ops-btn-primary w-full py-4 disabled:opacity-50 mt-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              <span>{fr ? 'Se connecter' : 'Inloggen'}</span>
            </button>
          </form>
          <button type="button" onClick={handlePasswordReset} className="w-full text-sm font-bold text-zinc-600 hover:text-zinc-900">
            {fr ? 'Mot de passe oublié ?' : 'Wachtwoord vergeten?'}
          </button>

          <div className="flex items-center gap-3 text-zinc-400 text-sm">
            <span className="h-px flex-1 bg-zinc-200" />
            <span>{fr ? 'ou' : 'of'}</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isSubmitting}
            className="ops-btn-secondary w-full py-4 disabled:opacity-50"
          >
            {fr ? 'Continuer avec Google' : 'Verder met Google'}
          </button>

          <p className="text-center text-xs text-zinc-500">{fr ? 'Les nouveaux comptes sont créés uniquement par un administrateur.' : 'Nieuwe accounts worden uitsluitend door een beheerder aangemaakt.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen font-sans selection:bg-cyan-400/30">
      <a href="#main-content" className="skip-link">{fr ? 'Aller au contenu' : 'Ga naar inhoud'}</a>
      <header className="topbar sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="min-h-[72px] py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="brand-mark flex items-center justify-center font-bold shrink-0">
                <img src="/brand-logo.svg" alt="Barlicious Operations" className="w-full h-full object-contain rounded-[inherit]" />
              </div>
              <div className="min-w-0">
                <span className="font-display font-bold text-xl hidden sm:block tracking-tight text-zinc-900">Barlicious <span className="brand-subtitle">Operations</span></span>
                <span className="font-display font-bold text-lg sm:hidden tracking-tight text-zinc-900">Team</span>
              </div>
            </div>
            
            <div className="header-actions flex flex-wrap items-center justify-end gap-2 sm:gap-3 max-w-full">
              <LanguageSwitch />
              <PWAInstallButton />
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={toggleEmployeePreview}
                  className="ops-btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold shrink-0"
                  title={viewAsEmployee ? 'Terug naar beheer' : 'Bekijk als werknemer'}
                >
                  {viewAsEmployee ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span className={viewAsEmployee ? 'inline font-extrabold' : 'hidden xs:inline'}>{viewAsEmployee ? 'Terug naar beheer' : 'Werknemer'}</span>
                </button>
              )}
              <div className="user-pill flex items-center gap-2 sm:gap-3 pl-2 pr-2 sm:pr-3 py-1.5 shrink-0">
                <div className="ops-panel w-8 h-8 rounded-full flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="user-pill-copy flex flex-col pr-2 sm:pr-3 border-r border-zinc-200">
                  <span className="text-sm font-bold text-zinc-900 leading-tight truncate max-w-[100px]">{user.name}</span>
                  <span className="text-xs text-zinc-400 leading-tight capitalize">
                    {user.role === 'admin' && viewAsEmployee ? 'beheerder · preview' : user.role}
                  </span>
                </div>
                <button onClick={logout} aria-label={fr ? 'Se déconnecter' : 'Uitloggen'} className="text-zinc-400 hover:text-zinc-900 transition-colors" title={fr ? 'Se déconnecter' : 'Uitloggen'}>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {user.role === 'admin' && (
        <div className="content-shell max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-4">
          <button
            type="button"
            onClick={toggleEmployeePreview}
            className={`w-full rounded-[14px] px-4 ${viewAsEmployee ? 'py-5 text-lg ring-4 ring-cyan-400/50 shadow-lg shadow-cyan-500/20' : 'py-3.5'} text-left font-bold border ops-btn-primary flex items-center justify-between gap-3`}
          >
            <span className="flex items-center gap-2">
              {viewAsEmployee ? <EyeOff className="w-6 h-6 shrink-0" /> : <Eye className="w-5 h-5 shrink-0" />}
              <span>{viewAsEmployee ? '← Terug naar beheer' : 'Bekijk werknemerskant'}</span>
            </span>
            <span className="text-xs sm:text-sm font-semibold opacity-90">{viewAsEmployee ? 'PREVIEW AAN — tik hier om klanten en planning te beheren' : 'Open Vandaag / clock-in'}</span>
          </button>
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="content-shell max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
        {user.role === 'admin' && !viewAsEmployee ? <AdminView onViewAsEmployee={toggleEmployeePreview} /> : <EmployeeView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider><AuthProvider><AppContent /></AuthProvider></LanguageProvider>
  );
}
