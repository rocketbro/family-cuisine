// Through the whole app: what a phone or curl sends, and what comes back.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recipe } from '../../../domain/test-fixtures.ts';
import type { Deps } from '../../application/deps.ts';
import { fakeDeps } from '../../application/test-support/full-deps-fake.ts';
import { createApp } from '../app.ts';

const trust = { hostnames: new Set(['localhost']), publicOrigin: null };
const headers = { host: 'localhost' };
const settle = () => new Promise(resolve => setImmediate(resolve));

let clientDir: string;
beforeEach(() => {
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-client-'));
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html>');
});
afterEach(() => fs.rmSync(clientDir, { recursive: true, force: true }));

const inTwoWeeks = (() => {
  const d = new Date(Date.now() + 14 * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function appWith(deps: Deps) {
  deps.ai.readMealPlan = () => Promise.resolve([{ said: 'tacos tues', weekday: 'Tuesday', date: null, slot: 'dinner', kind: 'named', recipeSlug: null, name: 'Tacos', confidence: 'likely' }]);
  return createApp(deps, { clientDir, trust, accessToken: null });
}

function send(text: string) {
  const form = new FormData();
  form.append('text', text);
  return { method: 'POST', headers, body: form };
}

const confirm = (meals: unknown[]) => ({ method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ meals }) });

describe('/api/plan-import', () => {
  it('says plainly when there is no key', async () => {
    const app = appWith(fakeDeps({ ai: false }));
    const response = await app.request('/api/plan-import', send('tacos'));
    expect(response.status).toBe(503);
    expect((await response.json() as { error: string }).error).toMatch(/Anthropic API key/);
  });

  it('reads words in the background, then saves what comes back confirmed', async () => {
    const deps = fakeDeps({ recipes: [recipe('soup', ['1 can broth'])] });
    const app = appWith(deps);
    const { id } = await (await app.request('/api/plan-import', send('tacos Tues'))).json() as { id: string };
    await settle();
    const view = await (await app.request('/api/plan-import', { headers })).json() as { status: string; meals: unknown[] };
    expect(view.status).toBe('ready');
    expect(view.meals).toHaveLength(1);

    const saved = await app.request(`/api/plan-import/${id}/confirm`, confirm([
      { date: inTwoWeeks, slot: 'dinner', match: { kind: 'named', name: 'Tacos' } },
      { date: inTwoWeeks, slot: 'lunch', match: { kind: 'leftovers' } },
      { date: inTwoWeeks, slot: 'extra', match: { kind: 'recipe', slug: 'soup', title: 'Soup' } },
    ]));
    expect(saved.status).toBe(200);
    expect(deps.plan.range(inTwoWeeks, inTwoWeeks)).toHaveLength(3);
    expect(await (await app.request('/api/plan-import', { headers })).json()).toMatchObject({ status: 'saved', saved: 3 });
  });

  it('refuses a slot that isn’t one, or a made-up recipe, and saves nothing', async () => {
    const deps = fakeDeps();
    const app = appWith(deps);
    const { id } = await (await app.request('/api/plan-import', send('tacos'))).json() as { id: string };
    await settle();
    const badSlot = await app.request(`/api/plan-import/${id}/confirm`, confirm([{ date: inTwoWeeks, slot: 'brunch', match: { kind: 'named', name: 'x' } }]));
    expect(badSlot.status).toBe(400);
    const madeUp = await app.request(`/api/plan-import/${id}/confirm`, confirm([{ date: inTwoWeeks, slot: 'dinner', match: { kind: 'recipe', slug: 'nope', title: 'Nope' } }]));
    expect(madeUp.status).toBe(404);
    expect(deps.plan.range(inTwoWeeks, inTwoWeeks)).toEqual([]);
    expect((await (await app.request('/api/plan-import', { headers })).json() as { status: string }).status).toBe('ready');
  });

  it('can be dropped', async () => {
    const app = appWith(fakeDeps());
    await app.request('/api/plan-import', send('tacos'));
    await settle();
    await app.request('/api/plan-import', { method: 'DELETE', headers });
    expect(await (await app.request('/api/plan-import', { headers })).json()).toEqual({ status: 'none' });
  });
});
