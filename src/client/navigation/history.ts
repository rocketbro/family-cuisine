// What the app remembers about where you've been: the last screen in each tab, each
// screen's scroll position, and which path sits at each step of browser history (so back
// can step through history when it lines up, and never wander into another tab when it doesn't).
import type { TabId } from './tabs.ts';

type Remembered = { path: string; state: unknown };

const lastInTab = new Map<TabId, Remembered>();
const scrollAt = new Map<string, number>();
const pathAtIndex = new Map<number, string>();
let nextScroll: 'top' | 'restore' = 'top';

export const memory = {
  rememberTab: (tab: TabId, entry: Remembered) => lastInTab.set(tab, entry),
  lastIn: (tab: TabId) => lastInTab.get(tab) ?? null,
  forgetTab: (tab: TabId) => lastInTab.delete(tab),

  saveScroll: (path: string, y: number) => scrollAt.set(path, y),
  scrollFor: (path: string) => scrollAt.get(path) ?? 0,
  /** The next screen should open where you left it (back, switching tabs), not at the top. */
  restoreNext: () => { nextScroll = 'restore'; },
  takeScrollMode: () => { const mode = nextScroll; nextScroll = 'top'; return mode; },

  recordIndex: (index: number, path: string) => pathAtIndex.set(index, path),
  pathAt: (index: number) => pathAtIndex.get(index) ?? null,
};

/** React Router keeps its history position in history.state.idx. */
export function historyIndex(): number | null {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === 'number' ? idx : null;
}
