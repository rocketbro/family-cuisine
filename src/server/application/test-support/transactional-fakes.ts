// In-memory stand-ins for the ports the pantry, cooking, receipt and shopping tests touch. Copies go in
// and out as a database's would, and `unitOfWork` restores everything when its work throws, so a test can
// see what a failure halfway through leaves behind. For planning, jobs and lookups, see full-deps-fake.ts.
import { type PantryItem } from '../../../domain/pantry.ts';
import type { PlanSlot } from '../../../domain/plan-slot.ts';
import { blankEntry, type PlanEntry } from '../../../domain/plan.ts';
import type { Price } from '../../../domain/prices.ts';
import type { ReceiptLine, TripLine } from '../../../domain/receipts.ts';
import type { MealSlot, Recipe } from '../../../domain/recipe.ts';
import { pantryItem } from '../../../domain/test-fixtures.ts';
import type { Deps } from '../deps.ts';
import { newLookupState } from '../lookup-state.ts';
import type { ReceiptRecord } from '../ports/receipts.ts';

/** A Wednesday; the shopping day below makes the coming trip that Friday. */
export const TODAY = '2026-11-04';
export const TRIP = '2026-11-06';
const FRIDAY = 5;

type State = {
  items: PantryItem[];
  plan: PlanEntry[];
  checkins: Record<string, { mealsDone: boolean; pantryDone: boolean }>;
  settings: Record<string, string>;
  receipts: ReceiptRecord[];
  tripLists: Record<string, TripLine[]>;
  prices: { itemId: number; store: string; price: Price }[];
  removedFiles: string[];
};

export const receiptLine = (name: string, over: Partial<ReceiptLine> = {}): ReceiptLine => ({
  printed: name.toUpperCase(), name, pantryItemId: null, category: 'Other', quantity: 1, pieces: null, form: null, canOz: null, weightLb: null, lastsDays: null, cents: 500, unsure: false, ...over,
});

export const tripLine = (id: number, name: string): TripLine => ({ key: `p${id}`, name, pantryItemId: id, store: 'aldi', reason: 'needed', neededFor: [], checkedOff: false, addedCount: 0 });

export const plannedRecipe = (date: string, slot: PlanSlot, slug: string, over: Partial<PlanEntry> = {}): PlanEntry => ({ ...blankEntry(date, slot), kind: 'recipe', recipeSlug: slug, ...over });

export function transactionalFakes(recipes: Recipe[] = []) {
  let state: State = { items: [], plan: [], checkins: {}, settings: {}, receipts: [], tripLists: {}, prices: [], removedFiles: [] };
  let nextId = 1;
  const find = (id: number) => state.items.find(i => i.id === id) ?? null;

  const deps = {
    unitOfWork: {
      run<T>(work: () => T): T {
        const before = structuredClone(state);
        try {
          return work();
        } catch (e) {
          state = before;
          throw e;
        }
      },
    },
    recipes: { list: () => recipes, get: (slug: string) => recipes.find(r => r.slug === slug) ?? null },
    pantry: {
      list: () => structuredClone(state.items),
      get: (id: number) => structuredClone(find(id)),
      findByName: (name: string) => structuredClone(state.items.find(i => i.name.toLowerCase() === name.trim().toLowerCase()) ?? null),
      create(input: Partial<PantryItem> & { name: string }) {
        if (state.items.some(i => i.name.toLowerCase() === input.name.toLowerCase())) throw new Error('UNIQUE constraint failed');
        const item = { ...pantryItem(nextId++, input.name, { category: 'Other' }), ...input };
        state.items.push(item);
        return structuredClone(item);
      },
      update(id: number, patch: Partial<PantryItem>) {
        const item = find(id);
        if (!item) return null;
        Object.assign(item, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
        return structuredClone(item);
      },
      setPortions(id: number, portions: PantryItem['portions']) {
        find(id)!.portions = structuredClone(portions);
      },
      remove(id: number) {
        state.items = state.items.filter(i => i.id !== id);
      },
    },
    plan: {
      range: (from: string, to: string) => structuredClone(state.plan.filter(e => e.date >= from && e.date <= to)),
      get: (date: string, slot: PlanSlot) => structuredClone(state.plan.find(e => e.date === date && e.slot === slot) ?? null),
      upsert(entry: PlanEntry) {
        state.plan = [...state.plan.filter(e => !(e.date === entry.date && e.slot === entry.slot)), structuredClone(entry)];
      },
      remove(date: string, slot: PlanSlot) {
        state.plan = state.plan.filter(e => !(e.date === date && e.slot === slot));
      },
    },
    household: {
      storeFor: () => null,
      checkin: (date: string) => structuredClone(state.checkins[date] ?? { mealsDone: false, pantryDone: false }),
      firstCheckin: () => Object.keys(state.checkins).sort()[0] ?? null,
      markCheckin(date: string, step: 'meals' | 'pantry') {
        const current = state.checkins[date] ?? { mealsDone: false, pantryDone: false };
        state.checkins[date] = { ...current, [step === 'meals' ? 'mealsDone' : 'pantryDone']: true };
      },
      setting: (key: string) => state.settings[key] ?? null,
      saveSetting(key: string, value: string | null) {
        if (value === null) delete state.settings[key];
        else state.settings[key] = value;
      },
      shopTrips: () => [],
    },
    prices: {
      forStore: (store: string) => new Map(state.prices.filter(p => p.store === store).map(p => [p.itemId, p.price])),
      save(itemId: number, store: string, price: Pick<Price, 'cents' | 'source' | 'product'> | null) {
        state.prices = state.prices.filter(p => !(p.itemId === itemId && p.store === store));
        if (price) state.prices.push({ itemId, store, price: { ...price, checkedAt: TODAY } as Price });
      },
    },
    receipts: {
      list: () => structuredClone(state.receipts),
      get: (id: number) => structuredClone(state.receipts.find(r => r.id === id) ?? null),
      update(id: number, patch: Partial<ReceiptRecord>) {
        state.receipts = state.receipts.map(r => (r.id === id ? { ...r, ...patch } : r));
      },
      remove(id: number) {
        state.receipts = state.receipts.filter(r => r.id !== id);
      },
      tripList: (shopDate: string) => structuredClone(state.tripLists[shopDate] ?? null),
      tripDates: () => Object.keys(state.tripLists),
      saveTripList(shopDate: string, lines: TripLine[]) {
        state.tripLists[shopDate] = structuredClone(lines);
      },
    },
    receiptFiles: {
      remove(file: { file: string }) {
        state.removedFiles.push(file.file);
      },
    },
    lookups: newLookupState(),
    ai: { available: () => true, interpret: async () => ({ summary: '', pantry: [], meals: [], questions: [] }) },
    settings: { shopWeekday: FRIDAY, historyDays: 14, dinnerTime: '18:00', schedule: { planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 19, minute: 45 } } },
    log: () => {},
  };

  const addReceipt = (over: Partial<ReceiptRecord> = {}): number => {
    const id = nextId++;
    state.receipts.push({ id, shopDate: TRIP, store: 'aldi', purchasedOn: TRIP, totalCents: null, status: 'ready', error: null, lines: [], files: [], createdAt: '2026-11-06T12:00:00Z', ...over });
    return id;
  };

  return {
    deps: deps as unknown as Deps,
    /** The same objects, for a test to make a call fail. */
    ports: deps,
    addItem(name: string, over: Partial<PantryItem> = {}) {
      return deps.pantry.create({ name, ...over });
    },
    item: (id: number) => find(id)!,
    entry: (date: string, slot: MealSlot) => state.plan.find(e => e.date === date && e.slot === slot) ?? null,
    addReceipt,
    receipt: (id: number) => state.receipts.find(r => r.id === id) ?? null,
    savedPrices: () => state.prices,
    removedFiles: () => state.removedFiles,
    setting: (key: string) => state.settings[key] ?? null,
  };
}

/** Makes one call fail the given way, the first time only, like a database hiccup. */
export function failOnce<T extends object, K extends keyof T>(target: T, method: K, when: (...args: never[]) => boolean = () => true): void {
  const original = target[method] as (...args: unknown[]) => unknown;
  let failed = false;
  target[method] = ((...args: never[]) => {
    if (!failed && when(...args)) {
      failed = true;
      throw new Error('disk I/O error');
    }
    return original.apply(target, args);
  }) as T[K];
}
