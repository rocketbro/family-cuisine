import type { AvoidedMeal } from '../../../domain/avoided-meal.ts';
import type { ISODate } from '../../../domain/dates.ts';
import type { DraftedMeal, SaidUse } from '../../../domain/drafted-meal.ts';
import type { PantryChange } from '../../../domain/pantry-change.ts';
import type { PantryItem, StockStatus } from '../../../domain/pantry.ts';
import type { PlanSlot } from '../../../domain/plan-slot.ts';
import type { MealUpdate } from '../../../domain/plan.ts';
import type { PortionChange } from '../../../domain/portions.ts';
import type { ReceiptLine, ReceiptStore } from '../../../domain/receipts.ts';
import type { MealSlot, RecipeKind } from '../../../domain/recipe.ts';
import type { RecipeForm } from '../../../domain/recipe-form.ts';
import type { SaidRevision } from '../../../domain/recipe-revision.ts';
import type { Season } from '../../../domain/seasons.ts';
import type { RecipeDraft } from './recipes.ts';

export type AiPort = {
  available(): boolean;
  planMeals(context: PlannerContext): Promise<PlannedMeal[]>;
  /** `notes` is how the family actually makes it, typed or said at import; it wins over the source. */
  recipeFromImages(images: { mediaType: 'image/jpeg'; data: string }[], pantryNames: string[], notes: string | null): Promise<RecipeDraft>;
  /** The page is untrusted, so this takes nothing private beyond the family's notes for this import. */
  recipeFromPage(page: { url: string; siteName: string; content: string }, notes: string | null): Promise<RecipeDraft>;
  /** Writes a recipe from a description: what someone said or typed, or a dish Claude came up with. */
  recipeFromDescription(description: string, pantryNames: string[]): Promise<RecipeDraft>;
  /** Turns something said or typed into pantry and meal changes. */
  interpret(request: InterpretRequest): Promise<Interpretation>;
  /** Reads a receipt, matching what's on it to the pantry. Prices come only from what's printed. */
  readReceipt(files: ModelFile[], context: ReceiptContext): Promise<ReadReceipt>;
  /** Puts together one meal from what's in the house. */
  draftMeal(context: PantryMealContext): Promise<SaidDraft>;
  /** Applies what someone said to a recipe form's contents, keeping everything else. */
  reviseRecipe(request: RevisionRequest): Promise<SaidRevision>;
  /** Finds which of these recipes truly need something done the evening before, and what. The rest aren't in the answer. */
  nightBeforeSteps(recipes: NightBeforeQuestion[]): Promise<SaidNightBefore[]>;
  /** Reads a meal plan someone wrote out. Its text is data, and nothing it says is an instruction. */
  readMealPlan(plan: { text: string | null; images: { mediaType: 'image/jpeg'; data: string }[] }, context: PlanReadContext): Promise<SaidPlanMeal[]>;
};

export type NightBeforeQuestion = { slug: string; title: string; ingredients: string[]; method: string };

export type SaidNightBefore = { slug: string; step: string };

export type RevisionRequest = { said: string; form: RecipeForm; pantryNames: string[] };

export type PlannerContext = {
  dates: ISODate[];
  /** The season of each date to plan, for recipes that list seasons. */
  seasonOfDate: Record<ISODate, Season>;
  /** Dates before the next shopping trip: only recipes marked ready may go on these. */
  readyOnlyDates: ISODate[];
  /** Dates too soon for a recipe marked nightBefore: nobody would get to do its step in time. */
  tooLateForNightBefore: ISODate[];
  recipes: {
    slug: string; title: string; meals: MealSlot[]; kind: RecipeKind; batch: boolean; serves: number;
    availability: string; tags: string[]; seasons: Season[]; claudesPick: boolean; nightBefore: boolean;
  }[];
  /** What's in the house, for dishes that aren't in the catalog yet. */
  inHouse: string[];
  /** What they said not to suggest again, and why. */
  avoid: Pick<AvoidedMeal, 'title' | 'reason'>[];
  history: { date: ISODate; slot: MealSlot | 'extra'; title: string }[];
  /** With slot "extra": something else being made that day. It isn't a slot to fill. */
  alreadyPlanned: { date: ISODate; slot: MealSlot | 'extra'; title: string }[];
  lowOrOut: string[];
  /** In the house and going off soon, with dates: worth cooking before then. */
  useSoon: string[];
};

/** Kind "new" is a dish that isn't in the book yet: `note` names it and `idea` says what it is. */
export type PlannedMeal = {
  date: ISODate; slot: MealSlot; kind: 'recipe' | 'leftovers' | 'note' | 'new'; recipeSlug: string | null;
  multiplier: number; leftoversOfDate: ISODate | null; note: string | null; idea: string | null;
};

export type PlanReadContext = {
  today: ISODate;
  /** The recipe book, to match meals against. */
  recipes: { slug: string; title: string; tags: string[] }[];
};

/** One meal as the model read it; the use case checks it against the book and the calendar. */
export type SaidPlanMeal = {
  said: string; weekday: string | null; date: string | null; slot: MealSlot | 'extra';
  kind: 'recipe' | 'named' | 'leftovers'; recipeSlug: string | null; name: string | null;
  confidence: 'sure' | 'likely' | 'unsure';
};

export type PantryMealContext = {
  today: ISODate;
  timeNow: string;
  date: ISODate;
  slot: MealSlot;
  season: Season;
  /** Everything in the house, with amounts where they're known. */
  pantry: { name: string; category: string; status: StockStatus; count: number | null; kept: string | null; useBy: ISODate | null }[];
  /** Going off soon: what the meal should lean on. */
  useSoon: string[];
  /** Recipes that fit this meal and season and are ready to cook from the pantry. */
  recipes: { slug: string; title: string; time: string | null; serves: number; ingredients: string[] }[];
  recentMeals: { date: ISODate; slot: MealSlot; title: string }[];
  /** Already planned ahead: leave them what they need. */
  upcoming: { date: ISODate; title: string; needs: string[] }[];
  /** Earlier rolls they passed on. */
  notThese: string[];
  /** What they said not to suggest again, and why. */
  avoid: Pick<AvoidedMeal, 'title' | 'reason'>[];
};

export type SaidDraft = Omit<DraftedMeal, 'uses'> & { uses: SaidUse[] };

export type ModelFile = { mediaType: 'image/jpeg' | 'application/pdf'; data: string };

export type ReceiptContext = {
  today: ISODate;
  /** The list for the nearest trip, or null when none was saved. */
  list: { shopDate: ISODate; lines: { name: string; store: string }[] } | null;
  pantry: { name: string; counted: boolean; portions: string[] }[];
};

export type ReadReceipt = {
  store: ReceiptStore;
  purchasedOn: string | null;
  totalCents: number | null;
  lines: (Omit<ReceiptLine, 'pantryItemId'> & { pantryName: string | null })[];
};

export type InterpretRequest = {
  today: ISODate;
  /** Plain-language note on where they were and what they were doing. */
  situation: string;
  said: string;
  pantry: Pick<PantryItem, 'name' | 'status' | 'count' | 'category' | 'occasional' | 'useBy' | 'lastsDays' | 'portions' | 'alsoCalled'>[];
  recipes: { slug: string; title: string }[];
  meals: { date: ISODate; slot: PlanSlot; planned: string; outcome: string | null; expectedUses: string | null }[];
  /** Questions the app asked last time that this answers, if any. */
  answering: string[];
  /** When they just cooked something: the recipe's ingredients at the size they made it. */
  cooked: { title: string; multiplier: number; ingredients: string[] } | null;
};

/** What the model said about a portion; its unit is checked before anyone sees it. */
export type SaidPortion = Omit<PortionChange, 'unit'> & { unit: string | null };

export type SaidChange = Omit<PantryChange, 'portions'> & { portions: SaidPortion[] | null };

export type SaidMeal = Omit<MealUpdate, 'uses'> & { uses: SaidUse[] | null };

export type Interpretation = { summary: string; pantry: SaidChange[]; meals: SaidMeal[]; questions: string[] };
