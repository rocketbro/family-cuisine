import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaidAction } from '../../domain/tidy-actions.ts';
import type { SaidQuestion } from '../../domain/tidy-questions.ts';
import { blankEntry } from '../../domain/plan.ts';
import { pantryItem, recipe } from '../../domain/test-fixtures.ts';
import { runDueJobs, type Schedule } from './jobs.ts';
import { fakeDeps } from './test-support/full-deps-fake.ts';
import { answerTidyQuestion, leaveTidyQuestion, tidyUpView } from './tidy-up-cards.ts';
import { lookAtTidyUp, runTidyUp } from './tidy-up.ts';

const TODAY = '2026-11-12';
const schedule: Schedule = { planTime: { hour: 8, minute: 0 }, checkinTime: { hour: 19, minute: 45 } };
const at = (time: string, date = TODAY) => new Date(`${date}T${time}:00`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at('04:30'));
});
afterEach(() => void vi.useRealTimers());

const said = (action: Partial<SaidAction> & { kind: string }): SaidAction => ({
  keep: null, remove: null, itemId: null, status: null, count: null, name: null, newName: null, alsoCalled: null, date: null, slot: null, ...action,
});

/** A stale date on yogurt, two oat items that may be one, and a plan entry for a recipe that is gone. */
function household(opts: { ai: boolean }) {
  const deps = fakeDeps({
    ai: opts.ai,
    recipes: [recipe('soup', [])],
    pantry: [
      pantryItem(1, 'Yogurt', { useBy: '2026-10-20' }),
      pantryItem(2, 'rolled oats'), pantryItem(3, 'Old-fashioned rolled oats'),
      pantryItem(4, 'Jam', { alsoCalled: ['jam', 'preserves'] }),
    ],
  });
  deps.plan.upsert({ ...blankEntry('2026-11-14', 'dinner'), kind: 'recipe', recipeSlug: 'deleted' });
  return deps;
}

const askAboutYogurt = (): SaidQuestion[] => [{
  candidate: 'c2', question: 'Is the yogurt still good?',
  answers: [{ label: 'Clear the date', action: said({ kind: 'clear_use_by', itemId: 1 }) }, { label: 'It’s gone', action: said({ kind: 'set_status', itemId: 1, status: 'out' }) }, { label: 'Leave it', action: null }],
}];

describe('the code layer', () => {
  it('fixes what has one right answer and logs it, with no key and no call to Claude', async () => {
    const deps = household({ ai: false });
    await runTidyUp(deps, TODAY, TODAY);
    expect(deps.plan.get('2026-11-14', 'dinner')).toBeNull();
    expect(deps.pantry.get(4)?.alsoCalled).toEqual(['preserves']);
    const { last, cards } = tidyUpView(deps, TODAY);
    expect(last?.fixed).toHaveLength(2);
    expect(last?.askedClaude).toBe(false);
    expect(cards).toEqual([]);
    expect(deps.calls.tidyUp).toBe(0);
  });

  it('changes nothing in a dry look, and shows what it would do and ask', async () => {
    const deps = household({ ai: true });
    deps.tidyUp = () => Promise.resolve(askAboutYogurt());
    const looked = await lookAtTidyUp(deps, TODAY);
    expect(looked.fixes).toHaveLength(2);
    expect(looked.questions).toHaveLength(1);
    expect(deps.plan.get('2026-11-14', 'dinner')).not.toBeNull();
    expect(tidyUpView(deps, TODAY)).toEqual({ cards: [], last: null });
  });
});

describe('asking Claude', () => {
  it('puts the questions that check out on Today, and drops the ones that do not', async () => {
    const deps = household({ ai: true });
    let digest: Parameters<typeof deps.tidyUp>[0] | null = null;
    deps.tidyUp = d => {
      digest = d;
      return Promise.resolve([
        ...askAboutYogurt(),
        { candidate: 'c1', question: 'Same oats?', answers: [{ label: 'Merge', action: said({ kind: 'merge_items', keep: 2, remove: 77 }) }] },
        { candidate: 'c99', question: 'Nothing here', answers: [{ label: 'Ok', action: said({ kind: 'clear_use_by', itemId: 1 }) }] },
      ]);
    };
    await runTidyUp(deps, TODAY, TODAY);
    expect(deps.calls.tidyUp).toBe(1);
    expect(digest!.candidates.map(c => c.about)).toEqual(['duplicate_items', 'stale_use_by']);
    const { cards, last } = tidyUpView(deps, TODAY);
    expect(cards.map(c => ({ question: c.question, answers: c.answers }))).toEqual([{ question: 'Is the yogurt still good?', answers: ['Clear the date', 'It’s gone', 'Leave it'] }]);
    expect(last).toMatchObject({ asked: 1, askedClaude: true });
    expect(last?.fixed).toHaveLength(2);
  });

  it('never asks the same thing again, whether it was answered, left or passed over', async () => {
    const deps = household({ ai: true });
    deps.tidyUp = () => Promise.resolve(askAboutYogurt());
    await runTidyUp(deps, TODAY, TODAY);
    leaveTidyQuestion(deps, tidyUpView(deps, TODAY).cards[0].id);

    const digests: number[] = [];
    deps.tidyUp = d => { digests.push(d.candidates.length); return Promise.resolve(askAboutYogurt()); };
    await runTidyUp(deps, '2026-11-15', '2026-11-15');
    // The oats were passed over last time, so they rest for a while too: nothing is left to ask about.
    expect(digests).toEqual([]);
    expect(tidyUpView(deps, '2026-11-15').cards).toEqual([]);
  });

  it('holds a question until it is answered rather than asking it twice, and keeps to three waiting', async () => {
    const deps = household({ ai: true });
    for (let id = 10; id < 16; id++) deps.pantry.create({ name: `Item ${id}`, count: 60 + id });
    deps.pantry.list().filter(p => p.id >= 1000).forEach((p, i) => Object.assign(p, { id: 100 + i, count: 60 + i }));
    deps.tidyUp = d => Promise.resolve(d.candidates.map(c => ({
      candidate: c.id, question: `About ${c.id}?`, answers: [{ label: 'Fix', action: c.about === 'odd_count' ? said({ kind: 'set_count', itemId: c.items[0].id, count: 12 }) : said({ kind: 'clear_use_by', itemId: c.items[0]?.id ?? null }) }],
    })));
    await runTidyUp(deps, TODAY, TODAY);
    expect(tidyUpView(deps, TODAY).cards.length).toBe(3);
    await runTidyUp(deps, '2026-11-15', '2026-11-15');
    expect(tidyUpView(deps, '2026-11-15').cards.length).toBe(3);
  });

  it('retries without asking twice: a failure leaves the fixes logged once', async () => {
    const deps = household({ ai: true });
    deps.tidyUp = () => Promise.reject(new Error('overloaded'));
    await expect(runTidyUp(deps, TODAY, TODAY)).rejects.toThrow('overloaded');
    deps.tidyUp = () => Promise.resolve(askAboutYogurt());
    await runTidyUp(deps, TODAY, TODAY);
    const { last, cards } = tidyUpView(deps, TODAY);
    expect(last?.fixed).toHaveLength(2);
    expect(cards).toHaveLength(1);
  });
});

describe('answering a card', () => {
  async function withCard() {
    const deps = household({ ai: true });
    deps.tidyUp = () => Promise.resolve(askAboutYogurt());
    await runTidyUp(deps, TODAY, TODAY);
    return { deps, id: tidyUpView(deps, TODAY).cards[0].id };
  }

  it('applies the action the answer is mapped to, and the card is gone', async () => {
    const { deps, id } = await withCard();
    answerTidyQuestion(deps, id, 1);
    expect(deps.pantry.get(1)).toMatchObject({ status: 'out', useBy: null });
    expect(tidyUpView(deps, TODAY).cards).toEqual([]);
  });

  it('leaves everything as it is for a null answer or the ×', async () => {
    const first = await withCard();
    answerTidyQuestion(first.deps, first.id, 2);
    expect(first.deps.pantry.get(1)?.useBy).toBe('2026-10-20');
    expect(tidyUpView(first.deps, TODAY).cards).toEqual([]);
    const second = await withCard();
    leaveTidyQuestion(second.deps, second.id);
    expect(second.deps.pantry.get(1)?.useBy).toBe('2026-10-20');
  });

  it('refuses an answer that is not there, and a card dealt with already', async () => {
    const { deps, id } = await withCard();
    expect(() => answerTidyQuestion(deps, id, 9)).toThrow('answers');
    expect(() => answerTidyQuestion(deps, id, 0)).toThrow('already been dealt with');
  });

  it('folds two items into one through the pantry’s own rules', async () => {
    const deps = household({ ai: true });
    deps.tidyUp = d => Promise.resolve([{
      candidate: d.candidates[0].id, question: 'Are these the same oats?',
      answers: [{ label: 'Same', action: said({ kind: 'merge_items', keep: 2, remove: 3, alsoCalled: ['Old-fashioned rolled oats'] }) }],
    }]);
    await runTidyUp(deps, TODAY, TODAY);
    answerTidyQuestion(deps, tidyUpView(deps, TODAY).cards[0].id, 0);
    expect(deps.pantry.get(3)).toBeNull();
    expect(deps.pantry.get(2)?.alsoCalled).toEqual(['Old-fashioned rolled oats']);
  });
});

describe('the job', () => {
  it('runs once in a period, at night, with no notification', async () => {
    const deps = household({ ai: true });
    await runDueJobs(deps, schedule, at('03:00'));
    expect(deps.calls.tidyUp).toBe(0);
    await runDueJobs(deps, schedule, at('04:00'));
    await runDueJobs(deps, schedule, at('04:20'));
    expect(deps.calls.tidyUp).toBe(1);
    expect(deps.calls.sends).toBe(0);
    await runDueJobs(deps, schedule, at('05:00', '2026-11-13'));
    await runDueJobs(deps, schedule, at('05:00', '2026-11-14'));
    // The third day of the same period never runs again; the next period does, if there is anything new to ask.
    expect(tidyUpView(deps, TODAY).last?.on).toBeDefined();
  });

  it('does nothing after the household is up', async () => {
    const deps = household({ ai: false });
    await runDueJobs(deps, schedule, at('06:00'));
    expect(deps.plan.get('2026-11-14', 'dinner')).not.toBeNull();
  });
});
