import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';

/** Persistent in-app update CTA when /app-version.txt differs from the running build. */
export function AppUpdateBanner() {
  const { updateAvailable, applyUpdate, applying } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] border-b border-amber-300/80 bg-amber-50 shadow-md">
      <button
        type="button"
        onClick={() => void applyUpdate()}
        disabled={applying}
        className="w-full px-4 py-3.5 flex items-center justify-center gap-2 text-sm sm:text-base font-extrabold text-amber-950 hover:bg-amber-100/80 transition-colors disabled:opacity-70"
        aria-live="polite"
      >
        <RefreshCw className={`w-5 h-5 shrink-0 ${applying ? 'animate-spin' : ''}`} />
        <span>Nieuwe versie beschikbaar — tik om bij te werken</span>
      </button>
    </div>
  );
}
