// The one import on its way, kept as JSON in a household setting. An import saved before ranges
// existed has a weekStart and meals still naming weekdays, and is brought up to date as it's read.
import { addDays, toISODate, type ISODate } from '../../domain/dates.ts';
import { datesInWrittenOrder } from '../../domain/plan-import-days.ts';
import { defaultImportRange, type ImportedMeal, type ImportRange } from '../../domain/plan-import.ts';
import type { Deps } from './deps.ts';
import { shopSchedule } from './shop-schedule.ts';

const SETTING = 'plan_import';

export type PlanImportRecord = {
  id: string; createdAt: string; text: string | null; hadPhotos: boolean;
  range: ImportRange;
  /** Off: planning this import only uses recipes in the book, kept picks included. */
  claudesIdeas: boolean;
} & (
  | { status: 'reading' }
  | { status: 'failed'; error: string }
  | { status: 'ready'; meals: ImportedMeal[] }
  | { status: 'saved'; saved: number; leftAlone: number }
);

type StoredMeal = ImportedMeal & { weekday?: number | null };
type Stored = Omit<PlanImportRecord, 'range' | 'claudesIdeas'> & {
  range?: ImportRange; claudesIdeas?: boolean; weekStart?: ISODate; meals?: StoredMeal[];
};

export function loadPlanImport(deps: Deps): PlanImportRecord | null {
  const stored = deps.household.setting(SETTING);
  return stored ? upToDate(JSON.parse(stored) as Stored, deps) : null;
}

export function keepPlanImport(deps: Deps, record: PlanImportRecord | null): void {
  deps.household.saveSetting(SETTING, record && JSON.stringify(record));
}

function upToDate({ weekStart, ...stored }: Stored, deps: Deps): PlanImportRecord {
  const range = stored.range
    ?? (weekStart ? { from: weekStart, through: addDays(weekStart, 6) } : defaultImportRange(toISODate(new Date()), shopSchedule(deps)));
  const record = { ...stored, range, claudesIdeas: stored.claudesIdeas ?? true } as PlanImportRecord;
  if (record.status !== 'ready' || !stored.meals) return record;
  const dates = datesInWrittenOrder(stored.meals.map(m => ({ date: m.date, weekday: m.weekday ?? null })), range);
  return { ...record, meals: stored.meals.map(({ weekday: _named, ...meal }, i) => ({ ...meal, date: dates[i] })) };
}
