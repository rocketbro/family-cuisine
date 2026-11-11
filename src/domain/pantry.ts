// The pantry is deliberately coarse: most things are have / low / out. Only items where the
// number matters (eggs, cans) carry a count. 80% accurate and easy beats exact and stale.
import type { StockGoal } from './stock-up.ts';
import type { PackSize } from './pack-size.ts';
import type { ISODate } from './dates.ts';
import type { Portion } from './portions.ts';

export type StockStatus = 'have' | 'low' | 'out';

/** Where this item is bought. "any" follows the week's store choice. */
export type StorePreference = 'any' | 'aldi' | 'walmart';
export type Store = 'aldi' | 'walmart';

export type PantryItem = {
  id: number;
  name: string;
  category: string;
  status: StockStatus;
  /** Set only for counted items; null means "just have / low / out". */
  count: number | null;
  /** Assumed always on hand (salt, water, oil). Never asked about, never shopped for. */
  staple: boolean;
  store: StorePreference;
  walmartItemId: string | null;
  /** What the product comes as, read off its Walmart page or typed in Settings; the list uses it at either store. Null until known. */
  packSize: PackSize | null;
  /** A store of it worth building up when the budget has room. */
  stockUp: StockGoal | null;
  /** The fewest packages to buy: 1, except produce sold by the each (5 bananas). Planned meals can call for more. */
  minPackages: number;
  /**
   * Bought now and then rather than kept stocked: being out doesn't put it on the list, only a
   * recipe that needs it does. Having one doesn't change this; only "Keep stocked" does.
   */
  occasional: boolean;
  /** The soonest date to use it by. Null for anything where it doesn't matter. */
  useBy: ISODate | null;
  /** The date came from lastsDays, not off a package. */
  useByEstimated: boolean;
  /** How long it usually keeps once bought; sets useBy each time it's restocked. */
  lastsDays: number | null;
  /** Fresh and frozen amounts, when it's kept both ways. Empty for most things. */
  portions: Portion[];
  /** Other names a recipe might use for it: raspberry preserves are also "jam". */
  alsoCalled: string[];
};

export const CATEGORIES = ['Produce', 'Dairy & eggs', 'Meat', 'Pantry', 'Baking', 'Bread', 'Frozen', 'Spices', 'Other'];

const WORD_FIXES: Record<string, string> = { leaves: 'leaf', loaves: 'loaf', tomatoes: 'tomato', potatoes: 'potato' };

/** Lowercase, punctuation-free, singular words. "Large Eggs" and "large egg" agree. */
export function nameKey(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(singular);
}

export function singular(word: string): string {
  if (WORD_FIXES[word]) return WORD_FIXES[word];
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Whether the last words of a name are exactly `tail` ("large eggs" ends with "egg"). */
export function endsWith(words: string[], tail: string[]): boolean {
  return tail.length > 0 && tail.length <= words.length && tail.every((w, i) => words[words.length - tail.length + i] === w);
}

const STOCK_ORDER: Record<StockStatus, number> = { have: 0, low: 1, out: 2 };

/** Any pantry name inside the ingredient beats an also-called name, which beats a more particular kind. */
const CONTAINED_NAME = 100;
const SAME_AS_ALSO_CALLED = 90;
const CONTAINS_ALSO_CALLED = 80;

type Match = { item: PantryItem; score: number; alsoCalled: boolean; shared: number };

function matchFor(key: string[], item: PantryItem): Match | null {
  const joined = key.join(' ');
  const name = nameKey(item.name);
  const shared = name.filter(word => key.includes(word)).length;
  if (name.join(' ') === joined) return { item, score: 1000, alsoCalled: false, shared };
  if (endsWith(key, name)) return { item, score: CONTAINED_NAME + name.length * 10, alsoCalled: false, shared };
  const also = item.alsoCalled.map(nameKey);
  if (also.some(words => words.join(' ') === joined)) return { item, score: SAME_AS_ALSO_CALLED, alsoCalled: true, shared };
  const contained = also.filter(words => endsWith(key, words));
  if (contained.length) return { item, score: CONTAINS_ALSO_CALLED + Math.max(...contained.map(words => words.length)), alsoCalled: true, shared };
  return endsWith(name, key) ? { item, score: key.length * 10 - 1, alsoCalled: false, shared } : null;
}

/** Among equally good matches: what's in the house, the closest wording, what's regularly bought, what goes off first. */
function betterMatch(a: Match, b: Match): number {
  return b.score - a.score
    || STOCK_ORDER[a.item.status] - STOCK_ORDER[b.item.status]
    || b.shared - a.shared
    || Number(a.item.occasional) - Number(b.item.occasional)
    || (a.item.useBy ?? '9999').localeCompare(b.item.useBy ?? '9999');
}

/**
 * Finds the pantry item a recipe ingredient means. Exact name first; then the most specific
 * pantry name that ends the ingredient ("large eggs" → "eggs"); then what an item is also called
 * ("jam" → "raspberry preserves"). Only then the reverse, so "all-purpose flour" is "flour", never
 * "einkorn all-purpose flour". Also-called names are interchangeable by definition, so one in the
 * house stands in when the best match has run out.
 */
export function findPantryItem(itemName: string, pantry: readonly PantryItem[]): PantryItem | null {
  const key = nameKey(itemName);
  if (!key.length) return null;
  const matches = pantry.flatMap(item => matchFor(key, item) ?? []).sort(betterMatch);
  const best = matches[0];
  if (!best) return null;
  if (best.item.status !== 'out') return best.item;
  return matches.find(m => m.alsoCalled && m.item.status !== 'out')?.item ?? best.item;
}

/**
 * Something in the house that's also called this item's name, so it covers it (basmati rice bought
 * instead of jasmine). Only a whole name counts, the same as an also-called match that stands in.
 */
export function standingIn(item: PantryItem, pantry: readonly PantryItem[]): PantryItem | null {
  const key = nameKey(item.name).join(' ');
  return pantry.find(other => other.id !== item.id && other.status !== 'out' && other.alsoCalled.some(name => nameKey(name).join(' ') === key)) ?? null;
}

export function nextStatus(status: StockStatus): StockStatus {
  return status === 'have' ? 'low' : status === 'low' ? 'out' : 'have';
}

/** What being low or out does to the shopping list, in words. Null when it does nothing yet. */
export function listEffect(item: Pick<PantryItem, 'status' | 'staple' | 'occasional'>): string | null {
  if (item.staple) return 'Always on hand, so it never goes on the list.';
  if (item.status === 'have') return null;
  return item.occasional ? 'Stays off the list until a recipe needs it.' : 'On the next grocery list.';
}

/** A counted item reads as low at this many or fewer. */
export const COUNT_LOW_AT = 2;

/** Counted items derive their status from the count so the two never disagree. */
export function statusForCount(count: number, lowAt = COUNT_LOW_AT): StockStatus {
  if (count <= 0) return 'out';
  return count <= lowAt ? 'low' : 'have';
}

/** Pulls a Walmart item ID out of a pasted product URL, or accepts a bare ID. */
export function parseWalmartItemId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{5,}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/walmart\.com\/ip\/(?:[^/?#]+\/)?(\d{5,})/i);
  return match ? match[1] : null;
}
