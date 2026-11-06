// Every port in Deps, for tests of planning, jobs, lookups and the routes. Anything not set up here throws
// if used, and a test can swap the model, the lookup or the notifier. For transactions, see transactional-fakes.ts.
import { jobClaimable, type JobRun } from '../../../domain/job-run.ts';
import { parseIngredientLine } from '../../../domain/ingredient.ts';
import { pantryItem, recipe } from '../../../domain/test-fixtures.ts';
import type { PantryItem, Store } from '../../../domain/pantry.ts';
import { extraSlot, isExtraSlot } from '../../../domain/plan-slot.ts';
import { entryKey, type PlanEntry } from '../../../domain/plan.ts';
import type { Price } from '../../../domain/prices.ts';
import { slugify, type Recipe } from '../../../domain/recipe.ts';
import type { Deps } from '../deps.ts';
import { newLookupState } from '../lookup-state.ts';
import type { PlannedMeal } from '../ports/ai.ts';
import type { StorePriceQuote } from '../ports/prices.ts';
import type { RecipeDraft } from '../ports/recipes.ts';

export function draft(title: string, lines: string[] = []): RecipeDraft {
  return { title, kind: 'recipe', meals: ['dinner'], serves: 4, time: null, tags: [], batch: false, seasons: [], source: null, image: null, summary: '', ingredients: lines.map(line => parseIngredientLine(line)!), steps: [], notes: null };
}

export function planned(date: string, extra: Partial<PlannedMeal>): PlannedMeal {
  return { date, slot: 'dinner', kind: 'recipe', recipeSlug: null, multiplier: 1, leftoversOfDate: null, note: null, idea: null, ...extra };
}

/** A promise settled by hand, to hold a port open while the test does something else. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

export type Fakes = Deps & {
  calls: { planMeals: number; recipeFromDescription: number; lookups: number; sends: number; nightBeforeSteps: number };
  planMeals: Deps['ai']['planMeals'];
  writeRecipe: Deps['ai']['recipeFromDescription'];
  nightBeforeSteps: Deps['ai']['nightBeforeSteps'];
  lookup: (names: string[]) => Promise<Map<string, StorePriceQuote>>;
  send: () => Promise<number>;
  entries: Map<string, PlanEntry>;
  priceTable: Map<number, Price>;
  logged: string[];
};

const notFaked = (port: string) => new Proxy({}, { get: (_t, name) => { throw new Error(`${port}.${String(name)} isn't faked`); } });

export function fakeDeps(opts: { recipes?: Recipe[]; pantry?: PantryItem[]; ai?: boolean; shopWeekday?: number } = {}): Fakes {
  const recipes = new Map((opts.recipes ?? []).map(r => [r.slug, r]));
  const pantry = opts.pantry ?? [];
  const entries = new Map<string, PlanEntry>();
  const settings = new Map<string, string>();
  const jobs = new Map<string, JobRun>();
  const priceTable = new Map<number, Price>();
  const trips = new Map<string, unknown[]>();
  const logged: string[] = [];
  let lastExtra = 0;
  const jobKey = (job: string, runKey: string) => `${job}/${runKey}`;

  const fakes: Fakes = {
    calls: { planMeals: 0, recipeFromDescription: 0, lookups: 0, sends: 0, nightBeforeSteps: 0 },
    planMeals: () => Promise.resolve([]),
    writeRecipe: description => Promise.resolve(draft(description.split(',')[0])),
    nightBeforeSteps: () => Promise.resolve([]),
    lookup: () => Promise.resolve(new Map()),
    send: () => Promise.resolve(1),
    entries, priceTable, logged,
    unitOfWork: { run: work => work() },

    recipes: {
      ...notFaked('recipes') as Deps['recipes'],
      list: () => [...recipes.values()],
      get: slug => recipes.get(slug) ?? null,
      save(saved) {
        let slug = slugify(saved.title);
        const base = slug;
        for (let n = 2; recipes.has(slug); n++) slug = `${base}-${n}`;
        recipes.set(slug, recipe(slug, [], { title: saved.title, ingredients: saved.ingredients, meals: saved.meals, serves: saved.serves, claudesPick: saved.claudesPick ?? false, nightBefore: saved.nightBefore ?? null }));
        return slug;
      },
      addNightBefore(slug, step) {
        const found = recipes.get(slug);
        if (!found || found.nightBefore) return false;
        recipes.set(slug, { ...found, nightBefore: step });
        return true;
      },
    },
    pantry: {
      ...notFaked('pantry') as Deps['pantry'],
      list: () => pantry,
      get: id => pantry.find(p => p.id === id) ?? null,
      findByName: name => pantry.find(p => p.name === name) ?? null,
      create(input) {
        const item = pantryItem(pantry.length + 1000, input.name, { status: input.status ?? 'have' });
        pantry.push(item);
        return item;
      },
      update(id, change) {
        const item = pantry.find(p => p.id === id);
        if (item) Object.assign(item, change);
        return item ?? null;
      },
    },
    plan: {
      range: (from, to) => [...entries.values()].filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date)),
      get: (date, slot) => entries.get(entryKey({ date, slot })) ?? null,
      upsert: entry => void entries.set(entryKey(entry), entry),
      fillIfOpen(entry) {
        if (isExtraSlot(entry.slot) || entries.has(entryKey(entry))) return false;
        entries.set(entryKey(entry), entry);
        return true;
      },
      remove: (date, slot) => void entries.delete(entryKey({ date, slot })),
      addExtra(entry) {
        const slot = extraSlot(++lastExtra);
        entries.set(entryKey({ date: entry.date, slot }), { ...entry, slot });
        return slot;
      },
    },
    household: {
      storeFor: () => null,
      setStore: () => undefined,
      checkin: () => ({ mealsDone: false, pantryDone: false }),
      markCheckin: () => undefined,
      setting: key => settings.get(key) ?? null,
      saveSetting(key, value) {
        if (value === null) settings.delete(key);
        else settings.set(key, value);
      },
      tripMoves: () => ({}),
      moveTrip: () => undefined,
      claimJob(job, runKey, now, leaseUntil) {
        if (!jobClaimable(jobs.get(jobKey(job, runKey)) ?? null, now)) return false;
        jobs.set(jobKey(job, runKey), { completedAt: null, leaseUntil });
        return true;
      },
      jobCompleted: (job, runKey) => Boolean(jobs.get(jobKey(job, runKey))?.completedAt),
      completeJob: (job, runKey) => void jobs.set(jobKey(job, runKey), { completedAt: 'done', leaseUntil: null }),
      releaseJob: (job, runKey, retryAt) => void jobs.set(jobKey(job, runKey), { completedAt: null, leaseUntil: retryAt }),
    },
    avoided: { list: () => [], add: () => undefined, remove: () => undefined },
    prices: {
      forStore: (store: Store) => store === 'aldi' ? new Map(priceTable) : new Map(),
      save(id, _store, price) {
        if (price === null) priceTable.delete(id);
        else priceTable.set(id, { ...price, checkedAt: new Date().toISOString() });
      },
      forgetLookups() {
        for (const [id, price] of priceTable) if (price.source === 'lookup') priceTable.delete(id);
      },
    },
    receipts: {
      ...notFaked('receipts') as Deps['receipts'],
      tripList: shopDate => (trips.get(shopDate) ?? null) as ReturnType<Deps['receipts']['tripList']>,
      saveTripList: (shopDate, lines) => void trips.set(shopDate, lines),
    },
    receiptFiles: notFaked('receiptFiles') as Deps['receiptFiles'],
    storePrices: {
      lookup(names) {
        fakes.calls.lookups += 1;
        return fakes.lookup(names);
      },
    },
    walmartProducts: notFaked('walmartProducts') as Deps['walmartProducts'],
    lookups: newLookupState(),
    recordings: notFaked('recordings') as Deps['recordings'],
    zips: notFaked('zips') as Deps['zips'],
    subscriptions: { list: () => [{ endpoint: 'phone', person: 'Someone', keys: { p256dh: '', auth: '' } }], save: () => undefined, remove: () => undefined },
    ai: {
      ...notFaked('ai') as Deps['ai'],
      available: () => opts.ai ?? true,
      planMeals(context) {
        fakes.calls.planMeals += 1;
        return fakes.planMeals(context);
      },
      recipeFromDescription(description, names) {
        fakes.calls.recipeFromDescription += 1;
        return fakes.writeRecipe(description, names);
      },
      nightBeforeSteps(recipes) {
        fakes.calls.nightBeforeSteps += 1;
        return fakes.nightBeforeSteps(recipes);
      },
    },
    images: { available: () => false, find: () => Promise.resolve(null) },
    photos: notFaked('photos') as Deps['photos'],
    pages: notFaked('pages') as Deps['pages'],
    claudePages: notFaked('claudePages') as Deps['claudePages'],
    transcriber: notFaked('transcriber') as Deps['transcriber'],
    notifier: {
      enabled: () => true,
      publicKey: () => null,
      send() {
        fakes.calls.sends += 1;
        return fakes.send();
      },
    },
    settings: { shopWeekday: opts.shopWeekday ?? 3, historyDays: 14, dinnerTime: '18:00', nightBeforeTime: { hour: 17, minute: 0 }, schedule: { planWeekday: 0, planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 19, minute: 45 } } },
    log: message => void logged.push(message),
  };
  return fakes;
}
