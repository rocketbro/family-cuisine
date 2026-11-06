// With the Aldi and Walmart lookups off, nothing calls out: the real container, the real database,
// and a fetch that fails the test if anything uses it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { blankEntry } from '../domain/plan.ts';
import { refreshAldiPrices } from './application/aldi-lookup.ts';
import type { Deps } from './application/deps.ts';
import { setPrice, setWalmartProduct } from './application/shopping-prices.ts';
import { shoppingWeek } from './application/shopping.ts';
import { learnWalmartPacks, readWalmartPack } from './application/walmart-packs.ts';
import { config } from './config.ts';
import { buildDeps } from './container.ts';

const TODAY = '2026-11-03';
const ITEM = '123456';

let dir: string;
const fetched = vi.fn(() => Promise.reject(new Error('nothing should call out')));

function start(flags: { aldi: boolean; walmart: boolean }): Deps {
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return buildDeps({
    ...config, dataDir, dbPath: path.join(dataDir, 'cuisine.db'), recipesDir: path.join(dataDir, 'recipes'), imagesDir: path.join(dataDir, 'images'), tmpDir: path.join(dataDir, 'tmp'),
    anthropicApiKey: null, unsplashAccessKey: null, vapidPublicKey: null, vapidPrivateKey: null,
    aldiPriceLookup: flags.aldi, walmartProductLookup: flags.walmart,
  }, () => undefined);
}

function shopping(deps: Deps) {
  fs.writeFileSync(path.join(dir, 'data', 'recipes', 'frittata.md'), '---\ntitle: Frittata\nmeals: [dinner]\n---\n\n## Ingredients\n\n- 6 eggs\n');
  const eggs = deps.pantry.create({ name: 'eggs', status: 'out' });
  deps.pantry.update(eggs.id, { walmartItemId: ITEM });
  deps.household.saveSetting('store_location', JSON.stringify({ zip: '27601', latitude: 35, longitude: -78, place: 'Raleigh, NC' }));
  deps.plan.upsert({ ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe', recipeSlug: 'frittata' });
  return eggs;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-lookups-'));
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

describe('lookups off', () => {
  it('wires no adapter at all', () => {
    const deps = start({ aldi: false, walmart: false });
    expect(deps.storePrices).toBeNull();
    expect(deps.walmartProducts).toBeNull();
  });

  it('makes no outbound call from the Aldi refresh or the Walmart sweeps', async () => {
    const deps = start({ aldi: false, walmart: false });
    const eggs = shopping(deps);
    expect(await refreshAldiPrices(deps, TODAY)).toBe(0);
    await learnWalmartPacks(deps);
    await readWalmartPack(deps, eggs.id, ITEM);
    await setWalmartProduct(deps, { pantryItemId: eggs.id, name: 'eggs' }, `https://www.walmart.com/ip/${ITEM}`);
    expect(fetched).not.toHaveBeenCalled();
  });

  it('leaves the package size unread, so turning the lookup on later still reads it', async () => {
    const deps = start({ aldi: false, walmart: false });
    const eggs = shopping(deps);
    await learnWalmartPacks(deps);
    expect(deps.pantry.get(eggs.id)?.packSize).toBeNull();
  });

  it('leaves no record of items Aldi "doesn\'t carry"', async () => {
    const deps = start({ aldi: false, walmart: false });
    shopping(deps);
    await refreshAldiPrices(deps, TODAY);
    expect(deps.household.setting('lookup_misses')).toBeNull();
  });

  it('keeps the list working with typed prices, and tells the client not to check', () => {
    const deps = start({ aldi: false, walmart: false });
    const eggs = shopping(deps);
    expect(shoppingWeek(deps, TODAY).aldiLookup).toBe('disabled');
    setPrice(deps, { pantryItemId: eggs.id, name: 'eggs' }, 'aldi', 279);
    const week = shoppingWeek(deps, TODAY);
    expect(week.lines.find(l => l.name === 'eggs')?.price?.cents).toBe(279);
    expect(week.total.cents).toBeGreaterThan(0);
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe('a fresh install with VAPID keys but no HTTPS address yet', () => {
  const keys = webpush.generateVAPIDKeys();
  const withUrl = (publicUrl: string, vapidSubject: string | null = null) => {
    const dataDir = path.join(dir, 'data');
    return buildDeps({ ...config, dataDir, dbPath: path.join(dataDir, 'cuisine.db'), recipesDir: path.join(dataDir, 'recipes'), imagesDir: path.join(dataDir, 'images'), tmpDir: path.join(dataDir, 'tmp'), vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey, publicUrl, vapidSubject }, () => undefined);
  };
  it('still starts, with notifications off', () => {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    expect(withUrl('http://127.0.0.1:2847').notifier.enabled()).toBe(false);
  });
  it('turns them on with the HTTPS address', () => {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    expect(withUrl('https://kitchen.example.ts.net').notifier.enabled()).toBe(true);
  });
  it('turns them on over plain http with a mailto: contact', () => {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    expect(withUrl('http://127.0.0.1:2847', 'mailto:me@example.com').notifier.enabled()).toBe(true);
  });
  it('still starts, with notifications off, on a contact web push would refuse', () => {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    expect(withUrl('https://kitchen.example.ts.net', 'me@example.com').notifier.enabled()).toBe(false);
  });
});

describe('lookups on', () => {
  it('wires the adapters and asks to check', () => {
    const deps = start({ aldi: true, walmart: true });
    shopping(deps);
    expect(deps.storePrices).not.toBeNull();
    expect(deps.walmartProducts).not.toBeNull();
    expect(shoppingWeek(deps, TODAY).aldiLookup).toBe('due');
  });

  it('turning Walmart on reads the size a lookup-off install left unread', async () => {
    const deps = start({ aldi: false, walmart: true });
    const eggs = shopping(deps);
    fetched.mockImplementationOnce(() => Promise.resolve(new Response('<title>Great Value Large Eggs, 18 Count - Walmart.com</title>')) as never);
    await learnWalmartPacks(deps);
    expect(fetched).toHaveBeenCalledOnce();
    expect(deps.pantry.get(eggs.id)?.packSize).not.toBeNull();
  });
});
