import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pantryItem } from '../../domain/test-fixtures.ts';
import { deferred, fakeDeps } from './test-support/full-deps-fake.ts';
import { learnWalmartPacks } from './walmart-packs.ts';

const AN_HOUR = 60 * 60 * 1000;

function house(productName: () => Promise<string | null>) {
  const asked = vi.fn(productName);
  const deps = fakeDeps({ pantry: [pantryItem(1, 'eggs', { walmartItemId: '123456' })] });
  deps.walmartProducts = { productName: asked };
  return { deps, asked };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('learning Walmart package sizes', () => {
  it('waits an hour after Walmart stops answering, then picks up again', async () => {
    const { deps, asked } = house(() => Promise.reject(new Error('blocked')));
    await learnWalmartPacks(deps);
    expect(asked).toHaveBeenCalledTimes(1);

    await learnWalmartPacks(deps);
    vi.setSystemTime(Date.now() + AN_HOUR - 1);
    await learnWalmartPacks(deps);
    expect(asked).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 1);
    await learnWalmartPacks(deps);
    expect(asked).toHaveBeenCalledTimes(2);
  });

  it('runs one sweep at a time', async () => {
    const answer = deferred<string | null>();
    const { deps, asked } = house(() => answer.promise);
    const first = learnWalmartPacks(deps);
    await learnWalmartPacks(deps);
    expect(asked).toHaveBeenCalledOnce();
    answer.reject(new Error('blocked'));
    await first;
  });

  it('keeps each server’s waiting to itself', async () => {
    const blocked = house(() => Promise.reject(new Error('blocked')));
    await learnWalmartPacks(blocked.deps);
    const other = house(() => Promise.reject(new Error('blocked')));
    await learnWalmartPacks(other.deps);
    expect(other.asked).toHaveBeenCalledOnce();
  });
});
