// Which tips this phone has seen, kept per phone like the other preferences. One key holds the
// version of each tip that was shown, so a tip whose version goes up is shown again.
import { TIPS, type TipId } from './tips.ts';

const KEY = 'cuisine.tips.v1';
const CHANGED = 'cuisine:tips-changed';

type Seen = Partial<Record<TipId, number>>;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function read(store: Store): Seen {
  try {
    const value: unknown = JSON.parse(store.getItem(KEY) ?? '{}');
    return value && typeof value === 'object' ? value as Seen : {};
  } catch {
    return {};
  }
}

export function hasSeen(id: TipId, store: Store = localStorage): boolean {
  return (read(store)[id] ?? 0) >= TIPS[id].version;
}

export function markSeen(id: TipId, store: Store = localStorage): void {
  try {
    store.setItem(KEY, JSON.stringify({ ...read(store), [id]: TIPS[id].version }));
  } catch {
    // Storage full or blocked: the tip may show again, which beats breaking the screen.
  }
}

export function forgetSeen(store: Store = localStorage): void {
  try {
    store.removeItem(KEY);
  } catch { /* nothing kept, nothing to forget */ }
  window.dispatchEvent(new Event(CHANGED));
}

/** Runs when "Show tips again" is used, so the screen on show can offer its tip right away. */
export function onTipsForgotten(run: () => void): () => void {
  window.addEventListener(CHANGED, run);
  return () => window.removeEventListener(CHANGED, run);
}
