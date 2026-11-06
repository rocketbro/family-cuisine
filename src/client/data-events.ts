// "Something changed": the dictation bar and sheets save from outside a screen, so they
// announce it and every loaded screen refreshes itself. Coming back to the app after a
// while (the phone slept, or the network came back) counts as a change too.
const EVENT = 'cuisine:changed';
const STALE_AFTER_MS = 20_000;

export function announceChange(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function onChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Refresh everything when the app comes back to the foreground after being away. */
export function refreshOnReturn(): void {
  let hiddenAt: number | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt !== null && Date.now() - hiddenAt > STALE_AFTER_MS) { hiddenAt = null; announceChange(); }
  });
  window.addEventListener('online', announceChange);
  // Going back can restore a whole earlier copy of the app from memory, which may be an old build.
  window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });
}
