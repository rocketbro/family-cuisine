// One item, kept more than one way: 1 lb of ground beef in the fridge and 5 lb in the freezer,
// or 4 cans of black beans and a bag of dried. Recipes see the total (portion-amounts.ts), while
// dates belong to each portion, so plenty in the freezer doesn't read as "use soon". Most items
// never have portions and stay plain have / low / out.
import type { ISODate } from './dates.ts';
import { formatAmount } from './quantity.ts';
import { unitLabel, type Unit } from './units.ts';
import { dateAfterChange } from './use-by.ts';

export type Storage = 'fresh' | 'frozen' | 'canned' | 'dried';
export const STORAGES: Storage[] = ['fresh', 'frozen', 'canned', 'dried'];

export type Portion = {
  storage: Storage;
  /** Null means "some": there's a portion, but nobody knows how much. */
  amount: number | null;
  /** Null means counted pieces ("3 chicken breasts"). */
  unit: Unit | null;
  /** Ounces on each can's label, for a canned portion counted in cans. */
  canOz: number | null;
  useBy: ISODate | null;
  useByEstimated: boolean;
};

/** An amount of 0 removes the portion. Leaving useBy or canOz out keeps what it has. */
export type PortionChange = Pick<Portion, 'storage' | 'amount' | 'unit'> & { useBy?: ISODate | null; canOz?: number | null };

type LastsDays = { current: number | null; changed?: number | null };

export function mergePortions(current: readonly Portion[], changes: readonly PortionChange[], lasts: LastsDays, today: ISODate): Portion[] {
  const merged: Portion[] = [];
  for (const storage of STORAGES) {
    const existing = current.find(p => p.storage === storage) ?? null;
    const change = changes.find(c => c.storage === storage) ?? null;
    if (!existing && !change) continue;
    if (change && change.amount !== null && change.amount <= 0) continue;
    const useBy = change?.useBy === existing?.useBy ? undefined : change?.useBy;
    const dates = storage === 'fresh'
      ? dateAfterChange(
          { status: 'have', useBy: existing?.useBy ?? null, useByEstimated: existing?.useByEstimated ?? false, lastsDays: lasts.current },
          { useBy, lastsDays: lasts.changed },
          today,
        )
      : useBy !== undefined
        ? { useBy, useByEstimated: false }
        : { useBy: existing?.useBy ?? null, useByEstimated: existing?.useByEstimated ?? false };
    const canOz = change?.canOz !== undefined ? change.canOz : existing?.canOz ?? null;
    merged.push({ storage, amount: change ? change.amount : existing!.amount, unit: change ? change.unit : existing!.unit, canOz, ...dates });
  }
  return merged;
}

/** The item's own date is its soonest portion's, which is what "Use soon" and the planner read. */
export function soonestDate(portions: readonly Pick<Portion, 'useBy' | 'useByEstimated'>[]): Pick<Portion, 'useBy' | 'useByEstimated'> {
  const dated = portions.filter(p => p.useBy !== null).sort((a, b) => a.useBy!.localeCompare(b.useBy!))[0];
  return dated ? { useBy: dated.useBy, useByEstimated: dated.useByEstimated } : { useBy: null, useByEstimated: false };
}

type Described = Pick<Portion, 'storage' | 'amount' | 'unit'> & { canOz?: number | null };

/** "1 lb fresh", "3 frozen", "some frozen", "4 × 15.5 oz cans", "2 lb dried". */
export function portionText(portion: Described): string {
  if (portion.amount === null) return `some ${portion.storage}`;
  if (portion.storage === 'canned' && portion.unit === 'can') {
    const can = unitLabel('can', portion.amount);
    return portion.canOz ? `${formatAmount(portion.amount)} × ${formatAmount(portion.canOz)} oz ${can}` : `${formatAmount(portion.amount)} ${can}`;
  }
  const unit = portion.unit ? ` ${unitLabel(portion.unit, portion.amount)}` : '';
  return `${formatAmount(portion.amount)}${unit} ${portion.storage}`;
}

export function portionsText(portions: readonly Described[]): string {
  return portions.map(portionText).join(' · ');
}

/** How the planner and the dice are told what's going off: "ground beef (1 lb fresh, by 2026-11-08)". */
export function useSoonText(item: { name: string; useBy: ISODate | null; portions: readonly Portion[] }): string {
  const portion = item.portions.find(p => p.useBy === item.useBy);
  return `${item.name} (${portion ? `${portionText(portion)}, ` : ''}by ${item.useBy})`;
}

/** What buying more changes: the amount of the way it's usually bought is no longer known. */
export function restocked(portions: readonly Portion[]): PortionChange {
  const kept = portions.find(p => p.storage !== 'frozen');
  if (!kept) return { storage: 'fresh', amount: null, unit: null };
  return { storage: kept.storage, amount: null, unit: kept.unit };
}
