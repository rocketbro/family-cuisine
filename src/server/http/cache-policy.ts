// How long a phone may keep each response. Built assets have hashed names and never change. Pages
// are no-store, because `no-cache` only rechecks on an ordinary load: going back through history
// reuses a cached page as it is, and an old page brings its old build back to life with it.
const ASSETS = 'public, max-age=31536000, immutable';

/** The Cache-Control a path should get, or null when its route sets its own. */
export function cachePolicyFor(path: string): string | null {
  if (path.startsWith('/assets/')) return ASSETS;
  if (path.startsWith('/media/')) return null;
  if (path.startsWith('/api/')) return 'no-cache';
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  return lastSegment.includes('.') ? 'no-cache' : 'no-store';
}
