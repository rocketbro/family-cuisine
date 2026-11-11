// The ticks for the list on screen, from the one queue this phone keeps (tick-sync.ts), which goes on
// working after the screen has gone. The phone waking up or coming back online sends what's waiting.
import { useEffect, useSyncExternalStore } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import type { TripTicks } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { onChange } from '../../data-events.ts';
import { createTickSync, type PendingTick } from './tick-sync.ts';

const KEY = 'cuisine.ticks.unsaved';
/** A write has no time limit of its own, and one hanging on bad wifi would hold up the rest. */
const SEND_LIMIT_MS = 10_000;

const ticks = createTickSync({
  send: tick => api.setTick(tick.trip, tick.key, tick.checked, AbortSignal.timeout(SEND_LIMIT_MS)),
  load() {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PendingTick[]; } catch { return []; }
  },
  save(pending) {
    if (pending.length) localStorage.setItem(KEY, JSON.stringify(pending));
    else localStorage.removeItem(KEY);
  },
});

const NONE = { checked: [], rev: 0 };

export function useTicks(trip: ISODate | null, server: TripTicks | null) {
  useSyncExternalStore(ticks.subscribe, ticks.version);
  const answer = { trip: trip ?? '', ...(server ?? NONE) };
  useEffect(() => {
    if (trip && server) ticks.accept({ trip, ...server });
  }, [trip, server]);
  useEffect(() => {
    ticks.retry();
    return onChange(ticks.retry);
  }, []);

  return {
    checked: ticks.shown(answer),
    toggle: (key: string, checked: boolean) => { if (trip) ticks.tap({ trip, key, checked }); },
    forget: ticks.forget,
    unsaved: ticks.unsaved(),
    stuck: ticks.stuck(),
    retry: ticks.retry,
  };
}
