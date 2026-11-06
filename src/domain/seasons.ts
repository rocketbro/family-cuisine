// Which time of year a recipe is for. No seasons listed means it's good all year.
import type { ISODate } from './dates.ts';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

/** By month: December starts winter, March spring, June summer, September fall. */
export function seasonOf(date: ISODate): Season {
  const month = Number(date.slice(5, 7));
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'fall';
}

export function inSeason(recipe: { seasons: readonly Season[] }, date: ISODate): boolean {
  return !recipe.seasons.length || recipe.seasons.includes(seasonOf(date));
}

/** Clean list for storing: known seasons in order, and none at all when it's all four. */
export function normalSeasons(values: readonly unknown[]): Season[] {
  const kept = SEASONS.filter(season => values.includes(season));
  return kept.length === SEASONS.length ? [] : kept;
}
