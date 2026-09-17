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
        className="ops-btn-primary gap-2 px-3 text-sm"
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
          className="ops-btn-secondary gap-2 px-3 text-sm"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Installeer App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="ops-card w-full max-w-sm p-6 space-y-4">
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
                className="ops-btn-secondary mt-6 w-full text-sm"
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
