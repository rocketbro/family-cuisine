// Typed calls to the server. Screens use these instead of fetch.
import { ApiError } from './api-error.ts';
import type { ISODate } from '../domain/dates.ts';
import type { DraftedMeal } from '../domain/drafted-meal.ts';
import type { HouseholdProfile } from '../domain/household.ts';
import type { PantryItem, Store } from '../domain/pantry.ts';
import type { ImportPlacement } from '../domain/plan-import.ts';
import type { ExtraSlot, PlanSlot } from '../domain/plan-slot.ts';
import type { StockToAdd } from '../domain/portion-add.ts';
import type { PortionMove } from '../domain/portion-move.ts';
import type { MealUpdate } from '../domain/plan.ts';
import type { MealSlot, RecipeMeal } from '../domain/recipe.ts';
import type { RecipeForm } from '../domain/recipe-form.ts';
import type { Season } from '../domain/seasons.ts';
import type { ShoppingLine } from '../domain/shopping.ts';
import type { CartLine } from '../domain/walmart.ts';
import type { ChosenSwap, SwapIdea } from '../domain/save-money.ts';
import { encodeSubstitutions, type Substitutions } from '../domain/substitutes.ts';
import type {
  CheckinView, CookedMeal, ExtraChoice, HouseholdView, ListenContext, MealChoice, PantryReport, Proposal, ProposedChange,
  PlanImportView, ReceiptView, RecipeRevision, SaveMoneyView, ShoppingWeek, Status, StockGoalInput, StockGoalView, TripsView,
} from '../shared/api-types.ts';
import type { AvoidedMeal } from '../domain/avoided-meal.ts';
import type { PlanEntryView, ProblemCode, RecipeCard, RecipeDetail, RecipeFileNotice } from '../shared/views.ts';

export type RecipeChanges = {
  title: string; meals: RecipeMeal[]; serves: number; time: string | null; nightBefore: string | null; summary: string; ingredients: string;
  body: string;
};

// Reads give up after a while: a request started just before the phone slept can hang
// forever otherwise, and the screen would never leave "One moment…".
const READ_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const read = !init?.method || init.method === 'GET';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { cache: 'no-store', ...init, signal: init?.signal ?? (read ? AbortSignal.timeout(READ_TIMEOUT_MS) : undefined) });
  } catch (e) {
    const name = (e as Error).name;
    throw new Error(name === 'TimeoutError' || name === 'AbortError'
      ? 'Cuisine is taking too long to answer. Trying again…'
      : 'Can’t reach Cuisine right now. Is this device on your network or tailnet?');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { error, code } = data as { error?: string; code?: ProblemCode };
    throw new ApiError(error ?? `Something went wrong (${response.status}).`, code ?? null);
  }
  return data as T;
}

type LineRef = { pantryItemId: number | null; name: string };

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
  status: () => request<Status>('/status'),

  plan: (from: ISODate, to: ISODate) => request<PlanEntryView[]>(`/plan?from=${from}&to=${to}`),
  setMeal: (date: ISODate, slot: MealSlot, choice: MealChoice) => request(`/plan/${date}/${slot}`, json('PUT', choice)),
  rollMeal: (date: ISODate, slot: MealSlot, notThese: string[]) => request<DraftedMeal>(`/plan/${date}/${slot}/roll`, json('POST', { notThese })),
  setMealDone: (date: ISODate, slot: PlanSlot, done: boolean) => request(`/plan/${date}/${slot}/done`, json('PUT', { done })),
  writeUpNote: (date: ISODate, slot: PlanSlot) => request(`/plan/${date}/${slot}/write-up`, { method: 'POST' }),
  setMultiplier: (date: ISODate, slot: PlanSlot, multiplier: number) => request(`/plan/${date}/${slot}/multiplier`, json('PATCH', { multiplier })),
  addExtra: (date: ISODate, choice: ExtraChoice) => request<{ slot: ExtraSlot }>(`/plan/${date}/extras`, json('POST', choice)),
  changeExtra: (date: ISODate, slot: ExtraSlot, choice: ExtraChoice) => request(`/plan/${date}/extras/${slot}`, json('PUT', choice)),
  removeExtra: (date: ISODate, slot: ExtraSlot) => request(`/plan/${date}/extras/${slot}`, { method: 'DELETE' }),
  planImport: () => request<PlanImportView>('/plan-import'),
  startPlanImport: (text: string, photos: File[]) => {
    const form = new FormData();
    for (const photo of photos) form.append('photos', photo);
    if (text.trim()) form.append('text', text.trim());
    return request<{ id: string }>('/plan-import', { method: 'POST', body: form });
  },
  retryPlanImport: () => request('/plan-import/retry', { method: 'POST' }),
  confirmPlanImport: (id: string, meals: ImportPlacement[]) => request(`/plan-import/${id}/confirm`, json('POST', { meals })),
  discardPlanImport: () => request('/plan-import', { method: 'DELETE' }),
  planAhead: () => request<{ added: number }>('/plan/fill', { method: 'POST' }),

  recipes: () => request<RecipeCard[]>('/recipes'),
  recipeProblems: () => request<RecipeFileNotice[]>('/recipe-problems'),
  recipe: (slug: string, factor = 1, substituted: Substitutions = {}) =>
    request<RecipeDetail>(`/recipes/${slug}?x=${factor}&subs=${encodeURIComponent(encodeSubstitutions(substituted))}`),
  editRecipe: (slug: string, changes: RecipeChanges) => request(`/recipes/${slug}`, json('PUT', changes)),
  reviseRecipe: (slug: string, said: string, form: RecipeForm) => request<RecipeRevision>(`/recipes/${slug}/revise`, json('POST', { said, form })),
  keepPick: (slug: string) => request(`/recipes/${slug}/keep`, { method: 'POST' }),
  importWords: (words: string) => request<{ slug: string }>('/recipes/import/words', json('POST', { words })),
  avoidedMeals: () => request<AvoidedMeal[]>('/avoided-meals'),
  avoidMeal: (title: string, reason: string, slug: string | null) => request('/avoided-meals', json('POST', { title, reason: reason.trim() || null, slug })),
  forgetAvoidedMeal: (id: number) => request(`/avoided-meals/${id}`, { method: 'DELETE' }),
  deleteRecipe: (slug: string) => request(`/recipes/${slug}`, { method: 'DELETE' }),
  uploadRecipePhoto: (slug: string, photo: File) => {
    const form = new FormData();
    form.append('photo', photo);
    return request(`/recipes/${slug}/photo`, { method: 'POST', body: form });
  },
  setRecipeSeasons: (slug: string, seasons: Season[]) => request(`/recipes/${slug}/seasons`, json('PUT', { seasons })),
  refreshRecipeImage: (slug: string) => request<{ found: boolean }>(`/recipes/${slug}/image/refresh`, { method: 'POST' }),
  importUrl: (url: string, notes: string, viaClaude = false) => request<{ slug: string }>('/recipes/import/url', json('POST', { url, notes: notes.trim() || null, viaClaude })),
  importPhotos: (photos: File[], source: string, notes: string) => {
    const form = new FormData();
    for (const photo of photos) form.append('photos', photo);
    form.append('source', source);
    if (notes.trim()) form.append('notes', notes.trim());
    return request<{ slug: string }>('/recipes/import/photos', { method: 'POST', body: form });
  },

  pantry: () => request<PantryItem[]>('/pantry'),
  addPantryItem: (item: Partial<PantryItem> & { name: string }) => request<PantryItem>('/pantry', json('POST', item)),
  updatePantryItem: (id: number, patch: Partial<Omit<PantryItem, 'id'>> & { move?: PortionMove; add?: StockToAdd }) => request<PantryItem>(`/pantry/${id}`, json('PATCH', patch)),
  removePantryItem: (id: number) => request(`/pantry/${id}`, { method: 'DELETE' }),

  /** Words (transcribed or typed) with where they were said; the model works out the changes. */
  listen: (text: string, context: ListenContext) => request<Proposal>('/listen', json('POST', { text, context })),
  /** Dictation originals: saved on the server first, then transcribed; kept until discarded. */
  saveRecording: (audio: Blob, filename: string, label: string) => {
    const form = new FormData();
    form.append('audio', audio, filename);
    form.append('label', label);
    return request<{ id: string }>('/recordings', { method: 'POST', body: form });
  },
  transcribeRecording: (id: string) => request<{ text: string }>(`/recordings/${id}/transcribe`, { method: 'POST' }),
  discardRecording: (id: string) => request(`/recordings/${id}`, { method: 'DELETE' }),
  applyProposal: (pantry: ProposedChange[], meals: MealUpdate[], context: ListenContext) => request('/listen/apply', json('POST', { pantry, meals, context })),
  cooked: (slug: string, factor: number, planned: { date: ISODate; slot: PlanSlot } | null, substituted: Substitutions) =>
    request<CookedMeal>(`/recipes/${slug}/cooked`, json('POST', { factor, ...planned, substituted })),

  shopping: () => request<ShoppingWeek>('/shopping'),
  listOpened: () => request('/shopping/opened', { method: 'POST' }),
  chooseStore: (store: Store) => request('/shopping/store', json('PUT', { store })),
  setPrice: (line: LineRef, store: Store, cents: number | null) => request('/shopping/price', json('PUT', { line, store, cents })),
  refreshPrices: () => request<{ found: number }>('/shopping/prices/refresh', { method: 'POST' }),
  setBudget: (cents: number | null) => request('/shopping/budget', json('PUT', { cents })),
  setWalmartProduct: (line: LineRef, link: string) => request<PantryItem>('/shopping/walmart-product', json('PUT', { line, link })),
  setFinds: (cents: number) => request('/shopping/finds', json('PUT', { cents })),
  setStockPackages: (pantryItemId: number, packages: number) => request('/shopping/stock', json('PUT', { pantryItemId, packages })),
  stockUp: () => request<StockGoalView[]>('/household/stock-up'),
  setStockUp: (goals: StockGoalInput[]) => request('/household/stock-up', json('PUT', { goals })),
  saveMoney: () => request<SaveMoneyView>('/plan/save-money'),
  previewSwaps: (swaps: ChosenSwap[]) => request<Pick<SwapIdea, 'savedCents' | 'fewerItems'>>('/plan/save-money/preview', json('POST', { swaps })),
  applySwaps: (swaps: ChosenSwap[]) => request('/plan/save-money', json('POST', { swaps })),
  noteSentToCart: (lines: CartLine[]) => request('/shopping/walmart-sent', json('POST', { lines })),
  forgetSentToCart: () => request('/shopping/walmart-sent', { method: 'DELETE' }),
  trips: () => request<TripsView>('/receipts'),
  receipt: (id: number) => request<ReceiptView>(`/receipts/${id}`),
  addReceipt: (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return request<{ id: number }>('/receipts', { method: 'POST', body: form });
  },
  retryReceipt: (id: number) => request(`/receipts/${id}/retry`, { method: 'POST' }),
  applyReceipt: (id: number, kept: { index: number; name: string }[], pricesOnly: boolean) => request(`/receipts/${id}/apply`, json('POST', { kept, pricesOnly })),
  removeReceipt: (id: number) => request(`/receipts/${id}`, { method: 'DELETE' }),
  dismissSuggestion: (key: string) => request('/receipts/suggestions/dismiss', json('POST', { key })),
  markBought: (lines: ShoppingLine[], stock: { pantryItemId: number; packages: number }[], token: string) => request('/shopping/bought', json('POST', {
    lines: lines.map(l => ({ pantryItemId: l.pantryItemId, name: l.name, quantity: l.quantity })), stock, token,
  })),

  checkin: (date: ISODate) => request<CheckinView>(`/checkin/${date}`),
  ateAsPlanned: (date: ISODate) => request(`/checkin/${date}/as-planned`, { method: 'POST' }),
  recordPantry: (date: ISODate, report: PantryReport) => request(`/checkin/${date}/pantry`, json('POST', report)),

  household: () => request<HouseholdView>('/household/profile'),
  saveHousehold: (profile: HouseholdProfile) => request('/household/profile', json('PUT', profile)),
  kitchenNotes: () => request<{ notes: string }>('/household/kitchen-notes'),
  setKitchenNotes: (notes: string) => request('/household/kitchen-notes', json('PUT', { notes })),
  setShopWeekday: (weekday: number) => request('/household/shop-weekday', json('PUT', { weekday })),
  setNightBeforeTime: (time: string) => request('/household/night-before-time', json('PUT', { time })),
  setStoreZip: (zip: string | null) => request<{ location: { zip: string; place: string } | null }>('/household/zip', json('PUT', { zip })),
  moveNextTrip: (date: ISODate | null) => request('/household/next-trip', json('PUT', { date })),

  subscribe: (person: string, subscription: PushSubscriptionJSON) => request('/push/subscribe', json('POST', { person, subscription })),
  testPush: () => request<{ sent: number }>('/push/test', { method: 'POST' }),
};
