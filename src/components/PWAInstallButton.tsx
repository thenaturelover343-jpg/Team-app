import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-zinc-800 transition"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Installeer App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Installeer App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-xl space-y-4">
              <h3 className="text-xl font-bold text-zinc-900">App installeren op iPhone</h3>
              <p className="text-zinc-600 font-medium">
                Om deze app vast te zetten op uw telefoon:
              </p>
              <ul className="text-zinc-600 font-medium space-y-2 list-disc pl-5">
                <li>Tik onderaan in Safari op het <strong>Deel-icoontje</strong> (vierkantje met pijl omhoog).</li>
                <li>Scroll iets naar beneden en tik op <strong>Zet op beginscherm</strong> (Add to Home Screen).</li>
              </ul>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-[16px] bg-zinc-100 py-3 text-sm font-bold text-zinc-900 hover:bg-zinc-200 transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
