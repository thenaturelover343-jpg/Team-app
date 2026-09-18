import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** True iOS Safari (has Share / Deel UI). Not Chrome iOS, not in-app WebViews (Grok, etc.). */
export function detectIsIOSSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const uaLower = ua.toLowerCase();
  const iOSUa = /iphone|ipad|ipod/.test(uaLower);
  const iPadOs = window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1;
  if (!iOSUa && !iPadOs) return false;
  // Chrome/Firefox/Edge/Opera on iOS
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua)) return false;
  // Common in-app / embedded WebViews (no Safari share sheet)
  if (/Grok|ChatGPT|Instagram|FBAN|FBAV|Line\/|Twitter|LinkedInApp|DuckDuckGo|YaBrowser|wv\)/i.test(ua)) return false;
  // WebKit present and Safari token without known non-Safari browsers
  const isSafari = /Safari/i.test(ua) && /Version\//i.test(ua);
  return isSafari;
}

export function detectIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const iOSUa = /iphone|ipad|ipod/.test(ua);
  const iPadOs = window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1;
  return iOSUa || iPadOs;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  ));
  const [isIOS] = useState(() => detectIsIOS());
  const [isIOSSafari] = useState(() => detectIsIOSSafari());

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isIOSSafari,
    install,
  };
}
