import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankEntry } from '../../domain/plan.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { runDueJobs, type Schedule } from './jobs.ts';
import { keepPlanCookable } from './keep-plan-cookable.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

// A Thursday, the day after a shopping trip with nothing on its list.
const TODAY = '2026-11-12';
const SATURDAY = '2026-11-14';
const schedule: Schedule = { planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 19, minute: 45 } };
const at = (time: string, date = TODAY) => new Date(`${date}T${time}:00`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at('03:00'));
});
afterEach(() => void vi.useRealTimers());

function withMealOnPlan() {
  const deps = fakeDeps({ ai: false, recipes: [recipe('tacos', ['- tortillas'], { title: 'Tacos' })], pantry: [pantryItem(1, 'tortillas', { status: 'out' })] });
  const messages: Parameters<typeof deps.notifier.send>[0][] = [];
  const send = deps.notifier.send;
  deps.notifier.send = message => { messages.push(message); return send(message); };
  deps.plan.upsert({ ...blankEntry(SATURDAY, 'dinner'), kind: 'recipe', recipeSlug: 'tacos' });
  return { deps, messages };
}

describe('the notice about meals that came off', () => {
  it('takes the meal off at 3 AM, and says so only at the plan time, once', async () => {
    const { deps, messages } = withMealOnPlan();
    await runDueJobs(deps, schedule, at('03:00'));
    expect(deps.plan.get(SATURDAY, 'dinner')?.recipeSlug).not.toBe('tacos');
    expect(messages).toEqual([]);
    await runDueJobs(deps, schedule, at('07:59'));
    expect(messages).toEqual([]);

    await runDueJobs(deps, schedule, at('08:00'));
    expect(messages).toEqual([{ title: 'Saturday’s Tacos came off', body: 'No tortillas. Tap to put it back.', url: `/day/${SATURDAY}` }]);
    await runDueJobs(deps, schedule, at('08:01'));
    await runDueJobs(deps, schedule, at('08:00', '2026-11-13'));
    expect(messages).toHaveLength(1);
  });

  it('stays quiet with nothing off', async () => {
    const { deps, messages } = withMealOnPlan();
    deps.pantry.update(1, { status: 'have' });
    await runDueJobs(deps, schedule, at('08:00'));
    expect(messages).toEqual([]);
  });

  it('stays quiet past the morning, and tells the next morning if the day’s still ahead', async () => {
    const { deps, messages } = withMealOnPlan();
    keepPlanCookable(deps, TODAY);
    await runDueJobs(deps, schedule, at('12:00'));
    expect(messages).toEqual([]);
    await runDueJobs(deps, schedule, at('08:00', '2026-11-13'));
    expect(messages).toHaveLength(1);
  });

  it('holds what comes off after the morning’s notice for the next one', async () => {
    const { deps, messages } = withMealOnPlan();
    keepPlanCookable(deps, TODAY);
    await runDueJobs(deps, schedule, at('08:00'));
    expect(messages).toHaveLength(1);

    deps.plan.upsert({ ...blankEntry(SATURDAY, 'lunch'), kind: 'recipe', recipeSlug: 'tacos' });
    keepPlanCookable(deps, TODAY);
    await runDueJobs(deps, schedule, at('08:30'));
    expect(messages).toHaveLength(1);
    await runDueJobs(deps, schedule, at('08:00', '2026-11-13'));
    expect(messages).toHaveLength(2);
    expect(messages[1].title).toBe('Saturday’s Tacos came off');
  });

  it('says nothing about a meal someone has since dealt with', async () => {
    const { deps, messages } = withMealOnPlan();
    keepPlanCookable(deps, TODAY);
    deps.plan.upsert({ ...blankEntry(SATURDAY, 'dinner'), kind: 'note', note: 'Pizza', pinned: true });
    await runDueJobs(deps, schedule, at('08:00'));
    expect(messages).toEqual([]);
  });

  it('tries again when no phone could be reached', async () => {
    const { deps, messages } = withMealOnPlan();
    keepPlanCookable(deps, TODAY);
    deps.send = async () => 0;
    await runDueJobs(deps, schedule, at('08:00'));
    expect(messages).toHaveLength(1);
    deps.send = async () => 1;
    await runDueJobs(deps, schedule, at('08:06'));
    expect(messages).toHaveLength(2);
    await runDueJobs(deps, schedule, at('08:00', '2026-11-13'));
    expect(messages).toHaveLength(2);
  });
});
