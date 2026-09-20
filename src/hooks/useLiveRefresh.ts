import { useEffect } from 'react';

/** Poll while the tab is visible. Hidden tabs pause to save battery and D1. */
export function useLiveRefresh(load: () => Promise<void>, enabled: boolean, intervalMs = 30_000) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const run = async () => {
      if (!active || (typeof document !== 'undefined' && document.hidden)) return;
      try { await load(); } catch { /* next tick retries */ }
    };
    void run();
    const timer = window.setInterval(run, intervalMs);
    const onVis = () => { if (!document.hidden) void run(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, enabled, intervalMs]);
}
