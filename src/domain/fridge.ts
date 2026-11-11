// "In the fridge": bits that should be used up but aren't pantry stock ("sautéed onions, peppers and
// black beans"). Short lines in the family's words, gone by themselves after a few days or when
// someone says they're used up. Nothing here touches the pantry, the list or what a recipe can be made from.
import { addDays, weekdayName, type ISODate } from './dates.ts';
import type { PlanEntry } from './plan.ts';

/** A line drops off by itself once it has been there this many days. */
export const FRIDGE_DAYS = 5;
export const FRIDGE_TEXT_MAX = 120;
const MAX_LINES = 30;

export type FridgeLine = {
  id: string;
  text: string;
  since: ISODate;
  /** The dinner it came from, when it was added by answering "Any dinner left?". */
  dinner: ISODate | null;
};

export function daysThere(line: Pick<FridgeLine, 'since'>, today: ISODate): number {
  let days = 0;
  for (let d = line.since; d < today && days <= FRIDGE_DAYS; d = addDays(d, 1)) days++;
  return days;
}

/** What's still good to count on: soonest gone (oldest) first. */
export function inTheFridge(lines: readonly FridgeLine[], today: ISODate): FridgeLine[] {
  return lines
    .filter(line => line.since <= today && daysThere(line, today) < FRIDGE_DAYS)
    .sort((a, b) => a.since.localeCompare(b.since));
}

/** How long a line has been there, in a few words. */
export function fridgeAge(line: Pick<FridgeLine, 'since'>, today: ISODate): string {
  const days = daysThere(line, today);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days`;
}

export function cleanFridgeText(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, FRIDGE_TEXT_MAX).trim();
  return clean || null;
}

/** Adds a line, unless the same words (or the same dinner) are already there: then it stays as it was. */
export function withFridgeLine(lines: readonly FridgeLine[], line: FridgeLine, today: ISODate): FridgeLine[] {
  const kept = inTheFridge(lines, today);
  const twin = (l: FridgeLine) => (line.dinner !== null && l.dinner === line.dinner) || l.text.toLowerCase() === line.text.toLowerCase();
  return kept.some(twin) ? kept : [...kept, line].slice(-MAX_LINES);
}

export function withoutFridgeLine(lines: readonly FridgeLine[], id: string): FridgeLine[] {
  return lines.filter(l => l.id !== id);
}

/** Saying there's none left from a dinner takes its line out. */
export function withoutDinnerLine(lines: readonly FridgeLine[], dinner: ISODate): FridgeLine[] {
  return lines.filter(l => l.dinner !== dinner);
}

/** Eating a dinner as its planned leftovers uses its line up. Leftovers that aren't of a dinner can't say which. */
export function withoutEatenLeftovers(lines: readonly FridgeLine[], entry: PlanEntry): FridgeLine[] {
  if (entry.kind !== 'leftovers' || entry.outcome !== 'made' || !entry.leftoversOf) return [...lines];
  return withoutDinnerLine(lines, entry.leftoversOf.date);
}

/** What the model is told: oldest first, with how long each has been there. */
export type FridgeForModel = { text: string; since: string; daysThere: number };

export function fridgeForModel(lines: readonly FridgeLine[], today: ISODate): FridgeForModel[] {
  return inTheFridge(lines, today).map(l => ({ text: l.text, since: `${weekdayName(l.since)} ${l.since}`, daysThere: daysThere(l, today) }));
}
