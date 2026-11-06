import type { Store } from '../../../domain/pantry.ts';
import type { PriceSource } from '../../../domain/prices.ts';
import type { PriceRepository } from '../../application/ports/prices.ts';
import type { DB } from './connection.ts';

type Row = { pantry_item_id: number; cents: number; source: PriceSource; product: string | null; updated_at: string };

export function sqlitePriceRepository(db: DB): PriceRepository {
  return {
    forStore(store: Store) {
      const rows = db.prepare('SELECT pantry_item_id, cents, source, product, updated_at FROM item_prices WHERE store = ?').all(store) as Row[];
      return new Map(rows.map(r => [r.pantry_item_id, { cents: r.cents, source: r.source, product: r.product, checkedAt: `${r.updated_at.replace(' ', 'T')}Z` }]));
    },
    save(pantryItemId, store, price) {
      if (price === null) {
        db.prepare('DELETE FROM item_prices WHERE pantry_item_id = ? AND store = ?').run(pantryItemId, store);
        return;
      }
      db.prepare(`INSERT INTO item_prices (pantry_item_id, store, cents, source, product) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (pantry_item_id, store) DO UPDATE SET cents = excluded.cents, source = excluded.source, product = excluded.product, updated_at = datetime('now')`)
        .run(pantryItemId, store, price.cents, price.source, price.product);
    },
    forgetLookups(store) {
      db.prepare("DELETE FROM item_prices WHERE store = ? AND source = 'lookup'").run(store);
    },
  };
}
