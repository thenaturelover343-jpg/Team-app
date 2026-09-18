import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';
import { auth, completeGoogleRedirect, mapAuthErrorToDutch } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessError: string;
  redirectAuthError: string;
  refreshUser: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  accessError: '',
  redirectAuthError: '',
  refreshUser: async () => {},
});

/** True access denials — only these should clear the Firebase session. */
function isAccessDenied(message: string): boolean {
  return /niet aangemeld|geen toegang|uitgenodigd|niet actief|niet gemachtigd|unauthorized|forbidden|invalid.?token|id.?token/i.test(message);
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [redirectAuthError, setRedirectAuthError] = useState('');

  const load = async (fbUser?: FirebaseUser | null) => {
    const firebaseUser = fbUser === undefined ? auth.currentUser : fbUser;
    if (!firebaseUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setAccessError('');
      const result = await secureApi.snapshot();
      setUser(result.data.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uw account heeft geen toegang.';
      setAccessError(message);
      if (isAccessDenied(message)) {
        setUser(null);
        try {
          await signOut(auth);
        } catch {
          /* ignore */
        }
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
      try {
        await completeGoogleRedirect();
        if (!cancelled) setRedirectAuthError('');
      } catch (error) {
        console.error('Google redirect result', error);
        if (!cancelled) setRedirectAuthError(mapAuthErrorToDutch(error));
      }
      if (cancelled) return;
      unsub = onIdTokenChanged(auth, (current) => {
        setLoading(true);
        void load(current);
      });
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
