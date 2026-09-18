import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  type UserCredential,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

/**
 * Persist session in IndexedDB (preferred) with localStorage fallback so
 * reopening the installed PWA / Safari homescreen keeps the user signed in.
 * Do not use browserSessionPersistence — that clears on every app reopen.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    // Already initialized (HMR / duplicate import) — reuse existing instance.
    return getAuth(app);
  }
}

export const auth = createAuth();

/**
 * Installed homescreen PWA (iOS navigator.standalone / display-mode standalone)
 * and iPhone/iPad Safari cannot reliably use signInWithPopup — must redirect.
 */
export function prefersGoogleRedirect(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone =
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;
  if (standalone) return true;
  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  return isIOS;
}

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
]);

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Google sign-in: use redirect on iOS / installed PWA; otherwise popup with
 * automatic redirect fallback when the popup is blocked or closed.
 */
export async function loginWithGoogle(): Promise<UserCredential | void> {
  const provider = googleProvider();
  if (prefersGoogleRedirect()) {
    await signInWithRedirect(auth, provider);
    return;
  }
  try {
    return await signInWithPopup(auth, provider);
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (POPUP_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

/** Call once on app load to finish a redirect-based Google sign-in. */
export function completeGoogleRedirect(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

/** Map Firebase Auth error codes to clear Dutch copy. */
export function mapAuthErrorToDutch(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/popup-blocked':
      return 'Pop-ups zijn geblokkeerd. We proberen opnieuw via doorverwijzing, of sta pop-ups toe.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google-inloggen werd geannuleerd. Probeer opnieuw.';
    case 'auth/unauthorized-domain':
      return 'Dit domein is niet gemachtigd voor Google-inloggen. Vraag de beheerder om het domein toe te voegen in Firebase.';
    case 'auth/network-request-failed':
      return 'Geen netwerkverbinding. Controleer uw internet en probeer opnieuw.';
    case 'auth/too-many-requests':
      return 'Te veel pogingen. Wacht even en probeer opnieuw.';
    case 'auth/user-disabled':
      return 'Dit account is uitgeschakeld. Neem contact op met de beheerder.';
    case 'auth/account-exists-with-different-credential':
      return 'Er bestaat al een account met dit e-mailadres via een andere inlogmethode.';
    case 'auth/operation-not-allowed':
      return 'Google-inloggen is niet ingeschakeld voor deze app.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-mail of wachtwoord is onjuist.';
    case 'auth/web-storage-unsupported':
      return 'Opslag in de browser is uitgeschakeld. Sta cookies/gegevens toe en probeer opnieuw.';
    default:
      if (code) return `Google-inloggen mislukt (${code}). Probeer opnieuw.`;
      return 'Google-inloggen is mislukt. Probeer opnieuw.';
  }
}

export const loginWithEmail = (email: string, pass: string) =>
  signInWithEmailAndPassword(auth, email, pass);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Team API error', { error, operationType, path });
}
