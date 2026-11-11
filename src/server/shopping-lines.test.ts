// Changing the list from the list: Have it, Not this trip and Add something, through the real app and database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankEntry } from '../domain/plan.ts';
import { noteListOpened } from './application/list-opened.ts';
import { NEXT_TRIP, shoppingHouse, TODAY, TRIP } from './application/test-support/shopping-house.ts';

let dir: string;
const house = (ingredients: string[] = []) => shoppingHouse(dir, ingredients);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-lines-'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Have it', () => {
  it('sets a plain item to have, so the line goes', async () => {
    const h = house();
    const onions = h.deps.pantry.create({ name: 'onions', status: 'out' });
    await h.have(`p${onions.id}`);
    expect(h.deps.pantry.get(onions.id)?.status).toBe('have');
    expect(await h.names()).not.toContain('onions');
  });

  it('brings a counted item up to what the meals need, and only once', async () => {
    const h = house(['6 eggs']);
    const eggs = h.deps.pantry.create({ name: 'eggs', count: 4, status: 'have' });
    await h.have(`p${eggs.id}`);
    await h.have(`p${eggs.id}`);
    expect(h.deps.pantry.get(eggs.id)).toMatchObject({ count: 6, status: 'have' });
    expect(await h.names()).not.toContain('eggs');
  });

  it('gives a counted restock a count that reads as have', async () => {
    const h = house();
    const cans = h.deps.pantry.create({ name: 'tomato cans', count: 0, status: 'out' });
    await h.have(`p${cans.id}`);
    expect(h.deps.pantry.get(cans.id)).toMatchObject({ count: 3, status: 'have' });
    expect(await h.names()).not.toContain('tomato cans');
  });

  it('clears a line whose measured portions fall short', async () => {
    const h = house(['2 lb chicken']);
    const chicken = h.deps.pantry.create({ name: 'chicken', status: 'have' });
    h.deps.pantry.setPortions(chicken.id, [{ storage: 'fresh', amount: 1, unit: 'lb', canOz: null, useBy: null, useByEstimated: false }]);
    expect(await h.names()).toContain('chicken');
    await h.have(`p${chicken.id}`);
    expect(await h.names()).not.toContain('chicken');
  });

  it('clears a counted line the pantry alone wouldn’t, by leaving it off this trip', async () => {
    const h = house(['eggs']);
    const eggs = h.deps.pantry.create({ name: 'eggs', count: 12, status: 'have' });
    await h.have(`p${eggs.id}`);
    const week = await h.read();
    expect(week.lines.map(l => l.name)).not.toContain('eggs');
    expect(week.skipped.map(l => l.name)).toContain('eggs');
  });

  it('makes an as-needed item for a line the pantry has never heard of', async () => {
    const h = house(['1 tsp saffron']);
    await h.have('n:saffron');
    const saffron = h.deps.pantry.findByName('saffron');
    expect(saffron).toMatchObject({ status: 'have', occasional: true });
    expect(await h.names()).not.toContain('saffron');
    // Marked out later, it stays off the list unless a recipe wants it.
    h.deps.plan.upsert({ ...blankEntry(TRIP, 'dinner') });
    h.deps.pantry.update(saffron!.id, { status: 'out' });
    expect(await h.names()).not.toContain('saffron');
  });

  it('does nothing for a line that’s already gone', async () => {
    const h = house();
    const res = await h.have('p999');
    expect(res.status).toBe(200);
  });
});

describe('Not this trip', () => {
  const priced = async (ingredients: string[] = []) => {
    const h = house(ingredients);
    const beef = h.deps.pantry.create({ name: 'beef', status: 'out', category: 'Meat', walmartItemId: '11111' });
    const rice = h.deps.pantry.create({ name: 'rice', status: 'out', category: 'Pantry', walmartItemId: '22222' });
    await h.price(beef.id, 'beef', 1200);
    await h.price(rice.id, 'rice', 300);
    return { h, beef, rice };
  };

  it('takes the line off the list and the total, and shows it to bring back', async () => {
    const { h, beef } = await priced();
    await h.skip(`p${beef.id}`);
    const week = await h.read();
    expect(week.lines.map(l => l.name)).toEqual(['rice']);
    expect(week.total.cents).toBe(300);
    expect(week.skipped.map(l => l.name)).toEqual(['beef']);
    await h.skip(`p${beef.id}`, false);
    const back = await h.read();
    expect(back.lines.map(l => l.name).sort()).toEqual(['beef', 'rice']);
    expect(back.total.cents).toBe(1500);
    expect(back.skipped).toEqual([]);
  });

  it('counts towards the budget’s room', async () => {
    const { h, beef } = await priced();
    await h.send('/budget', 'PUT', { cents: 1000 });
    expect((await h.read()).leewayCents).toBe(0);
    await h.skip(`p${beef.id}`);
    expect((await h.read()).leewayCents).toBe(700);
  });

  it('comes off the Walmart cart link, and an unmatched one stops asking for a product', async () => {
    const { h, beef } = await priced();
    const milk = h.deps.pantry.create({ name: 'milk', status: 'out' });
    await h.send('/store', 'PUT', { store: 'walmart' });
    await h.skip(`p${beef.id}`);
    await h.skip(`p${milk.id}`);
    const week = await h.read();
    expect(week.walmartToSend.map(l => l.itemId)).toEqual(['22222']);
    expect(week.walmartCartUrl).not.toContain('11111');
    expect(week.walmartUnmatched).toEqual([]);
  });

  it('doesn’t add it to the cart twice when it’s skipped after sending and put back', async () => {
    const { h, beef } = await priced();
    await h.send('/store', 'PUT', { store: 'walmart' });
    await h.send('/walmart-sent', 'POST', { lines: [{ itemId: '11111', quantity: 1 }] });
    await h.skip(`p${beef.id}`);
    await h.skip(`p${beef.id}`, false);
    expect((await h.read()).walmartToSend.map(l => l.itemId)).toEqual(['22222']);
  });

  it('doesn’t buy it back as stock with the room it frees', async () => {
    const { h, beef } = await priced();
    await h.send('/budget', 'PUT', { cents: 5000 });
    h.deps.pantry.update(beef.id, { stockUp: { amount: 10, unit: 'lb', storage: 'frozen', priority: 1 } as never, packSize: { count: 1 } as never });
    expect((await h.read()).stockUp.map(l => l.name)).toContain('beef');
    await h.skip(`p${beef.id}`);
    expect((await h.read()).stockUp.map(l => l.name)).not.toContain('beef');
  });

  it('comes back by itself next trip', async () => {
    const { h, beef } = await priced();
    await h.skip(`p${beef.id}`);
    vi.setSystemTime(new Date(`${NEXT_TRIP}T08:00:00`));
    const week = await h.read();
    expect(week.shopDate).toBe(NEXT_TRIP);
    expect(week.lines.map(l => l.name)).toContain('beef');
    expect(week.skipped).toEqual([]);
  });

  it('leaves the trip’s record, so a receipt without it doesn’t read as a miss', async () => {
    const { h, beef } = await priced();
    noteListOpened(h.deps, TODAY);
    expect(h.deps.receipts.tripList(TRIP)?.map(l => l.name)).toContain('beef');
    await h.skip(`p${beef.id}`);
    noteListOpened(h.deps, TODAY);
    expect(h.deps.receipts.tripList(TRIP)?.map(l => l.name)).toEqual(['rice']);
  });
});

describe('Add something', () => {
  it('adds a line under Other at the trip’s store, and not to the pantry', async () => {
    const h = house();
    await h.add('Candles');
    expect(await h.line('Candles')).toMatchObject({ key: 'o:candle', category: 'Other', store: 'aldi', reason: 'added', pantryItemId: null, price: null });
    await h.send('/store', 'PUT', { store: 'walmart' });
    expect((await h.line('Candles'))?.store).toBe('walmart');
    expect(h.deps.pantry.list()).toEqual([]);
  });

  it('is one line however many times it’s added', async () => {
    const h = house();
    await h.add('candles');
    const again = await h.add(' Candle ');
    expect(await again.json()).toEqual({ already: true });
    expect(await h.names()).toEqual(['candles']);
  });

  it('refuses a name with nothing in it', async () => {
    const res = await house().add('!!!');
    expect(res.status).toBe(400);
  });

  it('says so when it’s on the list already, and brings back what was skipped', async () => {
    const h = house();
    const milk = h.deps.pantry.create({ name: 'milk', status: 'out' });
    expect(await (await h.add('Milk')).json()).toEqual({ already: true });
    await h.skip(`p${milk.id}`);
    expect(await (await h.add('Milk')).json()).toEqual({ already: false });
    expect(await h.names()).toEqual(['milk']);
  });

  it('uses a pantry item of the same name, with its aisle, price and store', async () => {
    const h = house();
    const milk = h.deps.pantry.create({ name: 'milk', status: 'have', category: 'Dairy & eggs', store: 'walmart', walmartItemId: '333' });
    await h.add('milk');
    expect(await h.line('milk')).toMatchObject({ pantryItemId: milk.id, category: 'Dairy & eggs', store: 'walmart', walmartItemId: '333' });
  });

  it('won’t match a looser name', async () => {
    const h = house();
    h.deps.pantry.create({ name: 'oat milk', status: 'have' });
    await h.add('milk');
    expect((await h.line('milk'))?.pantryItemId).toBeNull();
  });

  it('stays out of the pantry when it’s bought, stays on the trip’s record, and leaves the list', async () => {
    const h = house();
    await h.add('candles');
    noteListOpened(h.deps, TODAY);
    const line = { key: 'o:candle', pantryItemId: null, name: 'candles', quantity: null };
    await h.bought([line]);
    await h.bought([line]);
    expect(h.deps.pantry.list()).toEqual([]);
    expect(await h.names()).toEqual([]);
    expect(h.deps.receipts.tripList(TRIP)?.find(l => l.name === 'candles')).toMatchObject({ checkedOff: true, reason: 'added' });
  });

  it('restocks the pantry item when it’s one the pantry knows', async () => {
    const h = house();
    const milk = h.deps.pantry.create({ name: 'milk', status: 'low', occasional: true });
    await h.add('milk');
    await h.bought([{ key: 'o:milk', pantryItemId: milk.id, name: 'milk', quantity: null }]);
    expect(h.deps.pantry.get(milk.id)?.status).toBe('have');
    expect(h.deps.pantry.list()).toHaveLength(1);
    expect(await h.names()).toEqual([]);
  });

  it('still makes a pantry item for an unknown recipe line when it’s bought', async () => {
    const h = house(['1 tsp saffron']);
    await h.bought([{ key: 'n:saffron', pantryItemId: null, name: 'saffron', quantity: null }]);
    expect(h.deps.pantry.findByName('saffron')?.status).toBe('have');
  });

  it('keeps its typed price and product with the trip, not in the pantry', async () => {
    const h = house();
    await h.add('candles');
    await h.price(null, 'candles', 899);
    await h.send('/store', 'PUT', { store: 'walmart' });
    await h.send('/walmart-product', 'PUT', { line: { pantryItemId: null, name: 'candles' }, link: 'https://www.walmart.com/ip/candle/444444' });
    const week = await h.read();
    expect(h.deps.pantry.list()).toEqual([]);
    expect(week.total.cents).toBe(899);
    expect(week.walmartToSend).toEqual([{ itemId: '444444', quantity: 1 }]);
  });

  it('counts in the total and comes off with Not this trip', async () => {
    const h = house();
    await h.add('candles');
    await h.price(null, 'candles', 899);
    expect((await h.read()).total.cents).toBe(899);
    await h.skip('o:candle');
    const week = await h.read();
    expect(week.total.cents).toBe(0);
    expect(week.skipped.map(l => l.name)).toEqual(['candles']);
  });

  it('isn’t looked up, so a lookup can’t put it in the pantry', async () => {
    const h = house();
    h.deps.household.saveSetting('store_location', JSON.stringify({ zip: '27601', latitude: 35, longitude: -78, place: 'Raleigh, NC' }));
    const lookup = vi.fn(() => Promise.resolve(new Map()));
    h.deps.storePrices = { lookup };
    await h.add('candles');
    expect((await h.read()).aldiLookup).toBe('done');
    await h.send('/prices/refresh', 'POST');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('goes away with the trip', async () => {
    const h = house();
    await h.add('candles');
    vi.setSystemTime(new Date(`${NEXT_TRIP}T08:00:00`));
    expect(await h.names()).toEqual([]);
  });

  it('isn’t shown twice when the list comes to need it anyway', async () => {
    const h = house(['candles']);
    await h.add('candles');
    expect(await h.names()).toEqual(['candles']);
  });
});

describe('the list’s sections', () => {
  it('carries the category and follows the walk, with no-item lines under Other', async () => {
    const h = house(['1 tsp saffron']);
    for (const [name, category] of [['peas', 'Frozen'], ['onions', 'Produce'], ['rice', 'Pantry'], ['apples', 'Produce']]) h.deps.pantry.create({ name, category, status: 'out' });
    await h.add('candles');
    const week = await h.read();
    expect(week.lines.map(l => l.name)).toEqual(['apples', 'onions', 'rice', 'peas', 'candles', 'saffron']);
    expect(week.lines.find(l => l.name === 'saffron')?.category).toBe('Other');
  });
});
