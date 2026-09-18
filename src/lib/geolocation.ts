/** Geolocation helpers for clock-in/out — permission checks + open device settings. */

export type GeoPlatform = 'ios' | 'android' | 'other';

export type LocationPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'unknown';

export type LocationBlockCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'UNSUPPORTED';

export class LocationAccessError extends Error {
  code: LocationBlockCode;

  constructor(code: LocationBlockCode, message: string) {
    super(message);
    this.name = 'LocationAccessError';
    this.code = code;
  }
}

export function detectGeoPlatform(): GeoPlatform {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  const iOSUa = /iPhone|iPad|iPod/i.test(ua);
  const iPadOs =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  if (iOSUa || iPadOs) return 'ios';
  return 'other';
}

export async function queryLocationPermission(): Promise<LocationPermissionState> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return 'unsupported';
  }
  try {
    const perms = navigator.permissions;
    if (perms && typeof perms.query === 'function') {
      const result = await perms.query({ name: 'geolocation' as PermissionName });
      if (result.state === 'granted' || result.state === 'denied' || result.state === 'prompt') {
        return result.state;
      }
    }
  } catch {
    // iOS Safari often rejects Permissions API for geolocation
  }
  return 'unknown';
}

export function isLocationAccessError(err: unknown): err is LocationAccessError {
  return (
    err instanceof LocationAccessError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { name?: string }).name === 'LocationAccessError' &&
      typeof (err as { code?: unknown }).code === 'string')
  );
}

/** True when clock-in must be blocked and the settings UX shown. */
export function isGeoBlockedError(err: unknown): boolean {
  if (isLocationAccessError(err)) {
    return (
      err.code === 'PERMISSION_DENIED' ||
      err.code === 'POSITION_UNAVAILABLE' ||
      err.code === 'UNSUPPORTED'
    );
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = Number((err as { code: unknown }).code);
    // GeolocationPositionError: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE
    return code === 1 || code === 2;
  }
  return false;
}

/**
 * Best-effort deep link into system / app location settings.
 * Android: LOCATION_SOURCE_SETTINGS (+ fallback APPLICATION_DETAILS_SETTINGS).
 * iOS: app-settings: (Settings for current app / Safari); App-Prefs often blocked.
 */
export function openDeviceLocationSettings(): {
  opened: boolean;
  platform: GeoPlatform;
} {
  const platform = detectGeoPlatform();
  if (typeof window === 'undefined') return { opened: false, platform };

  try {
    if (platform === 'android') {
      // System location toggle first
      window.location.href =
        'intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end';
      // Secondary attempt after a tick if still in page (often won't run if intent worked)
      window.setTimeout(() => {
        try {
          const pkg =
            /Chrome/i.test(navigator.userAgent) && !/EdgA|OPR|SamsungBrowser/i.test(navigator.userAgent)
              ? 'com.android.chrome'
              : '';
          if (pkg) {
            window.location.href = `intent://details?id=${pkg}#Intent;scheme=package;action=android.settings.APPLICATION_DETAILS_SETTINGS;end`;
          }
        } catch {
          /* ignore */
        }
      }, 800);
      return { opened: true, platform };
    }

    if (platform === 'ios') {
      // app-settings: opens Settings for the hosting app / Safari in many PWA / WKWebView cases
      window.location.href = 'app-settings:';
      return { opened: true, platform };
    }
  } catch {
    /* ignore */
  }
  return { opened: false, platform };
}

export function iosLocationStepsCopy(): string {
  return 'Instellingen → Privacy en beveiliging → Locatievoorzieningen → [Safari of Barlicious Team] → Sta toe / Bij gebruik';
}

export function androidLocationStepsCopy(): string {
  return 'Instellingen → Locatie → zet Locatie aan. Tik daarna op App-machtigingen (of Apps → Barlicious Team / Chrome) → Locatie → Toestaan.';
}
