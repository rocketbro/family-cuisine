// Ticks saved against the trip, through the real app and database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveTrip } from './application/shop-day.ts';
import { NEXT_TRIP, shoppingHouse, TODAY, TRIP } from './application/test-support/shopping-house.ts';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-ticks-'));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

function stocked() {
  const h = shoppingHouse(dir);
  const milk = h.deps.pantry.create({ name: 'milk', status: 'out' });
  const rice = h.deps.pantry.create({ name: 'rice', status: 'out' });
  return { h, milk, rice, milkKey: `p${milk.id}`, riceKey: `p${rice.id}` };
}
const ticked = async (h: ReturnType<typeof shoppingHouse>) => [...(await h.read()).ticks.checked].sort();

describe('ticks', () => {
  it('come back on the next read, and change nothing in the pantry', async () => {
    const { h, milk, milkKey } = stocked();
    await h.tick(milkKey);
    expect(await ticked(h)).toEqual([milkKey]);
    expect(h.deps.pantry.get(milk.id)?.status).toBe('out');
  });

  it('from two phones don’t overwrite each other, even sent together', async () => {
    const { h, milkKey, riceKey } = stocked();
    await Promise.all([h.tick(milkKey), h.tick(riceKey)]);
    expect(await ticked(h)).toEqual([milkKey, riceKey].sort());
    await h.tick(milkKey, false);
    expect(await ticked(h)).toEqual([riceKey]);
  });

  it('can be sent twice without undoing themselves', async () => {
    const { h, milkKey } = stocked();
    await h.tick(milkKey);
    await h.tick(milkKey);
    expect(await ticked(h)).toEqual([milkKey]);
  });

  it('answer with a higher revision each time, so an old read can be told from a new one', async () => {
    const { h, milkKey, riceKey } = stocked();
    const first = await (await h.tick(milkKey)).json() as { rev: number };
    const second = await (await h.tick(riceKey)).json() as { rev: number; checked: string[] };
    expect(second.rev).toBeGreaterThan(first.rev);
    expect(second.checked).toEqual([milkKey, riceKey]);
  });

  it('go when they’re put away, leaving what someone else has ticked since', async () => {
    const { h, milk, milkKey, riceKey } = stocked();
    await h.tick(milkKey);
    await h.tick(riceKey);
    await h.bought([{ key: milkKey, pantryItemId: milk.id, name: 'milk', quantity: null }]);
    expect(h.deps.pantry.get(milk.id)?.status).toBe('have');
    expect(await ticked(h)).toEqual([riceKey]);
  });

  it('go when the line is skipped or marked as in the house', async () => {
    const { h, milkKey, riceKey } = stocked();
    await h.tick(milkKey);
    await h.tick(riceKey);
    await h.skip(milkKey);
    await h.have(riceKey);
    expect(await ticked(h)).toEqual([]);
  });

  it('follow the trip when it moves', async () => {
    const { h, milkKey } = stocked();
    await h.tick(milkKey);
    await h.add('candles');
    await h.skip('o:candle');
    await moveTrip(h.deps, TODAY, TRIP, '2026-11-06');
    const week = await h.read();
    expect(week.shopDate).toBe('2026-11-06');
    expect(week.ticks.checked).toEqual([milkKey]);
    expect(week.skipped.map(l => l.name)).toEqual(['candles']);
  });

  it('clear when the next trip begins', async () => {
    const { h, milkKey } = stocked();
    await h.tick(milkKey);
    vi.setSystemTime(new Date(`${NEXT_TRIP}T08:00:00`));
    expect((await h.read()).ticks).toEqual({ checked: [], rev: 0 });
  });

  it('that arrive after their trip is over don’t tick next week’s list', async () => {
    const { h, milkKey } = stocked();
    vi.setSystemTime(new Date(`${NEXT_TRIP}T08:00:00`));
    const res = await h.tick(milkKey, true, TRIP);
    expect(res.status).toBe(200);
    expect((await h.read()).ticks.checked).toEqual([]);
    expect(h.deps.household.setting(`trip_plan:${TRIP}`)).toBeFalsy();
  });

  it('refuse a date that isn’t one', async () => {
    const { h, milkKey } = stocked();
    expect((await h.tick(milkKey, true, 'tomorrow')).status).toBe(400);
  });

  it('are read without writing anything', async () => {
    const { h, milkKey } = stocked();
    await h.tick(milkKey);
    const before = h.deps.household.setting(`trip_plan:${TRIP}`);
    await h.read();
    expect(h.deps.household.setting(`trip_plan:${TRIP}`)).toBe(before);
  });
});
