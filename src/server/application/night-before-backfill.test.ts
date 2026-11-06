import { describe, expect, it } from 'vitest';
import { recipe } from '../../domain/test-fixtures.ts';
import { backfillNightBefore } from './night-before-backfill.ts';
import type { NightBeforeQuestion, SaidNightBefore } from './ports/ai.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';

const book = (count: number) => Array.from({ length: count }, (_, i) => recipe(`dish-${i}`, ['- 1 cup broth'], { body: '## Steps\n1. Cook.' }));

describe('backfillNightBefore', () => {
  it('adds a step only where the model says one is needed', async () => {
    const deps = fakeDeps({ recipes: [recipe('beans', []), recipe('toast', [])] });
    deps.nightBeforeSteps = () => Promise.resolve([{ slug: 'beans', step: 'Soak the beans overnight' }]);
    const result = await backfillNightBefore(deps);
    expect(result.added).toEqual([{ slug: 'beans', title: 'beans', step: 'Soak the beans overnight' }]);
    expect(deps.recipes.get('beans')?.nightBefore).toBe('Soak the beans overnight');
    expect(deps.recipes.get('toast')?.nightBefore).toBeNull();
  });

  it('does nothing at all with no key', async () => {
    const deps = fakeDeps({ ai: false, recipes: book(3) });
    expect(await backfillNightBefore(deps)).toEqual({ asked: 0, added: [] });
    expect(deps.calls.nightBeforeSteps).toBe(0);
  });

  it('never asks about a recipe that already has a step, or changes it', async () => {
    const deps = fakeDeps({ recipes: [recipe('mine', [], { nightBefore: 'Our own way' }), recipe('other', [])] });
    const asked: string[] = [];
    deps.nightBeforeSteps = (recipes: NightBeforeQuestion[]) => {
      asked.push(...recipes.map(r => r.slug));
      return Promise.resolve([{ slug: 'mine', step: 'Something else' }]);
    };
    await backfillNightBefore(deps);
    expect(asked).toEqual(['other']);
    expect(deps.recipes.get('mine')?.nightBefore).toBe('Our own way');
  });

  it('leaves a step someone set while the model was thinking', async () => {
    const deps = fakeDeps({ recipes: [recipe('beans', [])] });
    deps.nightBeforeSteps = () => {
      deps.recipes.addNightBefore('beans', 'Set by a person');
      return Promise.resolve([{ slug: 'beans', step: 'From the model' }]);
    };
    const { added } = await backfillNightBefore(deps);
    expect(added).toEqual([]);
    expect(deps.recipes.get('beans')?.nightBefore).toBe('Set by a person');
  });

  it('asks a modest number at a time, with a long method cut short', async () => {
    const long = recipe('long', [], { body: 'x'.repeat(20_000) });
    const deps = fakeDeps({ recipes: [long, ...book(30)] });
    const sizes: number[] = [];
    let longest = 0;
    deps.nightBeforeSteps = recipes => {
      sizes.push(recipes.length);
      longest = Math.max(longest, ...recipes.map(r => r.method.length));
      return Promise.resolve([]);
    };
    await backfillNightBefore(deps);
    expect(sizes).toEqual([15, 15, 1]);
    expect(longest).toBe(3000);
  });

  it('holds what comes back to what any step is, and to the recipes it asked about', async () => {
    const deps = fakeDeps({ recipes: [recipe('a', []), recipe('b', []), recipe('c', [])] });
    const said: SaidNightBefore[] = [
      { slug: 'a', step: 'See https://evil.example' },
      { slug: 'b', step: '[Soak](x)' },
      { slug: 'not-in-the-book', step: 'Soak the beans' },
      { slug: 'c', step: 'Soak the beans overnight.' },
    ];
    deps.nightBeforeSteps = () => Promise.resolve(said);
    const { added } = await backfillNightBefore(deps);
    expect(added.map(a => a.slug)).toEqual(['c']);
    expect(deps.recipes.get('a')?.nightBefore).toBeNull();
    expect(deps.recipes.get('b')?.nightBefore).toBeNull();
    expect(deps.recipes.get('c')?.nightBefore).toBe('Soak the beans overnight');
  });

  describe('when a batch fails', () => {
    const partly = (failing: () => boolean) => {
      const deps = fakeDeps({ recipes: book(40) });
      const asked: string[][] = [];
      deps.nightBeforeSteps = recipes => {
        asked.push(recipes.map(r => r.slug));
        return failing() ? Promise.reject(new Error('overloaded')) : Promise.resolve([]);
      };
      return { deps, asked };
    };

    it('counts as a failure, keeps what’s done, and goes on to the other batches', async () => {
      let call = 0;
      const { deps, asked } = partly(() => ++call === 1);
      await expect(backfillNightBefore(deps)).rejects.toThrow();
      expect(asked).toHaveLength(3);
    });

    it('gives up after a few failed runs, so it can’t spend forever', async () => {
      const deps = fakeDeps({ recipes: book(2) });
      deps.nightBeforeSteps = () => Promise.reject(new Error('overloaded'));
      for (let run = 0; run < 4; run++) await expect(backfillNightBefore(deps)).rejects.toThrow();
      await expect(backfillNightBefore(deps)).resolves.toMatchObject({ added: [] });
      expect(deps.household.setting('night_before_attempts')).toBeNull();
    });

    it('asks only about what’s left the next time', async () => {
      let call = 0;
      const { deps, asked } = partly(() => ++call === 1);
      await expect(backfillNightBefore(deps)).rejects.toThrow();
      const failedBatch = asked[0];
      asked.length = 0;
      await backfillNightBefore(deps);
      expect(asked).toEqual([failedBatch]);
    });

    it('clears its notes once it’s all gone through', async () => {
      let call = 0;
      const { deps } = partly(() => ++call === 1);
      await expect(backfillNightBefore(deps)).rejects.toThrow();
      expect(deps.household.setting('night_before_reviewed')).not.toBeNull();
      await backfillNightBefore(deps);
      expect(deps.household.setting('night_before_reviewed')).toBeNull();
    });

    it('doesn’t lose a step already written when a later batch fails', async () => {
      const deps = fakeDeps({ recipes: book(20) });
      let call = 0;
      deps.nightBeforeSteps = recipes => (++call === 2 ? Promise.reject(new Error('overloaded')) : Promise.resolve([{ slug: recipes[0].slug, step: 'Soak overnight' }]));
      await expect(backfillNightBefore(deps)).rejects.toThrow();
      expect(deps.recipes.get('dish-0')?.nightBefore).toBe('Soak overnight');
    });

    it('starts over cleanly from notes it can’t read', async () => {
      const deps = fakeDeps({ recipes: book(1) });
      deps.household.saveSetting('night_before_reviewed', 'not json');
      expect((await backfillNightBefore(deps)).asked).toBe(1);
    });
  });
});
