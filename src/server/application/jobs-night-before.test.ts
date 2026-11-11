// The evening reminder and the one-time run through old recipes, as the scheduler sees them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extraSlot } from '../../domain/plan-slot.ts';
import { blankEntry, type PlanEntry } from '../../domain/plan.ts';
import { recipe } from '../../domain/test-fixtures.ts';
import { runDueJobs, type Schedule } from './jobs.ts';
import { saveNightBeforeTime } from './night-before-time.ts';
import { deferred, fakeDeps } from './test-support/full-deps-fake.ts';

// A plain Tuesday, with the check-in moved out of the way of the evening.
const today = '2026-11-10';
const tomorrow = '2026-11-11';
const schedule: Schedule = { planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 6, minute: 0 } };
const at = (time: string, date = today) => new Date(`${date}T${time}:00`);

// Good for no meal, so the morning's top-up leaves each test's plan as it set it.
const beans = recipe('beans', ['- 1 lb dry beans'], { meals: [], title: 'Black Bean Soup', nightBefore: 'Soak the beans overnight' });
const roast = recipe('roast', ['- 1 roast'], { meals: [], title: 'Roast', nightBefore: 'Rub the roast and chill it' });
const cooks = (slug: string, slot: PlanEntry['slot'] = 'dinner', date = tomorrow): PlanEntry => ({ ...blankEntry(date, slot), kind: 'recipe', recipeSlug: slug });

function kitchen(...entries: PlanEntry[]) {
  const deps = fakeDeps({ ai: false, recipes: [beans, roast, recipe('toast', [], { meals: [] })] });
  deps.subscriptions.list = () => [{ endpoint: 'phone', person: 'Someone', keys: { p256dh: '', auth: '' } }];
  for (const entry of entries) deps.plan.upsert(entry);
  const sent: { title: string; body: string; url: string }[] = [];
  deps.notifier.send = message => { deps.calls.sends += 1; sent.push(message); return deps.send(); };
  return { deps, sent };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at('12:00'));
});
afterEach(() => void vi.useRealTimers());

describe('the night-before reminder', () => {
  it('goes out at the set time, names the task and opens the recipe', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    await runDueJobs(deps, schedule, at('16:59'));
    expect(sent).toEqual([]);
    await runDueJobs(deps, schedule, at('17:00'));
    expect(sent).toEqual([{ title: 'Tomorrow: Black Bean Soup', body: 'Soak the beans overnight.', url: `/recipes/beans?x=1&date=${tomorrow}&slot=dinner` }]);
  });

  it('counts an extra', async () => {
    const { deps, sent } = kitchen(cooks('beans', extraSlot(3)));
    await runDueJobs(deps, schedule, at('17:00'));
    expect(sent[0].url).toContain('slot=extra-3');
  });

  it('combines several into one that opens the day', async () => {
    const { deps, sent } = kitchen(cooks('beans'), cooks('roast', extraSlot(1)));
    await runDueJobs(deps, schedule, at('17:00'));
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toContain('Black Bean Soup');
    expect(sent[0].body).toContain('Roast');
    expect(sent[0].url).toBe(`/day/${tomorrow}`);
  });

  it('fires only once a day, however many ticks follow', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    for (const time of ['17:00', '17:01', '18:00', '19:59']) await runDueJobs(deps, schedule, at(time));
    expect(sent).toHaveLength(1);
  });

  it('fires again the next evening for the next day’s meal', async () => {
    const { deps, sent } = kitchen(cooks('beans'), cooks('roast', 'dinner', '2026-11-12'));
    await runDueJobs(deps, schedule, at('17:00'));
    await runDueJobs(deps, schedule, at('17:00', tomorrow));
    expect(sent.map(m => m.title)).toEqual(['Tomorrow: Black Bean Soup', 'Tomorrow: Roast']);
  });

  it('skips a meal already made, and sends nothing with nothing to do', async () => {
    const { deps, sent } = kitchen({ ...cooks('beans'), outcome: 'made' }, cooks('toast', 'lunch'));
    await runDueJobs(deps, schedule, at('17:00'));
    expect(sent).toEqual([]);
    expect(deps.calls.sends).toBe(0);
  });

  it('gives a meal planned after the evening’s look no buzz', async () => {
    const { deps, sent } = kitchen();
    await runDueJobs(deps, schedule, at('17:00'));
    deps.plan.upsert(cooks('beans')); // a swap at half past five
    await runDueJobs(deps, schedule, at('17:31'));
    expect(sent).toEqual([]);
  });

  it('still goes out when the service comes back within the window', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    await runDueJobs(deps, schedule, at('19:59'));
    expect(sent).toHaveLength(1);
  });

  it('stays quiet when the service comes back after it', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    await runDueJobs(deps, schedule, at('20:00'));
    await runDueJobs(deps, schedule, at('23:30'));
    expect(sent).toEqual([]);
  });

  it('retries when no phone could be reached, while the window lasts', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    deps.send = () => Promise.reject(new Error('no network'));
    await runDueJobs(deps, schedule, at('17:00'));
    deps.send = () => Promise.resolve(1);
    await runDueJobs(deps, schedule, at('17:01'));
    expect(sent).toHaveLength(1); // waits a little first
    await runDueJobs(deps, schedule, at('17:05'));
    expect(sent).toHaveLength(2);
    await runDueJobs(deps, schedule, at('17:30'));
    expect(sent).toHaveLength(2);
  });

  it('a retry that finds the meal gone sends nothing', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    deps.send = () => Promise.reject(new Error('no network'));
    await runDueJobs(deps, schedule, at('17:00'));
    deps.plan.remove(tomorrow, 'dinner');
    deps.send = () => Promise.resolve(1);
    await runDueJobs(deps, schedule, at('17:05'));
    expect(sent).toHaveLength(1); // only the failed try
    expect(deps.household.jobCompleted('night-before', today)).toBe(true);
  });

  it('never re-sends once one may have gone out', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    deps.send = () => deferred<number>().promise; // the process dies with this send still going
    void runDueJobs(deps, schedule, at('17:00'));
    await new Promise(resolve => setImmediate(resolve));
    expect(sent).toHaveLength(1);
    await runDueJobs(deps, schedule, at('18:00'));
    expect(sent).toHaveLength(1);
  });

  it('follows the time set in Settings', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    saveNightBeforeTime(deps, '15:30');
    await runDueJobs(deps, schedule, at('15:29'));
    expect(sent).toEqual([]);
    await runDueJobs(deps, schedule, at('15:30'));
    expect(sent).toHaveLength(1);
  });

  it('with a setting moved later, the window moves too', async () => {
    const { deps, sent } = kitchen(cooks('beans'));
    saveNightBeforeTime(deps, '20:00');
    await runDueJobs(deps, schedule, at('19:00'));
    expect(sent).toEqual([]);
    await runDueJobs(deps, schedule, at('22:59'));
    expect(sent).toHaveLength(1);
  });
});

describe('the run through old recipes', () => {
  const house = () => {
    const deps = fakeDeps({ ai: true, recipes: [recipe('beans', [])] });
    deps.nightBeforeSteps = () => Promise.resolve([{ slug: 'beans', step: 'Soak the beans overnight' }]);
    return deps;
  };
  const job = (deps: ReturnType<typeof fakeDeps>) => deps.household.jobCompleted('night-before-backfill', 'once');

  it('happens once, ever', async () => {
    const deps = house();
    await runDueJobs(deps, schedule, at('12:00'));
    expect(deps.calls.nightBeforeSteps).toBe(1);
    expect(deps.recipes.get('beans')?.nightBefore).toBe('Soak the beans overnight');
    expect(job(deps)).toBe(true);
    await runDueJobs(deps, schedule, at('12:00', '2026-11-20'));
    expect(deps.calls.nightBeforeSteps).toBe(1);
  });

  it('waits for a key, and doesn’t count as done until it’s had one', async () => {
    const deps = fakeDeps({ ai: false, recipes: [recipe('beans', [])] });
    await runDueJobs(deps, schedule, at('12:00'));
    expect(deps.calls.nightBeforeSteps).toBe(0);
    expect(job(deps)).toBe(false);
  });

  it('counts as done only when it worked, and tries again an hour later', async () => {
    const deps = house();
    deps.nightBeforeSteps = () => Promise.reject(new Error('overloaded'));
    await runDueJobs(deps, schedule, at('12:00'));
    expect(job(deps)).toBe(false);
    expect(deps.logged.some(line => line.startsWith('night-before-backfill failed'))).toBe(true);

    deps.nightBeforeSteps = () => Promise.resolve([]);
    await runDueJobs(deps, schedule, at('12:59'));
    expect(deps.calls.nightBeforeSteps).toBe(1);
    await runDueJobs(deps, schedule, at('13:00'));
    expect(deps.calls.nightBeforeSteps).toBe(2);
    expect(job(deps)).toBe(true);
  });

  it('a failure in it doesn’t get in the way of the reminder', async () => {
    const deps = fakeDeps({ ai: true, recipes: [beans, recipe('toast', [], { meals: [] })] });
    deps.plan.upsert(cooks('beans'));
    deps.nightBeforeSteps = () => Promise.reject(new Error('overloaded'));
    await runDueJobs(deps, schedule, at('17:00'));
    expect(deps.calls.sends).toBe(1);
    expect(job(deps)).toBe(false);
  });
});
