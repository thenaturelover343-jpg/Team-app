function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIOS() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1);
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function enablePush(publicKey: string) {
  if (!pushSupported() || !publicKey) throw new Error('Pushmeldingen worden niet ondersteund op dit toestel.');

  if (isIOS() && !isStandaloneApp()) {
    throw new Error('Open de Team-app via het icoon op je beginscherm. Tik daarna opnieuw op Meldingen activeren. iPhone toont het toestemmingsvenster alleen in de geïnstalleerde app.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (permission === 'denied') {
      throw new Error(isIOS()
        ? 'Meldingen staan uit. Zet ze aan via Instellingen → Meldingen → Team.'
        : 'Meldingen staan uit. Zet ze aan via Instellingen → Apps → Team of Chrome → Meldingen, en tik daarna opnieuw op de knop.');
    }
    throw new Error('Tik op Toestaan in het venster van je telefoon.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing || registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
}

export async function disablePush() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
