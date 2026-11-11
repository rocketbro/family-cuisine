import { describe, expect, it } from 'vitest';
import { checkedAction, type SaidAction } from './tidy-actions.ts';
import { checkedQuestions, digestOf, type SaidQuestion } from './tidy-questions.ts';
import type { Candidate } from './tidy-types.ts';

const said = (action: Partial<SaidAction> & { kind: string }): SaidAction => ({
  keep: null, remove: null, itemId: null, status: null, count: null, name: null, newName: null, alsoCalled: null, date: null, slot: null, ...action,
});

const duplicates: Candidate = {
  fingerprint: 'duplicate:1:2', kind: 'duplicate_items', evidence: ['two items'], allowed: ['merge_items', 'add_other_name'],
  scope: { items: [{ id: 1, name: 'rolled oats' }, { id: 2, name: 'Old-fashioned rolled oats' }], entries: [], statuses: [], names: ['rolled oats', 'Old-fashioned rolled oats'] },
};
const useBy: Candidate = {
  fingerprint: 'use-by:5:2026-11-01', kind: 'stale_use_by', evidence: ['old date'], allowed: ['clear_use_by', 'set_status'],
  scope: { items: [{ id: 5, name: 'Yogurt' }], entries: [], statuses: ['out'], names: [] },
};
const leftovers: Candidate = {
  fingerprint: 'leftovers:2026-11-13:lunch', kind: 'unconfirmed_leftovers', evidence: ['planned'], allowed: ['remove_plan_entry'],
  scope: { items: [], entries: [{ date: '2026-11-13', slot: 'lunch' }], statuses: [], names: [] },
};

describe('checking an action against its candidate', () => {
  it('accepts a merge of the candidate’s own items, with only listed names', () => {
    const action = checkedAction(said({ kind: 'merge_items', keep: 1, remove: 2, newName: 'Rolled Oats', alsoCalled: ['oatmeal', 'rolled oats'] }), duplicates);
    expect(action).toEqual({ kind: 'merge_items', keep: 1, remove: 2, newName: 'rolled oats', alsoCalled: ['rolled oats'] });
  });

  it('refuses ids that are not the candidate’s, or a merge of an item into itself', () => {
    expect(checkedAction(said({ kind: 'merge_items', keep: 1, remove: 99 }), duplicates)).toBeNull();
    expect(checkedAction(said({ kind: 'merge_items', keep: 1, remove: 1 }), duplicates)).toBeNull();
    expect(checkedAction(said({ kind: 'add_other_name', itemId: 7, name: 'rolled oats' }), duplicates)).toBeNull();
  });

  it('refuses an action the candidate does not allow, and one that is not on the menu', () => {
    expect(checkedAction(said({ kind: 'set_count', itemId: 1, count: 3 }), duplicates)).toBeNull();
    expect(checkedAction(said({ kind: 'delete_everything' }), duplicates)).toBeNull();
  });

  it('refuses a name the candidate did not list', () => {
    expect(checkedAction(said({ kind: 'add_other_name', itemId: 1, name: 'something else' }), duplicates)).toBeNull();
    expect(checkedAction(said({ kind: 'add_other_name', itemId: 1, name: 'OLD-FASHIONED ROLLED OATS' }), duplicates))
      .toEqual({ kind: 'add_other_name', itemId: 1, name: 'Old-fashioned rolled oats' });
  });

  it('allows only the statuses listed', () => {
    expect(checkedAction(said({ kind: 'set_status', itemId: 5, status: 'out' }), useBy)).toEqual({ kind: 'set_status', itemId: 5, status: 'out' });
    expect(checkedAction(said({ kind: 'set_status', itemId: 5, status: 'have' }), useBy)).toBeNull();
    expect(checkedAction(said({ kind: 'clear_use_by', itemId: 5 }), useBy)).toEqual({ kind: 'clear_use_by', itemId: 5 });
  });

  it('allows a count only as a whole number in range', () => {
    const counted: Candidate = { ...useBy, allowed: ['set_count'] };
    expect(checkedAction(said({ kind: 'set_count', itemId: 5, count: 12 }), counted)).toEqual({ kind: 'set_count', itemId: 5, count: 12 });
    for (const count of [-1, 2.5, 5000]) expect(checkedAction(said({ kind: 'set_count', itemId: 5, count }), counted)).toBeNull();
  });

  it('allows removing only the entry the candidate names', () => {
    expect(checkedAction(said({ kind: 'remove_plan_entry', date: '2026-11-13', slot: 'lunch' }), leftovers)).toEqual({ kind: 'remove_plan_entry', date: '2026-11-13', slot: 'lunch' });
    expect(checkedAction(said({ kind: 'remove_plan_entry', date: '2026-11-13', slot: 'dinner' }), leftovers)).toBeNull();
  });
});

describe('checking what Claude said', () => {
  const candidates = [duplicates, useBy, leftovers];
  const answer = (label: string, action: SaidAction | null) => ({ label, action });
  const question = (candidate: string, text = 'Same thing?', answers = [answer('Yes', said({ kind: 'clear_use_by', itemId: 5 })), answer('Leave it', null)]): SaidQuestion => ({ candidate, question: text, answers });

  it('gives the digest short ids and everything an action may name', () => {
    const [first] = digestOf(candidates);
    expect(first).toMatchObject({ id: 'c1', about: 'duplicate_items', allowed: ['merge_items', 'add_other_name'], names: ['rolled oats', 'Old-fashioned rolled oats'] });
  });

  it('keeps a question with a real action, remembers its fingerprint and when it was asked', () => {
    const [kept] = checkedQuestions([question('c2')], candidates, '2026-11-12');
    expect(kept).toEqual({
      fingerprint: useBy.fingerprint, question: 'Same thing?', askedOn: '2026-11-12',
      answers: [{ label: 'Yes', action: { kind: 'clear_use_by', itemId: 5 } }, { label: 'Leave it', action: null }],
    });
  });

  it('drops invalid answers, and a question left with nothing to do', () => {
    const bad = answer('Merge', said({ kind: 'merge_items', keep: 1, remove: 2 }));
    expect(checkedQuestions([question('c2', 'Old?', [bad, answer('No', null)])], candidates, '2026-11-12')).toEqual([]);
    const [kept] = checkedQuestions([question('c2', 'Old?', [bad, answer('Clear it', said({ kind: 'clear_use_by', itemId: 5 }))])], candidates, '2026-11-12');
    expect(kept.answers.map(a => a.label)).toEqual(['Clear it']);
  });

  it('drops unknown candidates, repeats, empty text, and more than the limit', () => {
    const asked = [question('c9'), question('x'), question('c2', '  '), question('c2'), question('c2', 'Again?'), question('c3', 'Remove?', [answer('Remove', said({ kind: 'remove_plan_entry', date: '2026-11-13', slot: 'lunch' }))])];
    expect(checkedQuestions(asked, candidates, '2026-11-12').map(q => q.fingerprint)).toEqual([useBy.fingerprint, leftovers.fingerprint]);
    expect(checkedQuestions(asked, candidates, '2026-11-12', 1)).toHaveLength(1);
  });

  it('keeps text to one plain line and three answers', () => {
    const many = Array.from({ length: 5 }, (_, i) => answer(`Option ${i}`, i ? null : said({ kind: 'clear_use_by', itemId: 5 })));
    const [kept] = checkedQuestions([question('c2', `Line one\nline   two ${'x'.repeat(300)}`, many)], candidates, '2026-11-12');
    expect(kept.question).not.toContain('\n');
    expect(kept.question.length).toBeLessThanOrEqual(160);
    expect(kept.answers).toHaveLength(3);
  });
});
