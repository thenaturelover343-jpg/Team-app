import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getIdTokenResult, onIdTokenChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessError: string;
}

export const AuthContext = createContext<AuthContextType>({ user: null, loading: true, accessError: '' });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          setAccessError('');
          const token = await getIdTokenResult(fbUser);
          const role = token.claims.role;
          const active = token.claims.active;
          if ((role !== 'admin' && role !== 'employee') || active !== true) {
            setAccessError('Dit account is nog niet geactiveerd door een beheerder.');
            await signOut(auth);
            setLoading(false);
            return;
          }
          const userRef = doc(db, 'users', fbUser.uid);
          unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Number(data.createdAt || 0);
              setUser({ id: docSnap.id, ...data, role, active: true, createdAt } as User);
            } else {
              setUser(null);
              setAccessError('Uw gebruikersprofiel ontbreekt. Neem contact op met een beheerder.');
            }
            setLoading(false);
          });
          
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, accessError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
