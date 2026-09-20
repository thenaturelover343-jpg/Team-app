import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';
import { auth, completeGoogleRedirect, completeEmailLinkSignIn, mapAuthErrorToDutch, pendingEmailLinkSignIn } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';
import type { TeamSnapshot } from '../lib/secureApi';
import { readInviteTokenFromLocation } from '../lib/inviteLink';
import { clearSessionHint, writeSessionHint } from '../lib/sessionHint';

interface AuthContextType {
  user: User | null;
  snapshot: TeamSnapshot | null;
  loading: boolean;
  accessError: string;
  redirectAuthError: string;
  refreshUser: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextType>({
  user: null,
  snapshot: null,
  loading: true,
  accessError: '',
  redirectAuthError: '',
  refreshUser: async () => {},
});

function isAccessDenied(message: string): boolean {
  return /niet aangemeld|geen toegang|uitgenodigd|niet actief|niet gemachtigd|unauthorized|forbidden|invalid.?token|id.?token|ander e-mailadres/i.test(message);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [snapshot, setSnapshot] = useState<TeamSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [redirectAuthError, setRedirectAuthError] = useState('');
  const userRef = useRef<User | null>(null);

  const load = async (fbUser?: FirebaseUser | null) => {
    const firebaseUser = fbUser === undefined ? auth.currentUser : fbUser;
    if (!firebaseUser) {
      userRef.current = null;
      setUser(null);
      setSnapshot(null);
      clearSessionHint();
      setLoading(false);
      return;
    }
    try {
      setAccessError('');
      const result = await secureApi.snapshot(readInviteTokenFromLocation() || undefined);
      userRef.current = result.data.user;
      setSnapshot(result.data);
      setUser(result.data.user);
      writeSessionHint(result.data.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uw account heeft geen toegang.';
      setAccessError(message);
      if (isAccessDenied(message)) {
        userRef.current = null;
        setUser(null);
        setSnapshot(null);
        clearSessionHint();
        try { await signOut(auth); } catch { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const redirectWork = (async () => {
        try {
          if (pendingEmailLinkSignIn()) await completeEmailLinkSignIn();
        } catch (error) {
          if (!cancelled) setRedirectAuthError(mapAuthErrorToDutch(error));
        }
        try {
          await completeGoogleRedirect();
        } catch (error) {
          if (!cancelled) setRedirectAuthError(mapAuthErrorToDutch(error));
        }
      })();

      try {
        await Promise.race([
          auth.authStateReady(),
          new Promise(resolve => setTimeout(resolve, 1200)),
        ]);
      } catch { /* IndexedDB can stall on iPhone; login form still paints */ }

      if (cancelled) return;
      unsub = onIdTokenChanged(auth, (current) => {
        if (!userRef.current) setLoading(true);
        void load(current);
      });
      void redirectWork;
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        snapshot,
        loading,
        accessError,
        redirectAuthError,
        refreshUser: () => load(auth.currentUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
