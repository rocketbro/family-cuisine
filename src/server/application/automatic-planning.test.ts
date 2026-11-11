import { describe, expect, it, vi } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { blankEntry } from '../../domain/plan.ts';
import { automaticPlanning, holdAutomaticPlanning, saveAutomaticPlanning } from './automatic-planning.ts';
import { clearUpcomingPlan } from './clear-plan.ts';
import { catchUpPlan } from './plan-catch-up.ts';
import { planToHorizon, planTrip } from './planning.ts';
import { moveTrip } from './shop-day.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

const TODAY = '2026-11-13'; // a Friday, in the window of Wednesday's trip
const house = () => fakeDeps({ ai: false, recipes: [recipe('soup', ['- 1 cup broth'], { meals: ['breakfast', 'lunch', 'dinner'] })] });

describe('clearing the plan', () => {
  it('holds automatic planning once something came off', () => {
    const deps = house();
    expect(clearUpcomingPlan(deps, TODAY)).toBe(0);
    expect(automaticPlanning(deps).held).toBe(false);
    deps.plan.upsert({ ...blankEntry(TODAY, 'dinner'), kind: 'note', note: 'Soup' });
    expect(clearUpcomingPlan(deps, TODAY)).toBe(1);
    expect(automaticPlanning(deps).held).toBe(true);
  });
});

describe('asking for a plan', () => {
  it('starts automatic planning again', async () => {
    for (const ask of [planToHorizon, (deps: ReturnType<typeof house>, today: string) => planTrip(deps, today, today)]) {
      const deps = house();
      holdAutomaticPlanning(deps);
      await ask(deps, TODAY);
      expect(automaticPlanning(deps).held).toBe(false);
    }
  });
});

describe('coming back after a restart', () => {
  it('plans an empty today through this trip', async () => {
    const deps = house();
    expect(await catchUpPlan(deps, TODAY)).toBeGreaterThan(0);
    expect(deps.plan.get('2026-11-17', 'dinner')).not.toBeNull();
    expect(deps.plan.get('2026-11-18', 'dinner')).toBeNull();
  });

  it('only reaches tomorrow when just the top-up is on', async () => {
    const deps = house();
    saveAutomaticPlanning(deps, { tripMorning: false, nightly: true, held: false });
    await catchUpPlan(deps, TODAY);
    expect(deps.plan.get('2026-11-14', 'dinner')).not.toBeNull();
    expect(deps.plan.get('2026-11-15', 'dinner')).toBeNull();
  });

  it('leaves a held or switched-off plan alone', async () => {
    for (const choice of [{ tripMorning: true, nightly: true, held: true }, { tripMorning: false, nightly: false, held: false }]) {
      const deps = house();
      saveAutomaticPlanning(deps, choice);
      expect(await catchUpPlan(deps, TODAY)).toBeNull();
      expect(deps.plan.get(TODAY, 'dinner')).toBeNull();
    }
  });
});

describe('changing the shopping day', () => {
  it('doesn’t refill a cleared plan', async () => {
    const deps = house();
    const plan = vi.spyOn(deps.plan, 'upsert');
    holdAutomaticPlanning(deps);
    await moveTrip(deps, TODAY, '2026-11-18', '2026-11-20');
    expect(plan).not.toHaveBeenCalled();
    expect(deps.plan.get(TODAY, 'dinner')).toBeNull();
  });
});
