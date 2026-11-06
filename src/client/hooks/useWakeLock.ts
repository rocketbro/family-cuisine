// Keeps the screen on while cooking, where the browser allows it.
import { useEffect } from 'react';

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => { navigator.wakeLock.request('screen').then(l => { lock = l; }).catch(() => {}); };
    // The lock drops whenever the app goes to the background; take it again on return.
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void lock?.release(); };
  }, [active]);
}
