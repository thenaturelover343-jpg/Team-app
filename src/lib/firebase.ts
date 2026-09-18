import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  type UserCredential,
} from 'firebase/auth';
import rawFirebaseConfig from '../../firebase-applet-config.json';

/** Firebase Hosting auth handler origin (proxied first-party by the Worker). */
export const FIREBASE_AUTH_HANDLER_ORIGIN =
  'https://gen-lang-client-0310454092.firebaseapp.com';

const PRODUCTION_AUTH_DOMAIN =
  'barlicious-team-app.thenaturelover343.workers.dev';

const GOOGLE_REDIRECT_PENDING_KEY = 'barlicious:googleRedirectPending';

/**
 * Use the app origin as authDomain in production so redirect storage is
 * first-party (iOS Safari / PWA ITP). Localhost keeps the firebaseapp.com
 * domain because the Worker proxy is not available there.
 */
function resolveFirebaseConfig() {
  const config = { ...rawFirebaseConfig, authDomain: PRODUCTION_AUTH_DOMAIN };
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === 'terminal.local') {
      config.authDomain = 'gen-lang-client-0310454092.firebaseapp.com';
    } else {
      // Prefer current host so custom domains stay first-party too.
      config.authDomain = window.location.host;
    }
  }
  return config;
}

const firebaseConfig = resolveFirebaseConfig();
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
      popupRedirectResolver: browserPopupRedirectResolver,
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

function markGoogleRedirectPending() {
  try {
    sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1');
  } catch {
    /* private mode / blocked storage */
  }
}

function consumeGoogleRedirectPending(): boolean {
  try {
    const pending = sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1';
    if (pending) sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    return pending;
  } catch {
    return false;
  }
}

/**
 * Google sign-in: use redirect on iOS / installed PWA; otherwise popup with
 * automatic redirect fallback when the popup is blocked or closed.
 */
export async function loginWithGoogle(): Promise<UserCredential | void> {
  const provider = googleProvider();
  if (prefersGoogleRedirect()) {
    markGoogleRedirectPending();
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
      markGoogleRedirectPending();
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

function redirectSessionIncompleteError(): Error {
  const err = new Error(
    'Google-login kon de sessie niet afronden. Probeer opnieuw of gebruik e-mail/wachtwoord.',
  );
  (err as Error & { code: string }).code = 'auth/redirect-session-incomplete';
  return err;
}

/**
 * Call once on app load to finish a redirect-based Google sign-in.
 * If getRedirectResult is null but auth.currentUser exists, treat as success.
 * If we expected a redirect return and still have no session, throw with Dutch copy.
 */
export async function completeGoogleRedirect(): Promise<UserCredential | null> {
  const pending = consumeGoogleRedirectPending();
  const result = await getRedirectResult(auth);
  if (result) return result;

  try {
    await auth.authStateReady();
  } catch {
    /* ignore */
  }

  if (auth.currentUser) {
    return null;
  }

  if (pending) {
    throw redirectSessionIncompleteError();
  }
  return null;
}

/** Map Firebase Auth error codes to clear Dutch copy. */
export function mapAuthErrorToDutch(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : '';
  switch (code) {
    case 'auth/redirect-session-incomplete':
      return 'Google-login kon de sessie niet afronden. Probeer opnieuw of gebruik e-mail/wachtwoord.';
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
      if (message.includes('Google-login kon de sessie niet afronden')) {
        return message;
      }
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
