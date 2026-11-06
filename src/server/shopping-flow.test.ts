// How the Shop screen's requests behave together, through the real app, container and database: a
// read changes nothing and calls nobody, and the explicit calls do what reading the list used to.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankEntry } from '../domain/plan.ts';
import type { ShoppingWeek } from '../shared/api-types.ts';
import type { Deps } from './application/deps.ts';
import { deferred } from './application/test-support/full-deps-fake.ts';
import { tripPlan } from './application/trip-plan.ts';
import { config } from './config.ts';
import { buildDeps } from './container.ts';
import { createApp } from './http/app.ts';

const TODAY = '2026-11-03';
const WEDNESDAY = 3;
const SHOP_DATE = '2026-11-04';

let dir: string;
const fetched = vi.fn(() => Promise.reject(new Error('nothing should call out')));

function house(flags: { aldi: boolean; walmart: boolean } = { aldi: true, walmart: true }) {
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'cuisine.db');
  const deps = buildDeps({
    ...config, dataDir, dbPath, recipesDir: path.join(dataDir, 'recipes'), imagesDir: path.join(dataDir, 'images'), tmpDir: path.join(dataDir, 'tmp'),
    anthropicApiKey: null, unsplashAccessKey: null, vapidPublicKey: null, vapidPrivateKey: null, shopWeekday: WEDNESDAY,
    aldiPriceLookup: flags.aldi, walmartProductLookup: flags.walmart,
  }, () => undefined);
  fs.writeFileSync(path.join(dataDir, 'recipes', 'frittata.md'), '---\ntitle: Frittata\nmeals: [dinner]\n---\n\n## Ingredients\n\n- 6 eggs\n');
  const eggs = deps.pantry.create({ name: 'eggs', status: 'out' });
  deps.household.saveSetting('store_location', JSON.stringify({ zip: '27601', latitude: 35, longitude: -78, place: 'Raleigh, NC' }));
  deps.plan.upsert({ ...blankEntry(SHOP_DATE, 'dinner'), kind: 'recipe', recipeSlug: 'frittata' });

  const app = createApp(deps, { clientDir: dir, trust: { hostnames: new Set(['localhost']), publicOrigin: 'http://localhost' }, accessToken: null });
  const send = (url: string, init: RequestInit = {}) => app.request(`/api/shopping${url}`, { ...init, headers: { host: 'localhost', ...init.headers as Record<string, string> } });
  return {
    deps, eggs,
    read: async () => (await send('')).json() as Promise<ShoppingWeek>,
    opened: () => send('/opened', { method: 'POST' }),
    refresh: () => send('/prices/refresh', { method: 'POST' }),
    send,
    rows: () => everyRow(dbPath),
  };
}

/** The whole database as text, so a test can tell whether anything at all was written. */
function everyRow(dbPath: string): string {
  const db = new Database(dbPath, { readonly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    return JSON.stringify(tables.map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}"`).all()]));
  } finally {
    db.close();
  }
}

const aldiQuote = (deps: Deps, cents = 279) => {
  const lookup = vi.fn(async (names: string[]) => new Map(names.map(name => [name, { cents, product: `${name} at Aldi` }])));
  deps.storePrices = { lookup };
  return lookup;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-flow-'));
  fetched.mockClear();
  vi.stubGlobal('fetch', fetched);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/shopping', () => {
  it('writes nothing, however often it is read', async () => {
    const { read, rows } = house();
    const before = rows();
    const first = await read();
    const second = await read();
    expect(first.lines.map(l => l.name)).toContain('eggs');
    expect(second).toEqual(first);
    expect(rows()).toBe(before);
  });

  it('calls nobody, with both lookups on and a product to read', async () => {
    const { deps, eggs, read } = house();
    deps.pantry.update(eggs.id, { walmartItemId: '123456' });
    const lookup = aldiQuote(deps);
    const productName = vi.fn(async () => 'Eggs, 18 Count');
    deps.walmartProducts = { productName };
    await read();
    expect(lookup).not.toHaveBeenCalled();
    expect(productName).not.toHaveBeenCalled();
    expect(fetched).not.toHaveBeenCalled();
  });

  it('shows a change at once, whether or not the list has been noted as opened', async () => {
    const { deps, read, send, eggs } = house();
    expect((await read()).lines.map(l => l.name)).toContain('eggs');
    await send('/bought', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ pantryItemId: eggs.id, name: 'eggs', quantity: null }] }) });
    expect((await read()).lines.map(l => l.name)).not.toContain('eggs');
    deps.pantry.create({ name: 'milk', status: 'out' });
    expect((await read()).lines.map(l => l.name)).toContain('milk');
  });
});

describe('POST /api/shopping/opened', () => {
  it('saves the list as it stands, for a receipt to compare with', async () => {
    const { deps, opened, eggs } = house();
    expect(deps.receipts.tripList(SHOP_DATE)).toBeNull();
    expect((await opened()).status).toBe(200);
    expect(deps.receipts.tripList(SHOP_DATE)?.map(l => l.pantryItemId)).toEqual([eggs.id]);
  });

  it('saves what the list has on it now, not when the last note went out', async () => {
    const { deps, opened } = house();
    await opened();
    const milk = deps.pantry.create({ name: 'milk', status: 'out' });
    await opened();
    expect(deps.receipts.tripList(SHOP_DATE)?.map(l => l.pantryItemId)).toContain(milk.id);
  });

  it('keeps a line that was checked off once it leaves the list', async () => {
    const { deps, opened, send, eggs } = house();
    await opened();
    await send('/bought', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: [{ pantryItemId: eggs.id, name: 'eggs', quantity: null }] }) });
    await opened();
    expect(deps.receipts.tripList(SHOP_DATE)?.find(l => l.pantryItemId === eggs.id)?.checkedOff).toBe(true);
  });

  it('remembers how much is meant for the store', async () => {
    const { deps, opened } = house();
    const beef = deps.pantry.create({ name: 'beef', status: 'out', occasional: true });
    deps.pantry.update(beef.id, { stockUp: { amount: 12, unit: 'lb', storage: 'frozen', rank: 0 }, packSize: { count: null, measure: { amount: 3, unit: 'lb' } } });
    deps.prices.save(beef.id, 'aldi', { cents: 500, source: 'typed', product: null });
    deps.household.saveSetting('trip_budget_cents', '100000');
    await opened();
    expect(Object.keys(tripPlan(deps, SHOP_DATE).planned)).toContain(String(beef.id));
  });

  it('starts reading package sizes not read yet', async () => {
    const { deps, eggs, opened } = house();
    deps.pantry.update(eggs.id, { walmartItemId: '123456' });
    deps.walmartProducts = { productName: async () => 'Great Value Large Eggs, 18 Count' };
    await opened();
    await vi.waitFor(() => expect(deps.pantry.get(eggs.id)?.packSize?.count).toBe(18));
  });

  it('calls nobody with the lookups off', async () => {
    const { deps, eggs, opened } = house({ aldi: false, walmart: false });
    deps.pantry.update(eggs.id, { walmartItemId: '123456' });
    await opened();
    expect(fetched).not.toHaveBeenCalled();
    expect(deps.pantry.get(eggs.id)?.packSize).toBeNull();
  });

  it('doesn’t change what the list shows', async () => {
    const { read, opened } = house({ aldi: false, walmart: false });
    const before = await read();
    await opened();
    expect(await read()).toEqual(before);
  });
});

describe('prices filling in on their own', () => {
  it('goes from due, through the screen’s refresh, to priced and done', async () => {
    const { deps, read, refresh } = house();
    const lookup = aldiQuote(deps);
    expect((await read()).aldiLookup).toBe('due');
    expect(await (await refresh()).json()).toEqual({ found: 1 });
    expect(lookup).toHaveBeenCalledOnce();
    const week = await read();
    expect(week.aldiLookup).toBe('done');
    expect(week.lines.find(l => l.name === 'eggs')?.price?.cents).toBe(279);
  });

  it('says it’s running to a read in the middle of a lookup', async () => {
    const { deps, read, refresh } = house();
    const answer = deferred<Map<string, { cents: number; product: string }>>();
    deps.storePrices = { lookup: () => answer.promise };
    const running = refresh();
    await vi.waitFor(async () => expect((await read()).aldiLookup).toBe('running'));
    answer.resolve(new Map());
    await running;
    expect((await read()).aldiLookup).toBe('done');
  });

  it('tells the screen not to check with the lookup off', async () => {
    const { read } = house({ aldi: false, walmart: false });
    expect((await read()).aldiLookup).toBe('disabled');
  });
});
