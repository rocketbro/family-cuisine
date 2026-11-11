// Which tip belongs to which screen. A screen with none shows nothing.
import type { TipId } from './tips.ts';

export function tipForPath(path: string): TipId | null {
  if (path === '/' || path.startsWith('/day/')) return 'today';
  if (path === '/week') return 'plan';
  if (path === '/week/import') return 'plan-import';
  if (path === '/shop') return 'list';
  if (path.startsWith('/shop/receipts/')) return 'receipt';
  if (path === '/pantry') return 'pantry';
  if (path === '/recipes') return 'recipes';
  if (path === '/recipes/import') return 'recipe-import';
  if (path.startsWith('/recipes/')) return 'recipe';
  if (path.startsWith('/checkin/')) return 'checkin';
  if (path === '/settings/cooking') return 'how-we-cook';
  return null;
}
