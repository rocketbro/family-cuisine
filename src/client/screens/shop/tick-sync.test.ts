import { describe, expect, it } from 'vitest';
import type { TripTicks } from '../../../shared/api-types.ts';
import { createTickSync, newer, ticksShown, type PendingTick } from './tick-sync.ts';

const TRIP = '2026-11-04';
const tick = (key: string, checked = true): PendingTick => ({ trip: TRIP, key, checked });
const settle = () => new Promise(resolve => setTimeout(resolve));

/** A server whose answers are in the test's hands, and timers the test runs itself. */
function harness(saved: PendingTick[] = []) {
  const server = new Map<string, boolean>();
  let rev = 0;
  const state = { failing: false, sent: [] as PendingTick[], kept: saved, timers: [] as (() => void)[] };
  const send = (t: PendingTick): Promise<TripTicks> => {
    state.sent.push(t);
    if (state.failing) return Promise.reject(new Error('no wifi'));
    server.set(t.key, t.checked);
    rev += 1;
    return Promise.resolve({ checked: [...server].filter(([, on]) => on).map(([k]) => k), rev });
  };
  const sync = createTickSync({
    send, load: () => saved, save: pending => { state.kept = pending; },
    wait: run => { state.timers.push(run); return run; }, cancel: () => { state.timers.length = 0; },
  });
  return { sync, state, server };
}

describe('saving ticks', () => {
  it('shows a tap at once, before the server answers', () => {
    const { sync } = harness();
    sync.tap(tick('p1'));
    expect(sync.shown({ trip: TRIP, checked: [], rev: 0 }).has('p1')).toBe(true);
  });

  it('keeps a failed tap on the screen and on the phone, and retries until it lands', async () => {
    const { sync, state, server } = harness();
    state.failing = true;
    sync.tap(tick('p1'));
    await settle();
    expect(sync.shown({ trip: TRIP, checked: [], rev: 0 }).has('p1')).toBe(true);
    expect(state.kept).toEqual([tick('p1')]);
    state.failing = false;
    state.timers.shift()?.();
    await settle();
    expect(server.get('p1')).toBe(true);
    expect(state.kept).toEqual([]);
    expect(sync.unsaved()).toBe(0);
  });

  it('only says it’s stuck after failing for a while', async () => {
    const { sync, state } = harness();
    state.failing = true;
    sync.tap(tick('p1'));
    await settle();
    expect(sync.stuck()).toBe(false);
    for (let i = 0; i < 4; i++) {
      state.timers.shift()?.();
      await settle();
    }
    expect(sync.stuck()).toBe(true);
    state.failing = false;
    sync.retry();
    await settle();
    expect(sync.stuck()).toBe(false);
  });

  it('sends what the phone was still holding when the app was closed', async () => {
    const { sync, server } = harness([tick('p1')]);
    sync.retry();
    await settle();
    expect(server.get('p1')).toBe(true);
  });

  it('ends on the last tap when a line is tapped twice in a row', async () => {
    const { sync, server } = harness();
    sync.tap(tick('p1'));
    sync.tap(tick('p1', false));
    await settle();
    expect(server.get('p1')).toBe(false);
    expect(sync.unsaved()).toBe(0);
  });

  it('won’t let a read from before the tap untick it', async () => {
    const { sync } = harness();
    sync.tap(tick('p1'));
    await settle();
    expect(sync.shown({ trip: TRIP, checked: [], rev: 0 }).has('p1')).toBe(true);
  });

  it('takes what someone else ticked from a newer read', async () => {
    const { sync } = harness();
    sync.tap(tick('p1'));
    await settle();
    expect([...sync.shown({ trip: TRIP, checked: ['p1', 'p2'], rev: 5 })].sort()).toEqual(['p1', 'p2']);
  });

  it('stops trying to tick a line once it’s dealt with', async () => {
    const { sync, state } = harness();
    state.failing = true;
    sync.tap(tick('p1'));
    sync.tap(tick('p2'));
    await settle();
    sync.forget(['p1', 'p2']);
    expect(state.kept).toEqual([]);
  });
});

describe('what shows', () => {
  it('puts unsent taps on top of the server’s ticks, for this trip only', () => {
    const shown = ticksShown({ checked: ['p1', 'p2'] }, [tick('p2', false), tick('p3'), { trip: '2026-11-11', key: 'p9', checked: true }], TRIP);
    expect([...shown].sort()).toEqual(['p1', 'p3']);
  });

  it('prefers the later answer, and the one for the trip being asked about', () => {
    const late = { trip: TRIP, checked: ['a'], rev: 3 };
    expect(newer(late, { trip: TRIP, checked: [], rev: 2 })).toBe(late);
    const next = { trip: '2026-11-11', checked: [], rev: 0 };
    expect(newer(late, next)).toBe(next);
  });
});
