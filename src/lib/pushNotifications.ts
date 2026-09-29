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

function isAndroid() {
  return /android/i.test(window.navigator.userAgent);
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Best-effort: open the phone notification settings for this app. */
export function openDeviceNotificationSettings() {
  if (typeof window === 'undefined') return;
  if (isIOS()) {
    window.location.href = 'app-settings:';
    return;
  }
  if (isAndroid()) {
    window.location.href = 'intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;end';
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = 'intent:#Intent;action=android.settings.NOTIFICATION_SETTINGS;end';
      }
    }, 400);
  }
}

export async function enablePush(publicKey: string) {
  if (!pushSupported() || !publicKey) throw new Error('Pushmeldingen worden niet ondersteund op dit toestel.');

  if (isIOS() && !isStandaloneApp()) {
    openDeviceNotificationSettings();
    throw new Error('Open de Team-app via het icoon op je beginscherm en tik opnieuw op Meldingen activeren.');
  }

  const current = Notification.permission;
  if (current === 'denied') {
    openDeviceNotificationSettings();
    throw new Error('Zet meldingen aan in het scherm dat net openging, kom daarna terug en tik opnieuw.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    openDeviceNotificationSettings();
    throw new Error('Zet meldingen aan in de instellingen van je telefoon en tik daarna opnieuw op de knop.');
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
