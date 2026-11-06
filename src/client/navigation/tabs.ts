// The five tabs and which tab a screen belongs to. A recipe opened from Today stays in Today,
// like a native tab bar: each tab keeps its own stack, and back never jumps between tabs.
import type { Location } from 'react-router';

export type TabId = 'today' | 'week' | 'recipes' | 'pantry' | 'shop';

export const TAB_ROOTS: Record<TabId, string> = { today: '/', week: '/week', recipes: '/recipes', pantry: '/pantry', shop: '/shop' };

/** Carried on every in-app navigation: the tab it happened in, and the screen to go back to. */
export type NavState = { tab?: TabId; back?: string };

export function tabForPath(path: string): TabId {
  if (path.startsWith('/week') || path.startsWith('/day/')) return 'week';
  if (path.startsWith('/recipes')) return 'recipes';
  if (path.startsWith('/pantry')) return 'pantry';
  if (path.startsWith('/shop')) return 'shop';
  return 'today';
}

export function tabOf(location: Pick<Location, 'pathname' | 'state'>): TabId {
  return (location.state as NavState | null)?.tab ?? tabForPath(location.pathname);
}

/** Settings hangs off Today, but no tab shows as the one you're on while you're in it. */
export function isSettings(path: string): boolean {
  return path === '/settings' || path.startsWith('/settings/');
}

export function isTabRoot(path: string): boolean {
  return Object.values(TAB_ROOTS).includes(path);
}

/** Where back goes when nothing says otherwise (the app was opened straight onto a screen). */
export function parentOf(path: string, tab: TabId): string {
  if (path.startsWith('/day/')) return '/week';
  if (path === '/recipes/import') return '/recipes';
  if (path === '/settings/shopping/move') return '/settings/shopping';
  if (path.startsWith('/settings/stock-up/')) return '/settings/stock-up';
  if (path.startsWith('/settings/')) return '/settings';
  return TAB_ROOTS[tab];
}

export function pathOf(location: Pick<Location, 'pathname' | 'search'>): string {
  return location.pathname + location.search;
}
