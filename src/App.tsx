import React, { Suspense, lazy, useEffect, useState } from 'react';
import { UserCircle, Loader2, LogOut, Eye, EyeOff } from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { InstallScreen } from './components/InstallScreen';
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
import { LanguageProvider, useLanguage } from './i18n';
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
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.4 3.5-5.1 3.5-3.1 0-5.6-2.5-5.6-5.6S8.9 6.1 12 6.1c 1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1-.2-1.5H12z" />
    </svg>
  );
}
