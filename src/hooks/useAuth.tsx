import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';
import { auth, completeGoogleRedirect, mapAuthErrorToDutch } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';
import { clearSessionHint, writeSessionHint } from '../lib/sessionHint';

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
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const load = async (fbUser?: FirebaseUser | null) => {
    const firebaseUser = fbUser === undefined ? auth.currentUser : fbUser;
    if (!firebaseUser) {
      setUser(null);
      clearSessionHint();
      setLoading(false);
      return;
    }
    try {
      setAccessError('');
      const result = await secureApi.snapshot();
      setUser(result.data.user);
      writeSessionHint(result.data.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uw account heeft geen toegang.';
      setAccessError(message);
      if (isAccessDenied(message)) {
        // Real auth/permission failure — clear session so login form can show.
        setUser(null);
        clearSessionHint();
        try {
          await signOut(auth);
        } catch {
          /* ignore */
        }
      }
      // Transient errors (network, temporary DB): keep Firebase session; do NOT sign out.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Boot: wait for Google redirect + persistence, then subscribe.
    // Do NOT setLoading(true) on every later id-token refresh — that blanked the tree for seconds.
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
        // Only re-enter "loading" when we have no in-memory user yet (cold boot / logout→login).
        // Token refresh while signed in must not blank Admin/Employee.
        if (!userRef.current) {
          setLoading(true);
        }
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
