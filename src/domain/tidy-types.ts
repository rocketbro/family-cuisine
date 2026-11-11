// The tidy-up pass: what the code checks, what it fixes by itself, and what it might ask about.
// Every fix has exactly one right answer under the app's own rules; every candidate needs a person's call.
import type { ISODate } from './dates.ts';
import type { PantryItem, StockStatus } from './pantry.ts';
import type { PlanEntry } from './plan.ts';
import type { PlanSlot } from './plan-slot.ts';
import type { Recipe } from './recipe.ts';

/** What one trip's list held and what its receipts bought, as pantry item ids. */
export type TripBuying = { shopDate: ISODate; onList: number[]; bought: number[] };

/** Everything the checks read, gathered once by the use case. */
export type TidyInputs = {
  today: ISODate;
  pantry: PantryItem[];
  recipes: Pick<Recipe, 'slug' | 'title' | 'ingredients'>[];
  /** False when a recipe file couldn't be read, since a missing recipe may only be one that failed to load. */
  recipesTrustworthy: boolean;
  /** From a few days back to well ahead. */
  plan: PlanEntry[];
  standInsForNow: { itemId: number; name: string }[];
  /** Newest first. */
  trips: TripBuying[];
  mealsOffDates: ISODate[];
  catchUpNoDays: ISODate[];
  /** The days of the answers to "Any left?" kept, and when each line in the fridge list began. */
  dinnerAnswerDays: ISODate[];
  fridgeSince: ISODate[];
};

/** What a fix does, in the terms the use case already has. */
export type FixStep =
  | { step: 'remove_entry'; date: ISODate; slot: PlanSlot }
  | { step: 'unlink_entry'; date: ISODate; slot: PlanSlot }
  | { step: 'restate'; itemId: number; count: number | null; status: StockStatus }
  | { step: 'set_other_names'; itemId: number; alsoCalled: string[] }
  | { step: 'forget_old_meals_off' }
  | { step: 'forget_old_catch_up' }
  | { step: 'forget_old_answers' }
  | { step: 'forget_old_fridge' };

/** `line` is what the log says, in plain words. */
export type Fix = { check: string; line: string; step: FixStep };

export type CandidateKind = 'duplicate_items' | 'stale_use_by' | 'odd_count' | 'bought_though_low' | 'unmatched_ingredient' | 'unconfirmed_leftovers';

export type ActionKind = 'merge_items' | 'set_status' | 'set_count' | 'clear_use_by' | 'add_other_name' | 'remove_plan_entry';

export type TidyAction =
  | { kind: 'merge_items'; keep: number; remove: number; newName: string | null; alsoCalled: string[] }
  | { kind: 'set_status'; itemId: number; status: StockStatus }
  | { kind: 'set_count'; itemId: number; count: number }
  | { kind: 'clear_use_by'; itemId: number }
  | { kind: 'add_other_name'; itemId: number; name: string }
  | { kind: 'remove_plan_entry'; date: ISODate; slot: PlanSlot };

/** Something that looks off and needs judgment. `scope` is everything an action on it may name. */
export type Candidate = {
  /** Stable for the same situation, so an answer is remembered. */
  fingerprint: string;
  kind: CandidateKind;
  evidence: string[];
  allowed: ActionKind[];
  scope: {
    items: { id: number; name: string }[];
    entries: { date: ISODate; slot: PlanSlot }[];
    statuses: StockStatus[];
    /** Names an action may add or rename to. */
    names: string[];
  };
};
