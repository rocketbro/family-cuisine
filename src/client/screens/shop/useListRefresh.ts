// While the list is open and on screen, a look every so often, so two people split up in a store see
// each other's ticks and changes. A plain read: only a real load tells the server the list was
// opened (load-list.ts), since that saves the trip's record and starts reading package sizes.
import { useEffect } from 'react';
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';

const EVERY_MS = 20_000;

export function useListRefresh(refresh: (read: () => Promise<ShoppingWeek>) => Promise<void>): void {
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(api.shopping);
    }, EVERY_MS);
    return () => clearInterval(timer);
  }, [refresh]);
}
