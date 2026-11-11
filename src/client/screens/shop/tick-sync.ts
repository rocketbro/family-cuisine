// Ticks while the store's wifi comes and goes. A tap shows at once and goes in a queue that outlives
// the screen and a reload, and it's sent one at a time, retrying until the server has it. What's
// shown is the newest answer from the server with the unsent taps on top. Answers carry a revision,
// so a read that left before a tap landed can't untick it.
import type { ISODate } from '../../../domain/dates.ts';
import type { TripTicks } from '../../../shared/api-types.ts';

export type PendingTick = { trip: ISODate; key: string; checked: boolean };
export type Snapshot = TripTicks & { trip: ISODate };

/** How long to wait after each failure in a row; the last one repeats. */
const RETRY_AFTER = [2_000, 5_000, 10_000, 20_000, 30_000];
/** This many failures in a row (about 40 seconds) is worth telling someone. */
const STUCK_AFTER = 5;

type Options = {
  send: (tick: PendingTick) => Promise<TripTicks>;
  load: () => PendingTick[];
  save: (pending: PendingTick[]) => void;
  wait?: (run: () => void, ms: number) => unknown;
  cancel?: (timer: unknown) => void;
};

/** The later of two answers. Another trip's isn't comparable, so the one being asked about wins. */
export function newer(held: Snapshot | null, other: Snapshot): Snapshot {
  return held?.trip === other.trip && held.rev > other.rev ? held : other;
}

/** The last thing said about each line is what counts. */
export function ticksShown(snapshot: Pick<Snapshot, 'checked'> | null, pending: readonly PendingTick[], trip: ISODate): Set<string> {
  const shown = new Set(snapshot?.checked ?? []);
  for (const tick of pending.filter(t => t.trip === trip)) {
    if (tick.checked) shown.add(tick.key);
    else shown.delete(tick.key);
  }
  return shown;
}

export function createTickSync({ send, load, save, wait = setTimeout, cancel = t => clearTimeout(t as number) }: Options) {
  let pending = load();
  let snapshot: Snapshot | null = null;
  let failures = 0;
  let sending = false;
  let timer: unknown = null;
  let version = 0;
  const listeners = new Set<() => void>();

  const changed = () => {
    version += 1;
    for (const listener of listeners) listener();
  };
  const hold = (next: PendingTick[]) => {
    pending = next;
    save(pending);
    changed();
  };

  async function flush(): Promise<void> {
    if (sending || !pending.length) return;
    if (timer !== null) { cancel(timer); timer = null; }
    sending = true;
    try {
      while (pending.length) {
        const tick = pending[0];
        const answer = await send(tick);
        // Tapped again while this was on its way: that tap still has to go.
        const later = pending.filter(t => t !== tick);
        snapshot = newer(snapshot, { ...answer, trip: tick.trip });
        failures = 0;
        hold(later);
      }
    } catch {
      failures += 1;
      timer = wait(() => { timer = null; void flush(); }, RETRY_AFTER[Math.min(failures, RETRY_AFTER.length) - 1]);
      changed();
    } finally {
      sending = false;
    }
  }

  return {
    tap(tick: PendingTick) {
      // The same line's earlier tap is replaced, unless it's already on its way.
      const same = (t: PendingTick) => t.trip === tick.trip && t.key === tick.key;
      const first = pending[0];
      hold([...pending.filter(t => !same(t) || (sending && t === first)), tick]);
      void flush();
    },
    /** Lines the server has just dealt with (put away, skipped), so nothing here ticks them again. */
    forget(keys: readonly string[]) {
      const first = pending[0];
      hold(pending.filter(t => !keys.includes(t.key) || (sending && t === first)));
    },
    accept(answer: Snapshot) {
      const best = newer(snapshot, answer);
      if (best === snapshot) return;
      snapshot = best;
      changed();
    },
    /** Now, not at the next retry: the phone woke up, or someone asked. */
    retry: () => void flush(),
    shown: (answer: Snapshot) => ticksShown(newer(snapshot, answer), pending, answer.trip),
    unsaved: () => pending.length,
    stuck: () => failures >= STUCK_AFTER,
    version: () => version,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
