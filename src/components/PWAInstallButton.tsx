import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download } from 'lucide-react';

/**
 * Quiet header control only. No post-login install cards/banners —
 * full guidance lives on /install (kept available by URL).
 */
export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) return;
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
