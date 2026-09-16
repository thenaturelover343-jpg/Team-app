import React, { useState } from 'react';
import EmployeeView from './EmployeeView';
import AdminView from './AdminView';
import { UserCircle, Truck, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { loginWithGoogle, loginWithEmail, registerWithEmail, logout } from './lib/firebase';

function AppContent() {
  const { user, loading } = useAuth();
  
  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('E-mail of wachtwoord is onjuist.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('Dit e-mailadres is al in gebruik.');
      } else {
        setAuthError('Er is een fout opgetreden. Probeer het opnieuw.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Google Login mislukt. Worden pop-ups geblokkeerd? Probeer e-mail/wachtwoord.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-zinc-500 font-medium tracking-wide">Bezig met laden...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[24px] p-8 shadow-2xl space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-zinc-900 text-white rounded-[16px] flex items-center justify-center mx-auto mb-6 shadow-[0_4px_14px_0_rgb(0,0,0,0.03)] border border-zinc-200">
              <Truck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Barlicious & Koelverhuur</h1>
            <p className="text-zinc-500">{isLogin ? 'Log in op je account' : 'Maak een nieuw account aan'}</p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-[12px] text-sm font-medium text-center border border-red-100">
              {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">E-mailadres</label>
              <input 
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-1.5">Wachtwoord</label>
              <input 
                type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full border border-zinc-200 rounded-[16px] p-3.5 focus:ring-4 focus:ring-zinc-900/10 focus:border-zinc-900 outline-none bg-[#FAFAFA] transition-all font-medium"
              />
            </div>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-zinc-900 hover:bg-zinc-900 text-white font-bold py-4 rounded-[16px] flex items-center justify-center space-x-2 transition-all shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] disabled:opacity-50 mt-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              <span>{isLogin ? 'Inloggen' : 'Account Aanmaken'}</span>
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200/60"></div></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-4 text-zinc-500 font-medium">Of</span></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isSubmitting}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3.5 rounded-[16px] flex items-center justify-center space-x-3 transition-colors shadow-lg shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
            <span>Verder met Google</span>
          </button>

          <div className="text-center mt-2">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); setIsLogin(!isLogin); setAuthError(''); }}
              className="text-sm font-bold text-zinc-900 hover:text-zinc-900"
            >
              {isLogin ? 'Nog geen account? Registreer hier' : 'Al een account? Log in'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-zinc-900">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50 text-zinc-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="h-[72px] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-zinc-900 rounded-[12px] flex items-center justify-center font-bold text-white shadow-[0_4px_14px_0_rgb(0,0,0,0.03)]">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-xl hidden sm:block tracking-tight text-zinc-900">Barlicious</span>
                <span className="font-bold text-xl sm:hidden tracking-tight text-zinc-900">Team App</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <PWAInstallButton />
              <div className="flex items-center space-x-4 bg-zinc-50 pl-2 pr-4 py-1.5 rounded-full border border-zinc-200">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border border-zinc-200">
                  <UserCircle className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="flex flex-col pr-4 border-r border-zinc-200">
                  <span className="text-sm font-bold text-zinc-900 leading-tight truncate max-w-[100px]">{user.name}</span>
                  <span className="text-xs text-zinc-400 leading-tight capitalize">{user.role}</span>
                </div>
                <button onClick={logout} className="text-zinc-400 hover:text-zinc-900 transition-colors" title="Uitloggen">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={user.role}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {user.role === 'admin' ? (
              <AdminView />
            ) : (
              <EmployeeView />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
