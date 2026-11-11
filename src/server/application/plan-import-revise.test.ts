import { describe, expect, it, vi } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { keepPlanImport } from './plan-import-record.ts';
import { revisePlanImport } from './plan-import-revise.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

const TODAY = '2026-11-06';
const CHILI = { said: 'Sat - chili', date: '2026-11-07', slot: 'dinner' as const, match: { kind: 'named' as const, name: 'Chili' }, confidence: 'sure' as const };
const ANSWER = { said: 'Sat - chili', date: '2026-11-08', slot: 'dinner' as const, kind: 'named' as const, recipeSlug: null, name: 'Chili', confidence: 'sure' as const };

function reviewing(claudesIdeas = true) {
  const deps = fakeDeps({ recipes: [recipe('soup', ['- 1 cup broth']), recipe('pick', ['- 1 egg'], { claudesPick: true })] });
  deps.ai = { ...deps.ai, available: () => true, revisePlan: vi.fn().mockResolvedValue({ understood: true, note: 'Moved chili to Sunday.', meals: [ANSWER] }) };
  keepPlanImport(deps, { id: 'a', createdAt: '', text: null, hadPhotos: true, range: { from: '2026-11-07', through: '2026-11-16' }, claudesIdeas, status: 'ready', meals: [CHILI] });
  return deps;
}
const input = { said: 'move the chili to Sunday', onDate: '2026-11-07', meals: [CHILI] };

describe('telling Claude what to change in a plan', () => {
  it('gives back the plan as changed, with the note, and saves nothing', async () => {
    const deps = reviewing();
    const before = deps.household.setting('plan_import');
    const revised = await revisePlanImport(deps, 'a', input, TODAY);
    expect(revised.note).toBe('Moved chili to Sunday.');
    expect(revised.meals.map(meal => meal.date)).toEqual(['2026-11-08']);
    expect(deps.household.setting('plan_import')).toBe(before);
    expect(deps.plan.range('2026-11-07', '2026-11-16')).toEqual([]);
  });

  it('tells the model the day on screen and the plan as it stands', async () => {
    const deps = reviewing();
    await revisePlanImport(deps, 'a', input, TODAY);
    expect(deps.ai.revisePlan).toHaveBeenCalledWith(expect.objectContaining({ onDate: '2026-11-07', meals: [expect.objectContaining({ kind: 'named', name: 'Chili', date: '2026-11-07' })] }));
  });

  it('keeps a recipe the model made up from getting through', async () => {
    const deps = reviewing();
    deps.ai.revisePlan = vi.fn().mockResolvedValue({ understood: true, note: '', meals: [{ ...ANSWER, kind: 'recipe', recipeSlug: 'nope', name: null }] });
    const { meals } = await revisePlanImport(deps, 'a', input, TODAY);
    expect(meals[0].match.kind).toBe('named');
    expect(meals[0].confidence).toBe('unsure');
  });

  it('holds to the plan’s choice about Claude’s ideas', async () => {
    const deps = reviewing(false);
    await revisePlanImport(deps, 'a', input, TODAY);
    const { recipes } = (deps.ai.revisePlan as ReturnType<typeof vi.fn>).mock.calls[0][0] as { recipes: { slug: string }[] };
    expect(recipes.map(r => r.slug)).toEqual(['soup']);
  });

  it('says so when Claude couldn’t tell, and refuses a plan that’s moved on', async () => {
    const deps = reviewing();
    deps.ai.revisePlan = vi.fn().mockResolvedValue({ understood: false, note: 'Which chili?', meals: [] });
    await expect(revisePlanImport(deps, 'a', input, TODAY)).rejects.toThrow('Which chili?');
    await expect(revisePlanImport(deps, 'b', input, TODAY)).rejects.toThrow('newer one');
  });
});
