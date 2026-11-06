import type { Receipt, TripLine } from '../../../domain/receipts.ts';
import type { ReceiptRecord, ReceiptRepository } from '../../application/ports/receipts.ts';
import type { DB } from './connection.ts';

type Row = {
  id: number; shop_date: string; store: Receipt['store']; purchased_on: string | null; total_cents: number | null;
  status: Receipt['status']; error: string | null; files: string; lines: string; created_at: string;
};

const toRecord = (row: Row): ReceiptRecord => ({
  id: row.id, shopDate: row.shop_date, store: row.store, purchasedOn: row.purchased_on, totalCents: row.total_cents, status: row.status, error: row.error,
  files: JSON.parse(row.files) as ReceiptRecord['files'], lines: JSON.parse(row.lines) as Receipt['lines'],
  createdAt: row.created_at.includes('T') ? row.created_at : `${row.created_at.replace(' ', 'T')}Z`,
});

export function sqliteReceiptRepository(db: DB): ReceiptRepository {
  return {
    list: () => (db.prepare('SELECT * FROM receipts ORDER BY shop_date DESC, id DESC').all() as Row[]).map(toRecord),
    get(id) {
      const row = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as Row | undefined;
      return row ? toRecord(row) : null;
    },
    create(shopDate, files) {
      const result = db.prepare(`INSERT INTO receipts (shop_date, store, status, files) VALUES (?, 'other', 'reading', ?)`).run(shopDate, JSON.stringify(files));
      return Number(result.lastInsertRowid);
    },
    update(id, patch) {
      const current = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as Row | undefined;
      if (!current) return;
      const next = { ...toRecord(current), ...patch };
      db.prepare('UPDATE receipts SET shop_date = ?, store = ?, purchased_on = ?, total_cents = ?, status = ?, error = ?, lines = ?, created_at = ? WHERE id = ?')
        .run(next.shopDate, next.store, next.purchasedOn, next.totalCents, next.status, next.error, JSON.stringify(next.lines), next.createdAt, id);
    },
    remove: id => void db.prepare('DELETE FROM receipts WHERE id = ?').run(id),
    tripList(shopDate) {
      const row = db.prepare('SELECT lines FROM trip_lists WHERE shop_date = ?').get(shopDate) as { lines: string } | undefined;
      return row ? JSON.parse(row.lines) as TripLine[] : null;
    },
    tripDates: () => (db.prepare('SELECT shop_date FROM trip_lists').all() as { shop_date: string }[]).map(r => r.shop_date),
    saveTripList(shopDate, lines) {
      db.prepare(`INSERT INTO trip_lists (shop_date, lines) VALUES (?, ?) ON CONFLICT (shop_date) DO UPDATE SET lines = excluded.lines, saved_at = datetime('now')`)
        .run(shopDate, JSON.stringify(lines));
    },
  };
}
