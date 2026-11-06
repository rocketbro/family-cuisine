import { describe, expect, it } from 'vitest';
import type { StockGoalInput } from '../../../../shared/api-types.ts';
import { movedGoal, withGoal, withoutGoal } from './goal-list.ts';

const goal = (pantryItemId: number, amount = 1): StockGoalInput => ({ pantryItemId, amount, unit: 'lb', storage: 'frozen' });
const ids = (list: StockGoalInput[]) => list.map(g => g.pantryItemId);

describe('changing the stock-up list', () => {
  it('adds a new goal to the bottom', () => {
    expect(ids(withGoal([goal(1), goal(2)], goal(3)))).toEqual([1, 2, 3]);
  });
  it('changes an existing goal in its place', () => {
    const list = withGoal([goal(1), goal(2)], goal(1, 9));
    expect(ids(list)).toEqual([1, 2]);
    expect(list[0].amount).toBe(9);
  });
  it('takes a goal off', () => {
    expect(ids(withoutGoal([goal(1), goal(2)], 1))).toEqual([2]);
  });
  it('moves a goal up or down, and not off the ends', () => {
    const list = [goal(1), goal(2), goal(3)];
    expect(ids(movedGoal(list, 2, -1))).toEqual([2, 1, 3]);
    expect(ids(movedGoal(list, 2, 1))).toEqual([1, 3, 2]);
    expect(ids(movedGoal(list, 1, -1))).toEqual([1, 2, 3]);
    expect(ids(movedGoal(list, 3, 1))).toEqual([1, 2, 3]);
  });
});
