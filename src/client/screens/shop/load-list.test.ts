import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadShoppingList } from './load-list.ts';

const WEEK = { shopDate: '2026-11-06', lines: [] };

type Answer = () => Promise<Response>;
const answer = (body: unknown, status = 200): Answer => () => Promise.resolve(new Response(JSON.stringify(body), { status }));

function server(read: Answer, opened: Answer) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`;
    calls.push(call);
    return call === 'POST /api/shopping/opened' ? opened() : read();
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('loading the Shop screen', () => {
  it('reads the list and says it was opened, once each', async () => {
    const calls = server(answer(WEEK), answer({ ok: true }));
    expect(await loadShoppingList()).toEqual(WEEK);
    expect(calls.sort()).toEqual(['GET /api/shopping', 'POST /api/shopping/opened']);
  });

  it('says so again on every load, so a list that changed is what gets recorded', async () => {
    const calls = server(answer(WEEK), answer({ ok: true }));
    await loadShoppingList();
    await loadShoppingList();
    expect(calls.filter(c => c.startsWith('POST'))).toHaveLength(2);
  });

  it('still shows the list when the note fails', async () => {
    server(answer(WEEK), answer({ error: 'disk full' }, 500));
    expect(await loadShoppingList()).toEqual(WEEK);
  });

  it('still shows the list when the note can’t get through', async () => {
    server(answer(WEEK), () => Promise.reject(new TypeError('offline')));
    expect(await loadShoppingList()).toEqual(WEEK);
  });

  it('doesn’t wait for the note', async () => {
    server(answer(WEEK), () => new Promise(() => undefined));
    expect(await loadShoppingList()).toEqual(WEEK);
  });

  it('reports a failed read, so the screen can retry', async () => {
    server(answer({ error: 'nope' }, 500), answer({ ok: true }));
    await expect(loadShoppingList()).rejects.toThrow('nope');
  });
});
