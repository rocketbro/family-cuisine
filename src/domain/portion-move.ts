// Moving stock between the fridge and the freezer: nothing is added and nothing is used, so the
// total stays what it was. Only those two swap, because food doesn't turn canned or dried.
//
// The date follows where the food now is. Freezing stops the clock, so a date from the fridge
// doesn't follow it in: a past-date fresh item doesn't read as past its date once frozen. Thawing
// starts the clock, so what comes out gets a new estimate from how long the item lasts, and a
// sooner date already on the fresh stays. What stays behind keeps the date it had.
import { addDays, shortDate, type ISODate } from './dates.ts';
import type { PantryItem } from './pantry.ts';
import { portionText, portionsText, soonestDate, STORAGES, type Portion, type Storage } from './portions.ts';
import { formatAmount } from './quantity.ts';
import { convert, dimensionOf, unitLabel, type Unit } from './units.ts';

/** `amount` is in the unit of what's being moved. Null moves all of it. */
export type PortionMove = { from: Storage; to: Storage; amount: number | null };

type Stock = Pick<PantryItem, 'status' | 'count' | 'portions' | 'useBy' | 'useByEstimated'>;
type Dates = Pick<Portion, 'useBy' | 'useByEstimated'>;

const NO_DATE: Dates = { useBy: null, useByEstimated: false };
const SWAPS: Partial<Record<Storage, Storage>> = { fresh: 'frozen', frozen: 'fresh' };

/** Where this form can move to, if anywhere. */
export function moveTarget(storage: Storage): Storage | null {
  return SWAPS[storage] ?? null;
}

/** What's in the house, as portions. A plain or counted item has no form of its own yet, so it counts as fresh. */
export function stockAsPortions(item: Stock): Portion[] {
  if (item.portions.length) return item.portions;
  if (item.status === 'out') return [];
  return [{ storage: 'fresh', amount: item.count, unit: null, canOz: null, useBy: item.useBy, useByEstimated: item.useByEstimated }];
}

const hundredths = (amount: number) => Math.round(amount * 100) / 100;

/** The amount in `to`, or null when the two can't be compared: a pound isn't a package. */
function amountIn(amount: number, from: Unit | null, to: Unit | null): number | null {
  if (from === to) return amount;
  if (!from || !to || dimensionOf(from) === 'count' || dimensionOf(from) !== dimensionOf(to)) return null;
  return convert(amount, from, to);
}

function datesAfterMove(to: Storage, existing: Portion | null, lastsDays: number | null, today: ISODate): Dates {
  const own = existing ? { useBy: existing.useBy, useByEstimated: existing.useByEstimated } : NO_DATE;
  if (to === 'frozen') return own;
  return soonestDate([own, lastsDays ? { useBy: addDays(today, lastsDays), useByEstimated: true } : NO_DATE]);
}

export type MoveResult = { portions: Portion[] } | { problem: string };

/** The portions after a move, or why it can't happen, in words for the person. */
export function portionsAfterMove(current: readonly Portion[], move: PortionMove, lastsDays: number | null, today: ISODate): MoveResult {
  const source = current.find(p => p.storage === move.from);
  if (!source) return { problem: `There’s no ${move.from} to move.` };
  if (moveTarget(move.from) !== move.to) return { problem: `Only fresh and frozen can move.` };
  const moved = source.amount === null ? null : move.amount ?? source.amount;
  if (moved !== null && moved <= 0) return { problem: 'Say how much to move.' };
  if (moved !== null && moved > source.amount!) return { problem: `There’s only ${portionText(source)}.` };

  const existing = current.find(p => p.storage === move.to) ?? null;
  let amount = moved;
  if (existing) {
    const added = moved === null ? null : amountIn(moved, source.unit, existing.unit);
    if (moved !== null && existing.amount !== null && added === null) {
      return { problem: `The ${move.to} is measured differently. Change one to match, then move it.` };
    }
    amount = added === null || existing.amount === null ? null : hundredths(existing.amount + added);
  }
  const arrived: Portion = {
    storage: move.to, amount, unit: existing?.unit ?? source.unit, canOz: existing?.canOz ?? source.canOz,
    ...datesAfterMove(move.to, existing, lastsDays, today),
  };
  const left = moved === null || moved === source.amount ? null : { ...source, amount: hundredths(source.amount! - moved) };
  const others = current.filter(p => p.storage !== move.from && p.storage !== move.to);
  const portions = [...others, arrived, ...(left ? [left] : [])];
  return { portions: portions.sort((a, b) => STORAGES.indexOf(a.storage) - STORAGES.indexOf(b.storage)) };
}

/** "3 lb", when every amount is known and they can be added up. */
export function totalText(portions: readonly Portion[]): string | null {
  if (!portions.length) return null;
  const unit = portions[0].unit;
  let total = 0;
  for (const portion of portions) {
    const amount = portion.amount === null ? null : amountIn(portion.amount, portion.unit, unit);
    if (amount === null) return null;
    total += amount;
  }
  return unit ? `${formatAmount(total)} ${unitLabel(unit, total)}` : formatAmount(total);
}

function dateNote(source: Portion, move: PortionMove, wasAll: boolean, arrived: Portion): string | null {
  if (move.to === 'fresh') {
    if (!arrived.useBy) return 'No use-by date until you set one.';
    return `Use by ${arrived.useByEstimated ? 'about ' : ''}${shortDate(arrived.useBy)}.`;
  }
  if (!source.useBy) return null;
  return wasAll ? 'Its use-by date comes off.' : `The ${move.from} keeps its use-by date.`;
}

export type MovePreview = { before: string; after: string; total: string; date: string | null };

/** What a move will do, said before it happens. */
export function movePreview(current: readonly Portion[], move: PortionMove, lastsDays: number | null, today: ISODate): MovePreview | { problem: string } {
  const result = portionsAfterMove(current, move, lastsDays, today);
  if ('problem' in result) return result;
  const source = current.find(p => p.storage === move.from)!;
  const arrived = result.portions.find(p => p.storage === move.to)!;
  const wasAll = !result.portions.some(p => p.storage === move.from);
  const total = totalText(result.portions);
  return {
    before: portionsText(current),
    after: portionsText(result.portions),
    total: total ? `Still ${total} in all.` : 'Nothing added, only moved.',
    date: dateNote(source, move, wasAll, arrived),
  };
}
