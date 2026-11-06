import type { PlanEntry } from '../../../domain/plan.ts';
import { isExtraSlot } from '../../../domain/plan-slot.ts';
import type { MealSlot } from '../../../domain/recipe.ts';
import type { PlanRepository } from '../../application/ports/plan.ts';
import type { DB } from './connection.ts';
import { planExtrasTable } from './plan-extras-table.ts';

type Row = {
  date: string; slot: MealSlot; kind: PlanEntry['kind']; recipe_slug: string | null; multiplier: number;
  leftovers_date: string | null; leftovers_slot: MealSlot | null; note: string | null; outcome: PlanEntry['outcome'];
  outcome_slug: string | null; pantry_settled: number; checkin_settled: number; substituted: string | null;
  pinned: number; drafted: string | null;
};

const SLOT_ORDER = `CASE slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 ELSE 2 END`;

const toEntry = (row: Row): PlanEntry => ({
  date: row.date, slot: row.slot, kind: row.kind, recipeSlug: row.recipe_slug, multiplier: row.multiplier,
  leftoversOf: row.leftovers_date && row.leftovers_slot ? { date: row.leftovers_date, slot: row.leftovers_slot } : null,
  note: row.note, outcome: row.outcome, outcomeSlug: row.outcome_slug, pantrySettled: row.pantry_settled === 1,
  checkinSettled: row.checkin_settled === 1,
  substituted: row.substituted ? JSON.parse(row.substituted) as PlanEntry['substituted'] : null,
  pinned: row.pinned === 1,
  drafted: row.drafted ? JSON.parse(row.drafted) as PlanEntry['drafted'] : null,
});

const INSERT = `INSERT INTO plan_entries (date, slot, kind, recipe_slug, multiplier, leftovers_date, leftovers_slot, note,
  outcome, outcome_slug, pantry_settled, checkin_settled, substituted, pinned, drafted)
         VALUES (@date, @slot, @kind, @recipeSlug, @multiplier, @leftoversDate, @leftoversSlot,
           @note, @outcome, @outcomeSlug, @pantrySettled, @checkinSettled, @substituted, @pinned, @drafted)`;

const toRow = (entry: PlanEntry) => ({
  date: entry.date, slot: entry.slot, kind: entry.kind, recipeSlug: entry.recipeSlug, multiplier: entry.multiplier,
  leftoversDate: entry.leftoversOf?.date ?? null, leftoversSlot: entry.leftoversOf?.slot ?? null,
  note: entry.note, outcome: entry.outcome, outcomeSlug: entry.outcomeSlug,
  pantrySettled: entry.pantrySettled ? 1 : 0, checkinSettled: entry.checkinSettled ? 1 : 0,
  substituted: entry.substituted ? JSON.stringify(entry.substituted) : null, pinned: entry.pinned ? 1 : 0,
  drafted: entry.drafted ? JSON.stringify(entry.drafted) : null,
});

/** Meals live in `plan_entries` and extras in `plan_extras`; nothing outside this adapter sees the difference. */
export function sqlitePlanRepository(db: DB): PlanRepository {
  const extras = planExtrasTable(db);
  return {
    range(from, to) {
      const meals = (db.prepare(`SELECT * FROM plan_entries WHERE date BETWEEN ? AND ? ORDER BY date, ${SLOT_ORDER}`).all(from, to) as Row[]).map(toEntry);
      // Sorting is stable, so each day's extras stay behind its meals, in the order they were added.
      return [...meals, ...extras.range(from, to)].sort((a, b) => a.date.localeCompare(b.date));
    },
    get(date, slot) {
      if (isExtraSlot(slot)) return extras.get(date, slot);
      const row = db.prepare('SELECT * FROM plan_entries WHERE date = ? AND slot = ?').get(date, slot) as Row | undefined;
      return row ? toEntry(row) : null;
    },
    upsert(entry) {
      if (isExtraSlot(entry.slot)) return extras.upsert(entry);
      db.prepare(
        `${INSERT}
         ON CONFLICT (date, slot) DO UPDATE SET kind = excluded.kind, recipe_slug = excluded.recipe_slug, multiplier = excluded.multiplier,
           leftovers_date = excluded.leftovers_date, leftovers_slot = excluded.leftovers_slot, note = excluded.note,
           outcome = excluded.outcome, outcome_slug = excluded.outcome_slug, pantry_settled = excluded.pantry_settled,
             checkin_settled = excluded.checkin_settled, substituted = excluded.substituted, pinned = excluded.pinned, drafted = excluded.drafted`,
      ).run(toRow(entry));
    },
    fillIfOpen: entry => !isExtraSlot(entry.slot) && db.prepare(`${INSERT} ON CONFLICT (date, slot) DO NOTHING`).run(toRow(entry)).changes === 1,
    remove(date, slot) {
      if (isExtraSlot(slot)) extras.remove(date, slot);
      else db.prepare('DELETE FROM plan_entries WHERE date = ? AND slot = ?').run(date, slot);
    },
    addExtra: extras.add,
  };
}
