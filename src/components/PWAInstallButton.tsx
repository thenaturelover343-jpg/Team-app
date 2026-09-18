import React, { useEffect, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Link2, Check } from 'lucide-react';

export const PWA_REVEAL_IOS_INSTALL = 'pwa-reveal-ios-install';

/** Clear iOS Safari share icon (square with upward arrow). */
export function IOSShareIcon({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6.5 12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 12v6.5A2.5 2.5 0 0 0 8.5 21h7a2.5 2.5 0 0 0 2.5-2.5V12"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function appUrl(): string {
  if (typeof window === 'undefined') return 'https://barlicious-team-app.thenaturelover343.workers.dev';
  return window.location.origin + '/';
}

function CopyLinkButton({ label = 'Kopieer link' }: { label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = appUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        window.prompt('Kopieer deze link:', url);
      } catch {
        /* ignore */
      }
    }
  };
  return (
    <button type="button" onClick={() => void copy()} className="ops-btn-primary w-full py-3.5 text-base font-extrabold gap-2">
      {copied ? <Check className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
      {copied ? 'Link gekopieerd' : label}
    </button>
  );
}

/** Card when user is NOT in real Safari (Grok/Chrome/WebView): no Deel icon exists. */
function IOSOpenInSafariCard({
  id = 'ios-install-guide',
  onDismiss,
}: {
  id?: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      id={id}
      className="ops-card border-2 border-amber-400/80 bg-amber-50 p-5 sm:p-6 space-y-5 shadow-lg scroll-mt-24"
    >
      <div className="flex gap-3 items-start">
        <div className="shrink-0 rounded-2xl bg-white border border-amber-300/80 p-3 text-zinc-900">
          <Smartphone className="w-11 h-11" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-xl sm:text-2xl text-zinc-900 leading-tight">
            Open deze link in Safari
          </h2>
          <p className="text-sm text-zinc-700 mt-1 font-semibold">
            Open deze link in Safari (niet in Grok/Chrome). Alleen Safari heeft het Deel-icoon om de app op je beginscherm te zetten.
          </p>
        </div>
        {onDismiss && (
          <button type="button" aria-label="Sluiten" onClick={onDismiss} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <CopyLinkButton label="Kopieer link" />

      <ol className="space-y-3 text-zinc-800 font-semibold text-base leading-snug">
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-sm">1</span>
          <span className="pt-1">Tik <strong>Kopieer link</strong> hierboven</span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-sm">2</span>
          <span className="pt-1">Open <strong>Safari</strong> (blauw kompas-icoon)</span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-sm">3</span>
          <span className="pt-1">Plak de link in de adresbalk en open de app</span>
        </li>
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-sm">4</span>
          <span className="pt-1">In Safari: Deel → Zet op beginscherm → Voeg toe</span>
        </li>
      </ol>
    </div>
  );
}

/** Large always-visible iPhone install card — Safari Deel steps ONLY in real Safari. */
export function IOSInstallCard({
  id = 'ios-install-guide',
  showCopyLink = true,
  onDismiss,
  isSafari = true,
}: {
  id?: string;
  showCopyLink?: boolean;
  onDismiss?: () => void;
  isSafari?: boolean;
}) {
  if (!isSafari) {
    return <IOSOpenInSafariCard id={id} onDismiss={onDismiss} />;
  }

  return (
    <div
      id={id}
      className="ops-card border-2 border-emerald-400/80 bg-emerald-50 p-5 sm:p-6 space-y-5 shadow-lg scroll-mt-24"
    >
      <div className="flex gap-3 items-start">
        <div className="shrink-0 rounded-2xl bg-white border border-emerald-300/80 p-3 text-zinc-900">
          <IOSShareIcon className="w-11 h-11" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-xl sm:text-2xl text-zinc-900 leading-tight">
            Zo zet je de app op je iPhone (3 tikken)
          </h2>
          <p className="text-sm text-zinc-600 mt-1">
            Safari kan geen één-tik installatie. Volg precies deze stappen:
          </p>
        </div>
        {onDismiss && (
          <button type="button" aria-label="Sluiten" onClick={onDismiss} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <ol className="space-y-4">
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-9 h-9 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-base">
            1
          </span>
          <div className="pt-1 text-zinc-800 font-semibold text-base leading-snug">
            Tik op het <strong>Deel-icoon</strong>{' '}
            <span className="inline-flex align-middle text-zinc-900 mx-0.5" aria-hidden>
              <IOSShareIcon className="w-6 h-6" />
            </span>{' '}
            <span className="text-zinc-500 font-medium">(□↑)</span> onderaan Safari
          </div>
        </li>
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-9 h-9 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-base">
            2
          </span>
          <div className="pt-1 text-zinc-800 font-semibold text-base leading-snug">
            Scroll en tik <strong>&quot;Zet op beginscherm&quot;</strong>
          </div>
        </li>
        <li className="flex gap-3 items-start">
          <span className="shrink-0 w-9 h-9 rounded-full bg-zinc-900 text-white font-extrabold flex items-center justify-center text-base">
            3
          </span>
          <div className="pt-1 text-zinc-800 font-semibold text-base leading-snug">
            Tik <strong>&quot;Voeg toe&quot;</strong>
          </div>
        </li>
      </ol>

      {showCopyLink && <CopyLinkButton />}
    </div>
  );
}

function scrollToIosGuide() {
  const el = document.getElementById('ios-install-guide');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }
  return false;
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }

    if (isIOS) {
      try {
        sessionStorage.removeItem('pwaInstallDismissed');
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event(PWA_REVEAL_IOS_INSTALL));
      window.setTimeout(() => {
        if (!scrollToIosGuide()) {
          window.location.assign('/install');
        }
      }, 50);
      return;
    }

    window.location.assign('/install');
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="ops-btn-secondary gap-2 px-3 text-sm"
      aria-label="Installeer app"
      title="Installeer app"
    >
      <Download className="w-4 h-4" />
      <span className={compact ? 'hidden sm:inline' : 'hidden sm:inline'}>Installeer App</span>
    </button>
  );
};

/** Full-width banner after login. On iPhone: Safari steps or open-in-Safari guide. */
export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, isIOSSafari, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem('pwaInstallDismissed') === '1');
    } catch {
      /* ignore */
    }
    const onReveal = () => {
      setDismissed(false);
      setForceShow(true);
      try {
        sessionStorage.removeItem('pwaInstallDismissed');
      } catch {
        /* ignore */
      }
      window.setTimeout(() => scrollToIosGuide(), 80);
    };
    window.addEventListener(PWA_REVEAL_IOS_INSTALL, onReveal);
    return () => window.removeEventListener(PWA_REVEAL_IOS_INSTALL, onReveal);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    setForceShow(false);
    try {
      sessionStorage.setItem('pwaInstallDismissed', '1');
    } catch {
      /* */
    }
  };

  if (isInstalled) return null;
  if (dismissed && !forceShow) return null;

  if (isIOS) {
    return (
      <div className="mx-auto max-w-6xl px-4 md:px-8 pt-3">
        <IOSInstallCard onDismiss={dismiss} isSafari={isIOSSafari} />
      </div>
    );
  }

  if (isInstallable) {
    return (
      <div className="mx-auto max-w-6xl px-4 md:px-8 pt-3">
        <div className="ops-card border-emerald-300/80 bg-emerald-50 p-4 sm:p-5 space-y-3">
          <div className="flex gap-3 items-start">
            <Smartphone className="w-7 h-7 text-zinc-900 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-lg text-zinc-900">Installeer Barlicious Team op je telefoon</div>
              <p className="text-sm text-zinc-700 mt-1">
                Installeer als app op je beginscherm voor snelle toegang, offline start en pushmeldingen.
              </p>
            </div>
            <button type="button" aria-label="Sluiten" onClick={dismiss} className="text-zinc-400 hover:text-zinc-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="ops-btn-primary w-full py-3.5 text-base font-extrabold gap-2"
            >
              <Download className="w-5 h-5" />
              Installeer app nu
            </button>
            <button type="button" onClick={dismiss} className="ops-btn-secondary w-full py-3.5">
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pt-3">
      <div className="ops-card border-cyan-300/70 bg-cyan-50/80 p-4 flex gap-3 items-start">
        <Smartphone className="w-6 h-6 text-zinc-900 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-extrabold text-zinc-900">Installeer als telefoon-app</div>
          <p className="text-sm text-zinc-600">
            Open deze site op je telefoon in <strong>Safari</strong> (iPhone) of Chrome (Android). Op iPhone:{' '}
            <a href="/install" className="underline font-bold text-zinc-900">
              /install
            </a>
            .
          </p>
        </div>
        <button type="button" aria-label="Sluiten" onClick={dismiss} className="text-zinc-400 hover:text-zinc-700">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
