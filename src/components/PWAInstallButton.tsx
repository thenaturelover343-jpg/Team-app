import React, { useEffect, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={compact ? 'ops-btn-primary gap-2 px-3 text-sm' : 'ops-btn-primary gap-2 px-3 text-sm'}>
        <Download className="w-4 h-4" />
        <span className={compact ? 'hidden sm:inline' : ''}>Installeer App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button type="button" onClick={() => setShowIOSGuide(true)} className="ops-btn-secondary gap-2 px-3 text-sm">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Installeer App</span>
        </button>
        {showIOSGuide && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4">
            <div className="ops-card w-full max-w-sm p-6 space-y-4">
              <h3 className="text-xl font-bold text-zinc-900">Zet op beginscherm (iPhone)</h3>
              <ol className="text-zinc-700 font-medium space-y-3 list-decimal pl-5">
                <li>Tik op <strong>Delen</strong> (vierkantje met pijl omhoog) in Safari.</li>
                <li>Scroll en tik op <strong>Zet op beginscherm</strong>.</li>
                <li>Tik op <strong>Voeg toe</strong>. Open daarna de app vanaf het beginscherm.</li>
              </ol>
              <button type="button" onClick={() => setShowIOSGuide(false)} className="ops-btn-secondary w-full text-sm">Sluiten</button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

/** Full-width banner after login — hard to miss. */
export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem('pwaInstallDismissed') === '1'); } catch { /* ignore */ }
  }, []);

  if (isInstalled || dismissed) return null;
  if (!isInstallable && !isIOS) {
    // Still show a tip on desktop Chromium before prompt fires / unsupported
    return (
      <div className="mx-auto max-w-6xl px-4 md:px-8 pt-3">
        <div className="ops-card border-cyan-300/70 bg-cyan-50/80 p-4 flex gap-3 items-start">
          <Smartphone className="w-6 h-6 text-zinc-900 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="font-extrabold text-zinc-900">Installeer als telefoon-app</div>
            <p className="text-sm text-zinc-600">Open deze site op je telefoon (Chrome/Safari). Tik daarna op <strong>Installeer app</strong> of <strong>Zet op beginscherm</strong> — dan werkt hij als app, niet als browsertab.</p>
          </div>
          <button type="button" aria-label="Sluiten" onClick={() => { setDismissed(true); try { sessionStorage.setItem('pwaInstallDismissed','1'); } catch { /* */ } }} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>
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
          <button type="button" aria-label="Sluiten" onClick={() => { setDismissed(true); try { sessionStorage.setItem('pwaInstallDismissed','1'); } catch { /* */ } }} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isInstallable ? (
            <button type="button" onClick={install} className="ops-btn-primary w-full py-3.5 text-base font-extrabold gap-2">
              <Download className="w-5 h-5" />Installeer app nu
            </button>
          ) : (
            <button type="button" onClick={() => setShowIOSGuide(true)} className="ops-btn-primary w-full py-3.5 text-base font-extrabold gap-2">
              <Download className="w-5 h-5" />Toon iPhone-stappen
            </button>
          )}
          <button type="button" onClick={() => { setDismissed(true); try { sessionStorage.setItem('pwaInstallDismissed','1'); } catch { /* */ } }} className="ops-btn-secondary w-full py-3.5">Later</button>
        </div>
      </div>
      {showIOSGuide && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="ops-card w-full max-w-sm p-6 space-y-4">
            <h3 className="text-xl font-bold text-zinc-900">Zet op beginscherm (iPhone)</h3>
            <ol className="text-zinc-700 font-medium space-y-3 list-decimal pl-5">
              <li>Tik op <strong>Delen</strong> (vierkantje met pijl omhoog) in Safari.</li>
              <li>Scroll en tik op <strong>Zet op beginscherm</strong>.</li>
              <li>Tik op <strong>Voeg toe</strong>. Open daarna de app vanaf het beginscherm.</li>
            </ol>
            <button type="button" onClick={() => setShowIOSGuide(false)} className="ops-btn-secondary w-full text-sm">Sluiten</button>
          </div>
        </div>
      )}
    </div>
  );
}
