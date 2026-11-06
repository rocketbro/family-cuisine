import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { whenLookupFinishes } from './lookup-poll.ts';

const FIVE_SECONDS = 5000;
type Lookup = ShoppingWeek['aldiLookup'];
const says = (aldiLookup: Lookup) => Promise.resolve({ aldiLookup });

beforeEach(() => void vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('waiting for an Aldi lookup the screen opened during', () => {
  it('reloads once a read says it finished, and stops asking', async () => {
    const read = vi.fn(() => says('running')).mockImplementationOnce(() => says('running')).mockImplementationOnce(() => says('done'));
    const finished = vi.fn();
    whenLookupFinishes(read, finished);
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    expect(finished).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    expect(finished).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS * 10);
    expect(read).toHaveBeenCalledTimes(2);
    expect(finished).toHaveBeenCalledOnce();
  });

  it.each<Lookup>(['done', 'due', 'off', 'disabled'])('counts %s as finished', async state => {
    const finished = vi.fn();
    whenLookupFinishes(() => says(state), finished);
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    expect(finished).toHaveBeenCalledOnce();
  });

  it('stops when the screen goes away', async () => {
    const read = vi.fn(() => says('running'));
    const finished = vi.fn();
    const stop = whenLookupFinishes(read, finished);
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    stop();
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS * 10);
    expect(read).toHaveBeenCalledOnce();
    expect(finished).not.toHaveBeenCalled();
  });

  it('ignores an answer that arrives after the screen went away', async () => {
    let answer!: (week: { aldiLookup: Lookup }) => void;
    const finished = vi.fn();
    const stop = whenLookupFinishes(() => new Promise(resolve => { answer = resolve; }), finished);
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    stop();
    answer({ aldiLookup: 'done' });
    await vi.advanceTimersByTimeAsync(0);
    expect(finished).not.toHaveBeenCalled();
  });

  it('gives up after a while if the lookup never finishes', async () => {
    const read = vi.fn(() => says('running'));
    const finished = vi.fn();
    whenLookupFinishes(read, finished);
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS * 1000);
    expect(read).toHaveBeenCalledTimes(60);
    expect(finished).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps asking after a failed read', async () => {
    const read = vi.fn(() => says('done')).mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const finished = vi.fn();
    whenLookupFinishes(read, finished);
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    expect(finished).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS);
    expect(finished).toHaveBeenCalledOnce();
  });

  it('only reads while it waits: polling never tells the server the list was opened', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      return Promise.resolve(new Response(JSON.stringify({ aldiLookup: 'running' })));
    });
    whenLookupFinishes(api.shopping, () => undefined);
    await vi.advanceTimersByTimeAsync(FIVE_SECONDS * 3);
    expect(calls).toEqual(['GET /api/shopping', 'GET /api/shopping', 'GET /api/shopping']);
  });
});
