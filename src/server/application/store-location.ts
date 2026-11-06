// The household's ZIP code, for store prices near home.
import type { Deps } from './deps.ts';
import { forgetMisses } from './lookup-misses.ts';
import type { StoreLocation } from './ports/prices.ts';
import { UserError } from './user-error.ts';

const LOCATION_KEY = 'store_location';

export type SavedLocation = StoreLocation & { place: string };

export function storeLocation(deps: Deps): SavedLocation | null {
  const saved = deps.household.setting(LOCATION_KEY);
  return saved ? JSON.parse(saved) as SavedLocation : null;
}

export async function setStoreZip(deps: Deps, zip: string | null): Promise<SavedLocation | null> {
  if (zip === null || !zip.trim()) {
    deps.unitOfWork.run(() => {
      deps.household.saveSetting(LOCATION_KEY, null);
      forgetLookedUp(deps);
    });
    return null;
  }
  const clean = zip.trim();
  if (!/^\d{5}$/.test(clean)) throw new Error('A ZIP code is five digits.');
  if (storeLocation(deps)?.zip === clean) return storeLocation(deps);
  const found = await deps.zips.locate(clean);
  if (!found) throw new UserError(`We couldn’t find ZIP ${clean}.`, 404);
  const location = { zip: clean, ...found };
  deps.household.saveSetting(LOCATION_KEY, JSON.stringify(location));
  forgetLookedUp(deps);
  return location;
}

/** Those prices were for a store near a ZIP that's no longer set. Typed and receipt prices aren't. */
function forgetLookedUp(deps: Deps): void {
  deps.prices.forgetLookups('aldi');
  forgetMisses(deps);
}
