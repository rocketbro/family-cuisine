import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDueJobs, type Schedule } from './jobs.ts';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { holdAutomaticPlanning, saveAutomaticPlanning } from './automatic-planning.ts';
import { deferred, fakeDeps } from './test-support/full-deps-fake.ts';

// 2026-11-11 is a Wednesday, the fake household's shopping day.
const schedule: Schedule = { planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 19, minute: 45 } };
const TRIP = '2026-11-11';
const LATER = '2026-11-13'; // past tomorrow, so only the trip plan reaches it
const at = (time: string, date = TRIP) => new Date(`${date}T${time}:00`);
const tripMessages = (deps: ReturnType<typeof fakeDeps>) => deps.logged.filter(line => line.startsWith('trip-notice sent')).length;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at('12:00'));
});
afterEach(() => void vi.useRealTimers());

const house = () => fakeDeps({ ai: false, recipes: [recipe('soup', ['- 1 cup broth'], { meals: ['breakfast', 'lunch', 'dinner'] })], pantry: [pantryItem(1, 'broth')] });

/** Makes planning throw until `fix` is called. */
function breakPlanning(deps: ReturnType<typeof fakeDeps>) {
  const works = deps.recipes.list;
  deps.recipes.list = () => { throw new Error('disk gone'); };
  return { fix: () => { deps.recipes.list = works; } };
}

describe('scheduled jobs that fail', () => {
  it('retries the trip plan after a failure, then notifies once', async () => {
    const deps = house();
    const planning = breakPlanning(deps);
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.calls.sends).toBe(0);
    expect(deps.plan.get(LATER, 'dinner')).toBeNull();

    planning.fix();
    await runDueJobs(deps, schedule, at('08:01')); // waits a little before trying again
    expect(deps.plan.get(LATER, 'dinner')).toBeNull();
    await runDueJobs(deps, schedule, at('08:06'));
    expect(deps.plan.get(LATER, 'dinner')).not.toBeNull();
    expect(deps.calls.sends).toBe(1);

    await runDueJobs(deps, schedule, at('09:00'));
    expect(deps.calls.sends).toBe(1);
  });

  it('keeps the trip list even when planning fails', async () => {
    const deps = house();
    const saved = vi.spyOn(deps.receipts, 'saveTripList');
    const range = deps.plan.range;
    deps.plan.range = (from, to) => {
      if (to === '9999-12-31') throw new Error('plan table busy'); // only planning asks this far ahead
      return range(from, to);
    };
    await runDueJobs(deps, schedule, at('04:00'));
    expect(saved).toHaveBeenCalledOnce();
    expect(deps.logged.some(line => line.startsWith('top-up failed'))).toBe(true);
  });

  it('one failing job does not stop the ones after it', async () => {
    const deps = house();
    breakPlanning(deps);
    deps.plan.upsert({ ...blankEntry(TRIP, 'dinner'), kind: 'recipe', recipeSlug: 'soup' });
    await runDueJobs(deps, schedule, at('20:00'));
    expect(deps.logged.some(line => line.startsWith('checkin sent'))).toBe(true);
  });
});

describe('a restart in the middle of a job', () => {
  it('leaves a run unfinished until its work is done', async () => {
    const deps = fakeDeps({ recipes: [recipe('soup', ['- 1 cup broth'])], pantry: [pantryItem(1, 'broth')] });
    const held = deferred<[]>();
    deps.planMeals = () => held.promise;
    const running = runDueJobs(deps, schedule, at('08:00'));
    await new Promise(resolve => setImmediate(resolve));
    expect(deps.calls.planMeals).toBe(1);
    expect(deps.household.jobCompleted('top-up', TRIP)).toBe(false);
    held.resolve([]);
    await running;
    expect(deps.household.jobCompleted('top-up', TRIP)).toBe(true);
  });

  it('picks the trip plan back up once the lease runs out', async () => {
    const deps = house();
    deps.household.claimJob('trip-plan', TRIP, at('08:00').toISOString(), at('08:15').toISOString()); // the run that died
    await runDueJobs(deps, schedule, at('08:14'));
    expect(deps.plan.get(LATER, 'dinner')).toBeNull();
    await runDueJobs(deps, schedule, at('08:15'));
    expect(deps.plan.get(LATER, 'dinner')).not.toBeNull();
    expect(tripMessages(deps)).toBe(1);
  });

  it('sends the trip notice if the plan finished but the notice never went', async () => {
    const deps = house();
    deps.household.claimJob('trip-plan', TRIP, at('08:00').toISOString(), null);
    deps.household.completeJob('trip-plan', TRIP);
    await runDueJobs(deps, schedule, at('08:01'));
    expect(tripMessages(deps)).toBe(1);
    expect(deps.plan.range(TRIP, TRIP)).not.toEqual([]); // the top-up still ran
  });

  it('never re-sends a notification that may have gone out', async () => {
    const deps = house();
    deps.send = () => deferred<number>().promise; // the process dies with this send still going
    void runDueJobs(deps, schedule, at('19:45'));
    await new Promise(resolve => setImmediate(resolve));
    expect(deps.calls.sends).toBe(1);
    await runDueJobs(deps, schedule, at('20:30'));
    expect(deps.calls.sends).toBe(1);
  });
});

describe('notifications', () => {
  const checkin = schedule;

  it('retries when sending failed outright', async () => {
    const deps = house();
    deps.send = () => Promise.reject(new Error('no network'));
    await runDueJobs(deps, checkin, at('19:45'));
    expect(deps.calls.sends).toBe(1);
    deps.send = () => Promise.resolve(2);
    await runDueJobs(deps, checkin, at('19:46'));
    expect(deps.calls.sends).toBe(1);
    await runDueJobs(deps, checkin, at('19:50'));
    expect(deps.calls.sends).toBe(2);
    await runDueJobs(deps, checkin, at('20:00'));
    expect(deps.calls.sends).toBe(2);
  });

  it('retries when no phone was reached, but not when one was', async () => {
    const deps = house();
    deps.send = () => Promise.resolve(0);
    await runDueJobs(deps, checkin, at('19:45'));
    deps.send = () => Promise.resolve(1);
    await runDueJobs(deps, checkin, at('19:50'));
    await runDueJobs(deps, checkin, at('20:00'));
    expect(deps.calls.sends).toBe(2);
  });

  it('counts as sent with nobody subscribed', async () => {
    const deps = house();
    deps.subscriptions.list = () => [];
    deps.send = () => Promise.resolve(0);
    await runDueJobs(deps, checkin, at('19:45'));
    await runDueJobs(deps, checkin, at('19:50'));
    expect(deps.calls.sends).toBe(1);
  });

  it('gives up on the check-in nudge after its window', async () => {
    const deps = house();
    deps.send = () => Promise.reject(new Error('no network'));
    await runDueJobs(deps, checkin, at('19:45'));
    await runDueJobs(deps, checkin, at('21:45'));
    expect(deps.calls.sends).toBe(1);
  });
});

describe('the check-in notification', () => {
  const sent = (deps: ReturnType<typeof fakeDeps>) => deps.logged.some(line => line.startsWith('checkin sent'));
  /** A whole day planned (so the trip plan has nothing to add), the lunch as given. */
  const planned = (deps: ReturnType<typeof fakeDeps>, over: Partial<PlanEntry> = {}) => {
    const done = { outcome: 'skipped' as const, checkinSettled: true };
    for (const slot of ['breakfast', 'lunch', 'dinner'] as const) deps.plan.upsert({ ...blankEntry(TRIP, slot), kind: 'recipe', recipeSlug: 'soup', ...done, ...(slot === (over.slot ?? 'lunch') ? over : {}) });
  };

  it('goes out while a meal is unmarked', async () => {
    const deps = house();
    planned(deps, { outcome: null });
    await runDueJobs(deps, schedule, at('19:45'));
    expect(sent(deps)).toBe(true);
  });

  it('stays quiet when every meal is marked and answered', async () => {
    const deps = house();
    planned(deps, { outcome: 'made', checkinSettled: true });
    await runDueJobs(deps, schedule, at('19:45'));
    expect(sent(deps)).toBe(false);
  });

  it('goes out for a meal marked but with its questions unanswered', async () => {
    const deps = house();
    planned(deps, { outcome: 'made', checkinSettled: false });
    await runDueJobs(deps, schedule, at('19:45'));
    expect(sent(deps)).toBe(true);
  });

  it('goes out for a dinner whose leftovers nobody was asked about, until answered', async () => {
    const deps = house();
    planned(deps, { slot: 'dinner', outcome: 'made', checkinSettled: true });
    await runDueJobs(deps, schedule, at('19:45'));
    expect(sent(deps)).toBe(true);

    const answered = house();
    planned(answered, { slot: 'dinner', outcome: 'made', checkinSettled: true });
    answered.household.saveSetting('dinners_left', JSON.stringify({ [TRIP]: 'none' }));
    await runDueJobs(answered, schedule, at('19:45'));
    expect(sent(answered)).toBe(false);
  });

  it('stays quiet once the check-in itself is finished', async () => {
    const deps = house();
    planned(deps, { outcome: null });
    deps.household.checkin = () => ({ mealsDone: true, pantryDone: true });
    await runDueJobs(deps, schedule, at('19:45'));
    expect(sent(deps)).toBe(false);
  });
});

describe('the nightly top-up', () => {
  it('runs once a day when it works', async () => {
    const deps = house();
    saveAutomaticPlanning(deps, { tripMorning: false, nightly: true, held: false });
    await runDueJobs(deps, schedule, at('03:00', '2026-11-09'));
    expect(deps.plan.get('2026-11-10', 'dinner')).not.toBeNull();
    deps.plan.remove('2026-11-10', 'dinner');
    await runDueJobs(deps, schedule, at('03:30', '2026-11-09'));
    expect(deps.plan.get('2026-11-10', 'dinner')).toBeNull();
  });
});

describe('the switches in Settings', () => {
  it('turns off the nightly top-up alone', async () => {
    const deps = house();
    saveAutomaticPlanning(deps, { tripMorning: true, nightly: false, held: false });
    await runDueJobs(deps, schedule, at('03:00'));
    expect(deps.household.jobCompleted('top-up', TRIP)).toBe(false);
    expect(deps.plan.range(TRIP, TRIP)).toEqual([]);
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.plan.get(LATER, 'dinner')).not.toBeNull();
  });

  it('turns off the trip plan alone, and still says it’s a shopping day', async () => {
    const deps = house();
    const sent = vi.fn().mockResolvedValue(1);
    deps.notifier.send = sent;
    saveAutomaticPlanning(deps, { tripMorning: false, nightly: true, held: false });
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.plan.get(TRIP, 'dinner')).not.toBeNull();
    expect(deps.plan.get(LATER, 'dinner')).toBeNull();
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Shopping today', body: expect.stringContaining('Wed, Nov 18') }));
  });

  it('plans nothing after the plan is cleared', async () => {
    const deps = house();
    holdAutomaticPlanning(deps);
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.plan.range(TRIP, LATER)).toEqual([]);
    expect(tripMessages(deps)).toBe(1);
  });
});

describe('the evening of a trip', () => {
  it('asks once for the receipt, in the hour before the check-in', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('19:00'));
    await runDueJobs(deps, schedule, at('19:10'));
    expect(deps.logged.filter(line => line.startsWith('trip-receipt sent'))).toHaveLength(1);
  });

  it('doesn’t ask once there’s a receipt, or on other days', async () => {
    const deps = house();
    deps.receipts.list = () => [{ shopDate: TRIP } as ReturnType<typeof deps.receipts.list>[number]];
    await runDueJobs(deps, schedule, at('19:00'));
    await runDueJobs(deps, schedule, at('19:00', '2026-11-12'));
    expect(deps.logged.some(line => line.startsWith('trip-receipt'))).toBe(false);
  });
});

describe('the plan on the morning of a grocery run', () => {
  const NEXT_DAY = '2026-11-12';
  const LATE = '2026-11-13';
  const NEAR_END = '2026-11-16'; // only a trip run reaches this far from LATE; the top-up stops at tomorrow

  it('plans that trip’s stretch and no further', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.plan.get('2026-11-17', 'dinner')).not.toBeNull();
    expect(deps.plan.get('2026-11-18', 'dinner')).toBeNull();
    expect(tripMessages(deps)).toBe(1);
  });

  it('waits for its time, without running the last trip’s first', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('07:59'));
    expect(deps.household.jobCompleted('trip-plan', '2026-11-04')).toBe(false);
    expect(deps.household.jobCompleted('trip-plan', TRIP)).toBe(false);
  });

  it('follows a moved trip', async () => {
    const deps = house();
    deps.household.shopTrips = () => ['2026-11-04', LATE];
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.household.jobCompleted('trip-plan', LATE)).toBe(false);
    await runDueJobs(deps, schedule, at('08:00', LATE));
    expect(deps.household.jobCompleted('trip-plan', LATE)).toBe(true);
    expect(tripMessages(deps)).toBe(1);
  });

  it('runs when the service is next up, once, and quietly', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('11:00', LATE));
    expect(deps.household.jobCompleted('trip-plan', TRIP)).toBe(true);
    expect(deps.plan.get(NEAR_END, 'dinner')).not.toBeNull();
    expect(deps.calls.sends).toBe(0);

    deps.plan.remove(NEAR_END, 'dinner');
    await runDueJobs(deps, schedule, at('11:01', LATE));
    await runDueJobs(deps, schedule, at('11:00', '2026-11-14'));
    expect(deps.plan.get(NEAR_END, 'dinner')).toBeNull();
  });

  it('doesn’t run again if the morning’s run did finish', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('08:00'));
    deps.plan.remove(NEAR_END, 'dinner');
    await runDueJobs(deps, schedule, at('11:00', LATE));
    expect(deps.plan.get(NEAR_END, 'dinner')).toBeNull();
  });

  it('retries a failed late run past the day it started', async () => {
    const deps = house();
    const planning = breakPlanning(deps);
    await runDueJobs(deps, schedule, at('23:59', NEXT_DAY));
    expect(deps.household.jobCompleted('trip-plan', TRIP)).toBe(false);
    planning.fix();
    await runDueJobs(deps, schedule, at('00:30', LATE));
    expect(deps.household.jobCompleted('trip-plan', TRIP)).toBe(true);
  });

  it('leaves pinned and recorded meals where they are', async () => {
    const deps = house();
    const pinned = { ...blankEntry(LATE, 'dinner'), kind: 'note' as const, note: 'Eating out', pinned: true };
    const eaten = { ...blankEntry(NEXT_DAY, 'lunch'), kind: 'recipe' as const, recipeSlug: 'soup', outcome: 'made' as const, pantrySettled: true };
    deps.plan.upsert(pinned);
    deps.plan.upsert(eaten);
    await runDueJobs(deps, schedule, at('11:00', NEXT_DAY));
    expect(deps.plan.get(LATE, 'dinner')).toEqual(pinned);
    expect(deps.plan.get(NEXT_DAY, 'lunch')).toEqual(eaten);
  });

  it('never buzzes in the afternoon or evening', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('12:00'));
    expect(deps.household.jobCompleted('trip-plan', TRIP)).toBe(true);
    expect(tripMessages(deps)).toBe(0);
  });

  it('never sends a notice again that went out', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('08:00'));
    await runDueJobs(deps, schedule, at('09:00'));
    expect(tripMessages(deps)).toBe(1);
  });
});
