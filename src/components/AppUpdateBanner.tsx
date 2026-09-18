'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function AppUpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    let refreshInterval: number | undefined;

    const track = (registration: ServiceWorkerRegistration) => {
      reg = registration;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaiting(registration.waiting || worker);
          }
        });
      });
    };

    void navigator.serviceWorker.getRegistration('/').then(registration => {
      if (!registration) return;
      track(registration);
      void registration.update();
      refreshInterval = window.setInterval(() => { void registration.update(); }, 60_000);
    });

    const onControllerChange = () => { window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      if (refreshInterval) window.clearInterval(refreshInterval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  const refresh = () => {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // Fallback reload if controllerchange is slow
    window.setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[80] max-w-lg mx-auto sm:bottom-4">
      <button type="button" onClick={refresh} className="ops-btn-primary w-full py-3.5 text-sm font-extrabold gap-2 shadow-lg">
        <RefreshCw className="w-4 h-4" />
        Nieuwe versie beschikbaar — tik om te vernieuwen
      </button>
    </div>
  );
}
