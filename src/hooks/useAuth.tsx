import React, { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types';
import { auth } from '../lib/firebase';
import { secureApi } from '../lib/secureApi';

interface AuthContextType { user: User | null; loading: boolean; accessError: string; refreshUser: () => Promise<void> }
export const AuthContext = createContext<AuthContextType>({ user: null, loading: true, accessError: '', refreshUser: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  const load = async (fbUser?: FirebaseUser | null) => {
    if (!fbUser && !auth.currentUser) { setUser(null); setLoading(false); return; }
    try {
      setAccessError('');
      const result = await secureApi.snapshot();
      setUser(result.data.user);
    } catch (error) {
      setUser(null);
      setAccessError(error instanceof Error ? error.message : 'Uw account heeft geen toegang.');
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => onIdTokenChanged(auth, current => { setLoading(true); void load(current); }), []);

  return <AuthContext.Provider value={{ user, loading, accessError, refreshUser: () => load(auth.currentUser) }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
