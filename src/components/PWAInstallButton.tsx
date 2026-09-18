import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Share } from 'lucide-react';

function IOSInstallSteps() {
  return (
    <ol className="text-zinc-700 font-medium space-y-3 list-decimal pl-5">
      <li>
        Tik op <strong>Delen</strong> / <strong>Share</strong>{' '}
        <Share className="inline w-4 h-4 align-text-bottom" aria-hidden /> (vierkantje met pijl omhoog) in Safari.
      </li>
      <li>
        Scroll en tik op <strong>Zet op beginscherm</strong> (Add to Home Screen).
      </li>
      <li>
        Tik op <strong>Voeg toe</strong>. Open daarna de app vanaf het beginscherm (geen browsertab).
      </li>
    </ol>
  );
}

function IOSInstallGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  // Portal to body so sticky header backdrop-filter / app-shell overflow cannot clip the dialog (iOS Safari).
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      onClick={onClose}
    >
      <div
        className="ops-card w-full max-w-sm p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="ios-install-title" className="text-xl font-bold text-zinc-900">
            Zet op beginscherm (iPhone)
          </h3>
          <button type="button" aria-label="Sluiten" onClick={onClose} className="text-zinc-400 hover:text-zinc-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <IOSInstallSteps />
        <button type="button" onClick={onClose} className="ops-btn-secondary w-full text-sm">
          Sluiten
        </button>
      </div>
    </div>,
    document.body,
  );
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  const openGuide = () => setShowIOSGuide(true);

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) openGuide();
      return;
    }
    openGuide();
  };

  // Always show when not installed so the header download works on iPhone Safari and desktop.
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="ops-btn-secondary gap-2 px-3 text-sm"
        aria-label="Installeer app"
        title="Installeer app"
      >
        <Download className="w-4 h-4" />
        <span className={compact ? 'hidden sm:inline' : 'hidden sm:inline'}>Installeer App</span>
      </button>
      <IOSInstallGuideModal open={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
    </>
  );
};

/** Full-width banner after login — hard to miss. */
export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem('pwaInstallDismissed') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('pwaInstallDismissed', '1');
    } catch {
      /* */
    }
  };

  if (isInstalled || dismissed) return null;

  if (!isInstallable && !isIOS) {
    return (
      <div className="mx-auto max-w-6xl px-4 md:px-8 pt-3">
        <div className="ops-card border-cyan-300/70 bg-cyan-50/80 p-4 flex gap-3 items-start">
          <Smartphone className="w-6 h-6 text-zinc-900 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-extrabold text-zinc-900">Installeer als telefoon-app</div>
            <p className="text-sm text-zinc-600">
              Open deze site op je telefoon (Chrome/Safari). Tik daarna op <strong>Installeer app</strong> of{' '}
              <strong>Zet op beginscherm</strong> — dan werkt hij als app, niet als browsertab.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="ops-btn-secondary mt-2 text-sm gap-2"
            >
              <Download className="w-4 h-4" />
              Toon iPhone-stappen
            </button>
          </div>
          <button type="button" aria-label="Sluiten" onClick={dismiss} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <IOSInstallGuideModal open={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pt-3">
      <div className="ops-card border-emerald-300/80 bg-emerald-50 p-4 sm:p-5 space-y-3">
        <div className="flex gap-3 items-start">
          <Smartphone className="w-7 h-7 text-zinc-900 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-lg text-zinc-900">Installeer Barlicious Team op je telefoon</div>
            <p className="text-sm text-zinc-700 mt-1">
              {isIOS
                ? 'Op iPhone: Safari → Delen → Zet op beginscherm. Daarna open je de app vanaf het beginscherm (geen browsertab).'
                : 'Installeer als app op je beginscherm voor snelle toegang, offline start en pushmeldingen.'}
            </p>
          </div>
          <button type="button" aria-label="Sluiten" onClick={dismiss} className="text-zinc-400 hover:text-zinc-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inline steps — always visible when expanded, not clipped by fixed/overflow bugs */}
        {showIOSGuide && (
          <div className="rounded-xl border border-emerald-400/50 bg-white/80 p-4 space-y-3">
            <h4 className="font-extrabold text-zinc-900">iPhone-stappen</h4>
            <IOSInstallSteps />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isInstallable ? (
            <button
              type="button"
              onClick={() => void install()}
              className="ops-btn-primary w-full py-3.5 text-base font-extrabold gap-2"
            >
              <Download className="w-5 h-5" />
              Installeer app nu
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="ops-btn-primary w-full py-3.5 text-base font-extrabold gap-2"
              aria-expanded={showIOSGuide}
            >
              <Download className="w-5 h-5" />
              {showIOSGuide ? 'Stappen hieronder' : 'Toon iPhone-stappen'}
            </button>
          )}
          <button type="button" onClick={dismiss} className="ops-btn-secondary w-full py-3.5">
            Later
          </button>
        </div>
      </div>
      <IOSInstallGuideModal open={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
    </div>
  );
}
