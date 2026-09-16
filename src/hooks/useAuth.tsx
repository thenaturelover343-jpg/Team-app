import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const isAdminEmail = fbUser.email === 'thenaturelover343@gmail.com';
          
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const newUser: Omit<User, 'id'> = {
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Onbekend',
              email: fbUser.email || '',
              role: isAdminEmail ? 'admin' : 'employee',
              createdAt: Date.now()
            };
            await setDoc(userRef, newUser);
          } else if (isAdminEmail && userSnap.data().role !== 'admin') {
            await updateDoc(userRef, { role: 'admin' });
          }

          // Real-time listener for profile updates
          unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setUser({ id: docSnap.id, ...docSnap.data() } as User);
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
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
