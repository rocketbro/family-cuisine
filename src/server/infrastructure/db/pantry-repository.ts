import type { StockGoal } from '../../../domain/stock-up.ts';
import type { PackSize } from '../../../domain/pack-size.ts';
import type { PantryItem } from '../../../domain/pantry.ts';
import type { Portion } from '../../../domain/portions.ts';
import type { PantryInput, PantryRepository } from '../../application/ports/pantry.ts';
import type { DB } from './connection.ts';

type Row = {
  id: number; name: string; category: string; status: PantryItem['status']; count: number | null; staple: number;
  store: PantryItem['store']; walmart_item_id: string | null; pack_size: string | null; stock_up: string | null;
  min_packages: number; occasional: number; use_by: string | null; use_by_estimated: number;
  lasts_days: number | null; also_called: string;
};

type PortionRow = {
  pantry_item_id: number; storage: Portion['storage']; amount: number | null; unit: Portion['unit'];
  can_oz: number | null; use_by: string | null; use_by_estimated: number;
};

const toPortion = (row: PortionRow): Portion => ({
  storage: row.storage, amount: row.amount, unit: row.unit, canOz: row.can_oz, useBy: row.use_by, useByEstimated: row.use_by_estimated === 1,
});

const toItem = (row: Row, portions: Portion[]): PantryItem => ({
  id: row.id, name: row.name, category: row.category, status: row.status, count: row.count,
  staple: row.staple === 1, store: row.store, walmartItemId: row.walmart_item_id,
  packSize: row.pack_size ? JSON.parse(row.pack_size) as PackSize : null,
  stockUp: row.stock_up ? JSON.parse(row.stock_up) as StockGoal : null, minPackages: row.min_packages,
  occasional: row.occasional === 1,
  useBy: row.use_by, useByEstimated: row.use_by_estimated === 1, lastsDays: row.lasts_days, portions, alsoCalled: JSON.parse(row.also_called) as string[],
});

const COLUMNS: Record<keyof PantryInput, string> = {
  name: 'name', category: 'category', status: 'status', count: 'count', staple: 'staple', store: 'store',
  walmartItemId: 'walmart_item_id', packSize: 'pack_size', stockUp: 'stock_up', minPackages: 'min_packages',
  occasional: 'occasional', useBy: 'use_by', useByEstimated: 'use_by_estimated', lastsDays: 'lasts_days',
  alsoCalled: 'also_called',
};

export function sqlitePantryRepository(db: DB): PantryRepository {
  const get = (id: number) => {
    const row = db.prepare('SELECT * FROM pantry_items WHERE id = ?').get(id) as Row | undefined;
    return row ? toItem(row, portionsOf(id)) : null;
  };
  const portionsOf = (id: number) =>
    (db.prepare('SELECT * FROM pantry_portions WHERE pantry_item_id = ? ORDER BY storage').all(id) as PortionRow[]).map(toPortion);
  return {
    list() {
      const portions = new Map<number, Portion[]>();
      for (const row of db.prepare('SELECT * FROM pantry_portions ORDER BY storage').all() as PortionRow[]) {
        portions.set(row.pantry_item_id, [...(portions.get(row.pantry_item_id) ?? []), toPortion(row)]);
      }
      return (db.prepare('SELECT * FROM pantry_items ORDER BY category, name').all() as Row[]).map(row => toItem(row, portions.get(row.id) ?? []));
    },
    get,
    findByName(name) {
      const row = db.prepare('SELECT * FROM pantry_items WHERE name = ?').get(name.trim()) as Row | undefined;
      return row ? toItem(row, portionsOf(row.id)) : null;
    },
    setPortions: db.transaction((id: number, portions: Portion[]) => {
      db.prepare('DELETE FROM pantry_portions WHERE pantry_item_id = ?').run(id);
      const insert = db.prepare('INSERT INTO pantry_portions (pantry_item_id, storage, amount, unit, can_oz, use_by, use_by_estimated) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const p of portions) insert.run(id, p.storage, p.amount, p.unit, p.canOz, p.useBy, p.useByEstimated ? 1 : 0);
    }),
    create(input) {
      const result = db.prepare(
        `INSERT INTO pantry_items (name, category, status, count, staple, store, walmart_item_id, min_packages, occasional,
          use_by, use_by_estimated, lasts_days, also_called)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.name.trim(), input.category ?? 'Other', input.status ?? 'have', input.count ?? null,
        input.staple ? 1 : 0, input.store ?? 'any', input.walmartItemId ?? null, input.minPackages ?? 1,
        input.occasional ? 1 : 0, input.useBy ?? null, input.useByEstimated ? 1 : 0, input.lastsDays ?? null,
        JSON.stringify(input.alsoCalled ?? []),
      );
      return get(Number(result.lastInsertRowid))!;
    },
    update(id, patch) {
      const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof PantryInput, unknown][];
      if (entries.length) {
        const sets = entries.map(([key]) => `${COLUMNS[key]} = ?`).join(', ');
        const values = entries.map(([key, value]) => (
          key === 'staple' || key === 'occasional' || key === 'useByEstimated' ? (value ? 1 : 0)
            : key === 'alsoCalled' || ((key === 'packSize' || key === 'stockUp') && value) ? JSON.stringify(value)
              : value
        ));
        db.prepare(`UPDATE pantry_items SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
      }
      return get(id);
    },
    remove: id => void db.prepare('DELETE FROM pantry_items WHERE id = ?').run(id),
  };
}
