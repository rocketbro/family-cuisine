// Learns what size each linked Walmart product comes in, so the cart can buy enough on its own.
// Only when WALMART_PRODUCT_LOOKUP is on (see the README). Off, nothing is called and nothing is
// written, so a product still gets read if the lookup is turned on later.
// A product is read once. If Walmart stops answering, it waits an hour and picks up where it left off.
import { parsePackSize } from '../../domain/pack-size.ts';
import type { Deps } from './deps.ts';

const BETWEEN_PRODUCTS_MS = 1500;
const AFTER_FAILURE_MS = 60 * 60 * 1000;

export async function readWalmartPack(deps: Pick<Deps, 'pantry' | 'walmartProducts'>, id: number, itemId: string): Promise<void> {
  if (!deps.walmartProducts) return;
  const name = await deps.walmartProducts.productName(itemId);
  // A product Walmart no longer sells has no size to find, and shouldn't hold up the rest.
  deps.pantry.update(id, { packSize: name ? parsePackSize(name) : { count: null, measure: null } });
}

export async function learnWalmartPacks(deps: Pick<Deps, 'pantry' | 'walmartProducts' | 'lookups' | 'log'>): Promise<void> {
  const { lookups } = deps;
  if (!deps.walmartProducts || lookups.walmartSweeping || Date.now() - lookups.walmartFailedAt < AFTER_FAILURE_MS) return;
  lookups.walmartSweeping = true;
  try {
    for (const item of deps.pantry.list()) {
      if (!item.walmartItemId || item.packSize) continue;
      await readWalmartPack(deps, item.id, item.walmartItemId);
      await new Promise(resolve => setTimeout(resolve, BETWEEN_PRODUCTS_MS));
    }
  } catch (error) {
    lookups.walmartFailedAt = Date.now();
    deps.log(`Walmart package sizes paused: ${(error as Error).message}`);
  } finally {
    lookups.walmartSweeping = false;
  }
}
