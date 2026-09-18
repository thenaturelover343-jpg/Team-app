import { useCallback, useEffect, useState } from 'react';

const VERSION_URL = '/app-version.txt';
const STORAGE_KEY = 'barliciousAppBuildId';
const CHECK_MS = 60_000;

function normalizeVersion(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

async function fetchRemoteVersion(signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      signal,
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const version = normalizeVersion(text);
    return version || null;
  } catch {
    return null;
  }
}

function readStoredVersion(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredVersion(version: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, version);
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* ignore */
  }
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) {
      try {
        await existing.update();
      } catch {
        /* ignore */
      }
      return existing;
    }
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

async function activateWaitingWorker(registration: ServiceWorkerRegistration | null) {
  const waiting = registration?.waiting;
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise<void>((resolve) => {
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      window.setTimeout(() => resolve(), 1200);
    });
  }
}

export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const check = useCallback(async (signal?: AbortSignal) => {
    const remote = await fetchRemoteVersion(signal);
    if (!remote) return;
    setRemoteVersion(remote);

    const stored = readStoredVersion();
    if (!stored) {
      writeStoredVersion(remote);
      return;
    }
    if (stored !== remote) {
      setUpdateAvailable(true);
      void ensureServiceWorker();
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void ensureServiceWorker();
    void check(ac.signal);

    const interval = window.setInterval(() => void check(), CHECK_MS);
    const onFocus = () => void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'APP_UPDATE_AVAILABLE') setUpdateAvailable(true);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener?.('message', onMessage);

    return () => {
      ac.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener?.('message', onMessage);
    };
  }, [check]);

  const applyUpdate = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    try {
      const registration = await ensureServiceWorker();
      await activateWaitingWorker(registration);
      if (remoteVersion) writeStoredVersion(remoteVersion);
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }, [applying, remoteVersion]);

  return { updateAvailable, applyUpdate, applying, remoteVersion };
}
