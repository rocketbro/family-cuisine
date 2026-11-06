import { describe, expect, it } from 'vitest';
import { rotationPlan } from './rotation-planner.ts';
import { beforeGroceries, planHorizonEnd, type ShopSchedule } from './shop-schedule.ts';
import { recipe } from './test-fixtures.ts';

const WED: ShopSchedule = { weekday: 3, moved: {} };

describe('planning', () => {
  it('reaches through the week after the next Wednesday trip', () => {
    expect(planHorizonEnd('2026-11-01', WED)).toBe('2026-11-10'); // Sunday → Tuesday after next
    expect(planHorizonEnd('2026-11-04', WED)).toBe('2026-11-10'); // shopping day itself
  });
  it('rotates, doubles batch dinners and turns them into the next lunch', () => {
    const recipes = [
      recipe('soup', [], { batch: true }), recipe('tacos', []),
      recipe('pancakes', [], { meals: ['breakfast'] }), recipe('eggs', [], { meals: ['breakfast'] }),
      recipe('pbj', [], { meals: ['lunch'], kind: 'simple' }),
    ];
    const plan = rotationPlan({ dates: ['2026-11-01', '2026-11-02', '2026-11-03'], recipes, existing: [] });
    const at = (date: string, slot: string) => plan.find(e => e.date === date && e.slot === slot)!;
    expect(at('2026-11-01', 'dinner')).toMatchObject({ recipeSlug: 'soup', multiplier: 2 });
    expect(at('2026-11-02', 'lunch')).toMatchObject({ kind: 'leftovers', leftoversOf: { date: '2026-11-01', slot: 'dinner' } });
    expect(at('2026-11-02', 'dinner').recipeSlug).toBe('tacos');
    expect(at('2026-11-01', 'breakfast').recipeSlug).not.toBe(at('2026-11-02', 'breakfast').recipeSlug);
    expect(at('2026-11-01', 'lunch').recipeSlug).toBe('pbj');
  });
});

describe('planning before the groceries come', () => {
  it('needs a full pantry until shopping day, then not', () => {
    // Tuesday Nov 3; shopping is Wednesday (3).
    expect(beforeGroceries('2026-11-03', '2026-11-03', WED)).toBe(true);
    expect(beforeGroceries('2026-11-04', '2026-11-03', WED)).toBe(false);
    // On shopping day itself, only today is held to the pantry.
    expect(beforeGroceries('2026-11-05', '2026-11-04', WED)).toBe(false);
  });
  it('rotates only through what can be cooked', () => {
    const recipes = [
      { slug: 'soup', meals: ['dinner' as const], kind: 'recipe' as const, batch: true, serves: 4 },
      { slug: 'tacos', meals: ['dinner' as const], kind: 'recipe' as const, batch: false, serves: 4 },
    ];
    const plan = rotationPlan({ dates: ['2026-11-03'], recipes, existing: [], canCook: r => r.slug === 'tacos' });
    expect(plan.find(e => e.slot === 'dinner')?.recipeSlug).toBe('tacos');
  });
  it('only doubles a batch dinner when the pantry covers the double', () => {
    const recipes = [{ slug: 'soup', meals: ['dinner' as const], kind: 'recipe' as const, batch: true, serves: 4 }];
    const plan = rotationPlan({ dates: ['2026-11-03', '2026-11-04'], recipes, existing: [], canCook: (_r, _d, m) => m <= 1 });
    expect(plan.find(e => e.slot === 'dinner')?.multiplier).toBe(1);
    expect(plan.some(e => e.kind === 'leftovers')).toBe(false);
  });
});
