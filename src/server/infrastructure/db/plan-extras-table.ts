// Extras, kept apart from `plan_entries` because a day has any number of them. Each is a plan entry
// to the rest of the app, with `extra-<id>` for its slot.
import { extraId, extraSlot, type ExtraSlot } from '../../../domain/plan-slot.ts';
import type { PlanEntry } from '../../../domain/plan.ts';
import type { DB } from './connection.ts';

type Row = {
  id: number; date: string; kind: PlanEntry['kind']; recipe_slug: string | null; multiplier: number; note: string | null;
  outcome: PlanEntry['outcome']; outcome_slug: string | null; pantry_settled: number; checkin_settled: number; substituted: string | null;
};

const toEntry = (row: Row): PlanEntry => ({
  date: row.date, slot: extraSlot(row.id), kind: row.kind, recipeSlug: row.recipe_slug, multiplier: row.multiplier,
  note: row.note, outcome: row.outcome, outcomeSlug: row.outcome_slug,
  pantrySettled: row.pantry_settled === 1, checkinSettled: row.checkin_settled === 1,
  substituted: row.substituted ? JSON.parse(row.substituted) as PlanEntry['substituted'] : null,
  pinned: true, leftoversOf: null, drafted: null,
});

const toRow = (entry: Omit<PlanEntry, 'slot'>) => ({
  date: entry.date, kind: entry.kind, recipeSlug: entry.recipeSlug, multiplier: entry.multiplier, note: entry.note,
  outcome: entry.outcome, outcomeSlug: entry.outcomeSlug,
  pantrySettled: entry.pantrySettled ? 1 : 0, checkinSettled: entry.checkinSettled ? 1 : 0,
  substituted: entry.substituted ? JSON.stringify(entry.substituted) : null,
});

const COLUMNS = `date, kind, recipe_slug, multiplier, note, outcome, outcome_slug, pantry_settled, checkin_settled, substituted`;
const VALUES = `@date, @kind, @recipeSlug, @multiplier, @note, @outcome, @outcomeSlug, @pantrySettled, @checkinSettled, @substituted`;

export function planExtrasTable(db: DB) {
  return {
    range: (from: string, to: string): PlanEntry[] =>
      (db.prepare('SELECT * FROM plan_extras WHERE date BETWEEN ? AND ? ORDER BY date, id').all(from, to) as Row[]).map(toEntry),
    get(date: string, slot: ExtraSlot): PlanEntry | null {
      const row = db.prepare('SELECT * FROM plan_extras WHERE id = ? AND date = ?').get(extraId(slot), date) as Row | undefined;
      return row ? toEntry(row) : null;
    },
    /** A slot that's gone comes back under its own id: someone finishing cooking it is still a meal that happened. */
    upsert(entry: PlanEntry): void {
      db.prepare(
        `INSERT INTO plan_extras (id, ${COLUMNS}) VALUES (@id, ${VALUES})
         ON CONFLICT (id) DO UPDATE SET date = excluded.date, kind = excluded.kind, recipe_slug = excluded.recipe_slug,
           multiplier = excluded.multiplier, note = excluded.note, outcome = excluded.outcome, outcome_slug = excluded.outcome_slug,
           pantry_settled = excluded.pantry_settled, checkin_settled = excluded.checkin_settled, substituted = excluded.substituted`,
      ).run({ ...toRow(entry), id: extraId(entry.slot as ExtraSlot) });
    },
    add(entry: Omit<PlanEntry, 'slot'>): ExtraSlot {
      return extraSlot(Number(db.prepare(`INSERT INTO plan_extras (${COLUMNS}) VALUES (${VALUES})`).run(toRow(entry)).lastInsertRowid));
    },
    remove(date: string, slot: ExtraSlot): void {
      db.prepare('DELETE FROM plan_extras WHERE id = ? AND date = ?').run(extraId(slot), date);
    },
  };
}
