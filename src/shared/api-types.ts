// Response and request shapes shared by the server and the web app. Domain imports only,
// so the client never pulls in server code.
import type { SwapIdea } from '../domain/save-money.ts';
import type { PackSize } from '../domain/pack-size.ts';
import type { StockGoal, StockLine, StockStanding } from '../domain/stock-up.ts';
import type { CarriedMeal, CheckinQuestions } from '../domain/checkin.ts';
import type { ISODate } from '../domain/dates.ts';
import type { HouseholdProfile } from '../domain/household.ts';
import type { ClockTime, JobSchedule } from '../domain/job-run.ts';
import type { PantryChange } from '../domain/pantry-change.ts';
import type { DraftedMeal, UseAnswer } from '../domain/drafted-meal.ts';
import type { Store } from '../domain/pantry.ts';
import type { ImportedMeal } from '../domain/plan-import.ts';
import type { PlanSlot } from '../domain/plan-slot.ts';
import type { MealUpdate } from '../domain/plan.ts';
import type { Receipt, TripDiff } from '../domain/receipts.ts';
import type { TripSuggestion } from '../domain/trip-learning.ts';
import type { MealSlot } from '../domain/recipe.ts';
import type { RecipeForm } from '../domain/recipe-form.ts';
import type { ListTax } from '../domain/grocery-tax.ts';
import type { CartLine } from '../domain/walmart.ts';
import type { ListTotal, Price } from '../domain/prices.ts';
import type { ShopSchedule } from '../domain/shop-schedule.ts';
import type { ShoppingLine } from '../domain/shopping.ts';
import type { PlanEntryView } from './views.ts';

export type Status = {
  today: ISODate; ai: boolean; images: boolean; pushKey: string | null; dinnerTime: string; shopping: ShopSchedule;
  storeZip: { zip: string; place: string } | null;
};

export type HouseholdView = {
  profile: HouseholdProfile; isSetUp: boolean; schedule: JobSchedule & { nightBeforeTime: ClockTime }; lookups: { aldi: boolean; walmart: boolean };
};

export type MealChoice =
  | { kind: 'recipe'; recipeSlug: string; multiplier?: number }
  | { kind: 'leftovers'; leftoversOf: { date: ISODate; slot: MealSlot } | null }
  | { kind: 'note'; note: string }
  | { kind: 'drafted'; draft: DraftedMeal };

/** What can go in an extra: a recipe, or only a name for now. */
export type ExtraChoice = Extract<MealChoice, { kind: 'recipe' | 'note' }>;

/** A list line with what it should cost: Aldi's shelf price, or what Walmart charged last time. */
export type PricedLine = ShoppingLine & { price: Price | null };

export type ShoppingWeek = {
  shopDate: ISODate;
  /** The regular day this week's trip was moved from, if it was. */
  movedFrom: ISODate | null;
  through: ISODate;
  store: Store;
  storeChosen: boolean;
  lines: PricedLine[];
  total: ListTotal;
  /** Estimated sales tax on the total; null when we don't know the rate for the ZIP. */
  tax: ListTax | null;
  budgetCents: number | null;
  /** What the budget has left after the list; null with no budget or too many missing prices. */
  leewayCents: number | null;
  /** Set aside from the room for Aldi finds. */
  findsCents: number;
  stockUp: StockLine[];
  stockTotalCents: number;
  /** Aldi price lookup: not turned on, no ZIP set, prices to check, checking now, or up to date. */
  aldiLookup: 'disabled' | 'off' | 'due' | 'running' | 'done';
  /** Adds only what hasn't already gone to the cart this trip; null when nothing is left to send. */
  walmartCartUrl: string | null;
  walmartToSend: CartLine[];
  /** Products on the list already sent to the cart in full this trip. */
  walmartSentCount: number;
  /** Walmart items without a known product ID yet; they need a search the first time. */
  walmartUnmatched: string[];
};

export type CheckinView = {
  date: ISODate;
  step: 'meals' | 'pantry' | 'done';
  meals: PlanEntryView[];
  questions: CheckinQuestions;
  /** Earlier meals these answers also cover, because nothing else caught them. */
  carried: CarriedMeal[];
};

export type PantryReport = {
  counts: { pantryItemId: number; used: number }[];
  needs: { pantryItemId: number; answer: 'fine' | 'low' | 'out' }[];
  /** How a drafted meal's expected uses actually went. */
  uses: { date?: ISODate; slot: PlanSlot; pantryItemId: number; answer: UseAnswer }[];
};

export type ProposedChange = PantryChange & { pantryItemId: number | null; current: string | null };

/** Where someone was when they started talking, so the model knows what they're probably on about. */
export type ListenContext =
  | { kind: 'anywhere' }
  | { kind: 'pantry'; answering?: string[] }
  | { kind: 'checkin'; date: ISODate }
  | { kind: 'cooked'; date: ISODate; slot: PlanSlot; slug: string; factor: number; substituted?: Record<number, string> };

export type ProposedMeal = MealUpdate & { title: string; planned: string | null };

/** What the model made of what someone said, for a quick look before it's saved. */
export type Proposal = {
  heard: string;
  summary: string;
  pantry: ProposedChange[];
  meals: ProposedMeal[];
  /** Follow-up questions, answered by talking again (usually none). */
  questions: string[];
};

/** What Claude made of a spoken change to a recipe, for the edit form: nothing is saved yet. */
export type RecipeRevision = { form: RecipeForm; note: string };

export type CookedMeal = { date: ISODate; slot: PlanSlot };

export type ReceiptView = Pick<Receipt, 'id' | 'shopDate' | 'store' | 'purchasedOn' | 'totalCents' | 'status' | 'error' | 'lines'> & {
  files: { url: string; type: string }[];
  /** False when no list was saved for that trip, so there's nothing to compare with. */
  listSaved: boolean;
  /** Bought too long ago to say anything about what's in the house now. */
  old: boolean;
  diff: TripDiff;
};
export type ReceiptSummary = Pick<Receipt, 'id' | 'shopDate' | 'store' | 'totalCents' | 'status' | 'error'> & { itemCount: number };
export type TripsView = { receipts: ReceiptSummary[]; suggestions: TripSuggestion[] };

/** An imported meal plan on its way: being read, read and waiting for someone to look it over, or saved. */
export type PlanImportView =
  | { status: 'none' }
  | { status: 'reading'; id: string }
  | { status: 'failed'; id: string; error: string; canRetry: boolean }
  | { status: 'ready'; id: string; meals: ImportedMeal[]; weekStart: ISODate }
  | { status: 'saved'; id: string; saved: number; leftAlone: number };

export type SaveMoneyView = { ideas: SwapIdea[] };

/** Goals point at a pantry item. A name can't come in this way, so a goal always matches what's on hand. */
export type StockGoalInput = Pick<StockGoal, 'amount' | 'unit' | 'storage'> & { pantryItemId: number };

export type StockGoalView = { pantryItemId: number; name: string; goal: StockGoal; standing: StockStanding; pack: PackSize | null; linked: boolean };
