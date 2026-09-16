import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut, signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const required = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`Ontbrekende configuratie: ${name}`);
  return value;
};

const firebaseConfig = {
  apiKey: required('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: required('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: required('VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: required('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
};

const app = initializeApp(firebaseConfig);
const databaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || '(default)';
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const loginWithEmail = (email: string, pass: string) => {
  return signInWithEmailAndPassword(auth, email, pass);
};

export const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export const logout = () => signOut(auth);

// Helper for throwing structured errors for the agent to debug rules if needed
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Ensure the connection is alive
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
