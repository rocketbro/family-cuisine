// A meal the model put together from what's in the house. It says up front what it expects to
// use, so the pantry can take that off at the check-in with a tap instead of a dictation.
import { findPantryItem, type PantryItem, type StockStatus } from './pantry.ts';
import type { PlanEntry } from './plan.ts';
import { portionsAfterCooking } from './portion-amounts.ts';
import type { PortionChange } from './portions.ts';
import { countedName } from './scaling.ts';
import { parseUnit, type Unit } from './units.ts';

/** How much of one pantry item a meal uses, and how the model expects that to leave it. */
export type MealUse = { pantryItemId: number; name: string; text: string; amount: number | null; unit: Unit | null; leaves: StockStatus };

export type DraftedMeal = {
  title: string;
  why: string;
  how: string | null;
  /** The recipe it's built on, or null when it's just things thrown together. */
  recipeSlug: string | null;
  multiplier: number;
  /** With a recipe, only what the recipe doesn't already call for. */
  uses: MealUse[];
};

/** What stays on the plan once a draft is chosen. */
export type PlannedDraft = Pick<DraftedMeal, 'how' | 'uses'>;

export type UseAnswer = StockStatus | 'unused';

/** What the model said a meal uses. */
export type SaidUse = { pantryName: string; text: string; amount: number | null; unit: string | null; leaves: StockStatus };

/** What `statusForCount` reads as low. */
const LOW_COUNT = 2;

export const PANTRY_MEAL_RETRY = 'That roll didn’t work out. Try again.';

/** Keeps uses of real items in the house, once each. A measure the app doesn't know has no amount. */
export function matchUses(said: readonly SaidUse[], pantry: readonly PantryItem[]): MealUse[] {
  const uses = new Map<number, MealUse>();
  for (const use of said) {
    const item = findPantryItem(use.pantryName, pantry);
    if (!item || item.status === 'out' || uses.has(item.id)) continue;
    const unit = use.unit ? parseUnit(use.unit) : null;
    const known = use.amount !== null && use.amount > 0 && (!use.unit || unit !== null);
    uses.set(item.id, { pantryItemId: item.id, name: item.name, text: withoutName(use.text, item.name), amount: known ? use.amount : null, unit: known ? unit : null, leaves: use.leaves });
  }
  return [...uses.values()];
}

/** The model sometimes says "6 tortillas" of tortillas; the name gets added back when it's shown. */
function withoutName(text: string, name: string): string {
  const trimmed = text.trim();
  return trimmed.toLowerCase().endsWith(` ${name.toLowerCase()}`) ? trimmed.slice(0, -name.length - 1) : trimmed;
}

/** "1 loaf garlic bread, 1 lb chicken". */
export function usesText(uses: readonly Pick<MealUse, 'name' | 'text'>[]): string {
  return uses.map(use => `${use.text} ${countedUseName(use)}`).join(', ');
}

/** A bare count agrees with the name ("1 green bell pepper"); a measure doesn't touch it ("1 lb bratwurst"). */
function countedUseName({ name, text }: Pick<MealUse, 'name' | 'text'>): string {
  const bare = text.trim().toLowerCase().match(/^(?:about\s+)?(\d+|one|a|an)$/);
  if (!bare) return name;
  return countedName(name, /^\d+$/.test(bare[1]) ? Number(bare[1]) : 1);
}

/** The uses to settle at the check-in: a draft counts only if the family ate it as planned. */
export function expectedUses(entry: Pick<PlanEntry, 'outcome' | 'drafted'>): MealUse[] {
  return entry.outcome === 'made' ? entry.drafted?.uses ?? [] : [];
}

export type PatchAfterUse = { status?: StockStatus; count?: number; portions?: PortionChange[] };

/** What using it does to the item: measured amounts come down, and anything else takes the answer. */
export function patchAfterUse(item: PantryItem, use: MealUse, answer: UseAnswer): PatchAfterUse | null {
  if (answer === 'unused') return null;
  if (item.count !== null) {
    if (answer === 'out') return { count: 0 };
    const left = use.amount !== null && !use.unit ? Math.max(0, item.count - use.amount) : item.count;
    return { count: answer === 'low' ? Math.min(left, LOW_COUNT) : left };
  }
  if (answer === 'out' || !item.portions.length) return { status: answer };
  const portions = portionsAfterCooking(item.portions, { amount: use.amount, amountMax: null, unit: use.unit, item: item.name, note: null, optional: false, group: null });
  return { portions, ...(answer === 'low' ? { status: 'low' as const } : {}) };
}
