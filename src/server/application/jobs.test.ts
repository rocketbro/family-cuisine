import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDueJobs, type Schedule } from './jobs.ts';
import { blankEntry } from '../../domain/plan.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { deferred, fakeDeps } from './test-support/full-deps-fake.ts';

// 2026-11-08 is a Sunday.
const schedule: Schedule = { planWeekday: 0, planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 19, minute: 45 } };
const at = (time: string, date = '2026-11-08') => new Date(`${date}T${time}:00`);
const weeklyMessages = (deps: ReturnType<typeof fakeDeps>) => deps.logged.filter(line => line.startsWith('weekly-notice sent')).length;

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
  it('retries the weekly plan after a failure, then notifies once', async () => {
    const deps = house();
    const planning = breakPlanning(deps);
    await runDueJobs(deps, schedule, at('08:00'));
    expect(deps.calls.sends).toBe(0);
    expect(deps.plan.get('2026-11-10', 'dinner')).toBeNull();

    planning.fix();
    await runDueJobs(deps, schedule, at('08:01')); // waits a little before trying again
    expect(deps.plan.get('2026-11-10', 'dinner')).toBeNull();
    await runDueJobs(deps, schedule, at('08:06'));
    expect(deps.plan.get('2026-11-10', 'dinner')).not.toBeNull();
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
    await runDueJobs(deps, { ...schedule, planWeekday: 1 }, at('04:00'));
    expect(saved).toHaveBeenCalledOnce();
    expect(deps.logged.some(line => line.startsWith('top-up failed'))).toBe(true);
  });

  it('one failing job does not stop the ones after it', async () => {
    const deps = house();
    breakPlanning(deps);
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
    expect(deps.household.jobCompleted('top-up', '2026-11-08')).toBe(false);
    held.resolve([]);
    await running;
    expect(deps.household.jobCompleted('top-up', '2026-11-08')).toBe(true);
  });

  it('picks the weekly plan back up once the lease runs out', async () => {
    const deps = house();
    const nextWeek = '2026-11-10'; // only the weekly run reaches this far; the top-up stops at tomorrow
    deps.household.claimJob('weekly-plan', '2026-11-08', at('08:00').toISOString(), at('08:15').toISOString()); // the run that died
    await runDueJobs(deps, schedule, at('08:14'));
    expect(deps.plan.get(nextWeek, 'dinner')).toBeNull();
    await runDueJobs(deps, schedule, at('08:15'));
    expect(deps.plan.get(nextWeek, 'dinner')).not.toBeNull();
    expect(weeklyMessages(deps)).toBe(1);
  });

  it('sends the weekly notice if the plan finished but the notice never went', async () => {
    const deps = house();
    deps.household.claimJob('weekly-plan', '2026-11-08', at('08:00').toISOString(), null);
    deps.household.completeJob('weekly-plan', '2026-11-08');
    await runDueJobs(deps, schedule, at('08:01'));
    expect(weeklyMessages(deps)).toBe(1);
    expect(deps.plan.range('2026-11-08', '2026-11-08')).not.toEqual([]); // the top-up still ran
  });

  it('never re-sends a notification that may have gone out', async () => {
    const deps = house();
    deps.send = () => deferred<number>().promise; // the process dies with this send still going
    void runDueJobs(deps, { ...schedule, planWeekday: 1 }, at('19:45'));
    await new Promise(resolve => setImmediate(resolve));
    expect(deps.calls.sends).toBe(1);
    await runDueJobs(deps, { ...schedule, planWeekday: 1 }, at('20:30'));
    expect(deps.calls.sends).toBe(1);
  });
});

describe('notifications', () => {
  const checkin = { ...schedule, planWeekday: 1 };

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

describe('the nightly top-up', () => {
  it('runs once a day when it works', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('03:00', '2026-11-09'));
    expect(deps.plan.get('2026-11-10', 'dinner')).not.toBeNull();
    deps.plan.remove('2026-11-10', 'dinner');
    await runDueJobs(deps, schedule, at('03:30', '2026-11-09'));
    expect(deps.plan.get('2026-11-10', 'dinner')).toBeNull();
  });
});

describe('a weekly plan the machine was off for', () => {
  const MONDAY = '2026-11-09';
  const TUESDAY = '2026-11-10';
  const THURSDAY = '2026-11-12'; // only a weekly run reaches this far; the top-up stops at tomorrow
  const SUNDAY_RUN = '2026-11-08';

  it('runs when the service is next up, once', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('11:00', MONDAY));
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(true);
    expect(deps.plan.get(THURSDAY, 'dinner')).not.toBeNull();

    deps.plan.remove(THURSDAY, 'dinner');
    await runDueJobs(deps, schedule, at('11:01', MONDAY));
    await runDueJobs(deps, schedule, at('11:00', TUESDAY));
    expect(deps.plan.get(THURSDAY, 'dinner')).toBeNull();
  });

  it('doesn’t run again if Sunday’s run did finish', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('08:00'));
    deps.plan.remove(THURSDAY, 'dinner');
    await runDueJobs(deps, schedule, at('11:00', MONDAY));
    expect(deps.plan.get(THURSDAY, 'dinner')).toBeNull();
  });

  it('retries a failed late run past the day it started', async () => {
    const deps = house();
    const planning = breakPlanning(deps);
    await runDueJobs(deps, schedule, at('23:59', MONDAY));
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(false);
    planning.fix();
    await runDueJobs(deps, schedule, at('00:30', TUESDAY));
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(true);
  });

  it('leaves pinned and recorded meals where they are', async () => {
    const deps = house();
    const pinned = { ...blankEntry(TUESDAY, 'dinner'), kind: 'note' as const, note: 'Eating out', pinned: true };
    const eaten = { ...blankEntry(MONDAY, 'lunch'), kind: 'recipe' as const, recipeSlug: 'soup', outcome: 'made' as const, pantrySettled: true };
    deps.plan.upsert(pinned);
    deps.plan.upsert(eaten);
    await runDueJobs(deps, schedule, at('11:00', MONDAY));
    expect(deps.plan.get(TUESDAY, 'dinner')).toEqual(pinned);
    expect(deps.plan.get(MONDAY, 'lunch')).toEqual(eaten);
  });

  it('runs a Sunday plan only once its time comes, not last week’s first', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('07:59'));
    expect(deps.household.jobCompleted('weekly-plan', '2026-11-01')).toBe(false);
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(false);
  });

  it('skips it the day before the next one', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('12:00', '2026-11-14'));
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(false);
  });

  it('still announces it a day late in the daytime', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('11:00', MONDAY));
    expect(weeklyMessages(deps)).toBe(1);
    await runDueJobs(deps, schedule, at('12:00', MONDAY));
    expect(weeklyMessages(deps)).toBe(1);
  });

  it('plans overnight but holds the notice until morning', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('02:00', MONDAY));
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(true);
    expect(weeklyMessages(deps)).toBe(0);
    await runDueJobs(deps, schedule, at('08:00', MONDAY));
    expect(weeklyMessages(deps)).toBe(1);
  });

  it('stays quiet when it’s more than a day late', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('11:00', TUESDAY));
    expect(deps.household.jobCompleted('weekly-plan', SUNDAY_RUN)).toBe(true);
    expect(deps.calls.sends).toBe(0);
  });

  it('never sends a notice again that went out on the day', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('08:00'));
    await runDueJobs(deps, schedule, at('11:00', MONDAY));
    expect(weeklyMessages(deps)).toBe(1);
  });
});
