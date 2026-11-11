// A real app, container and database with a meal on the plan, for tests of the list's requests.
import fs from 'node:fs';
import path from 'node:path';
import { blankEntry } from '../../../domain/plan.ts';
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { config } from '../../config.ts';
import { buildDeps } from '../../container.ts';
import { createApp } from '../../http/app.ts';

export const TODAY = '2026-11-03';
export const TRIP = '2026-11-04';
export const NEXT_TRIP = '2026-11-11';
const WEDNESDAY = 3;

/** `ingredients`: the lines of a recipe that's on the plan for the trip's day. */
export function shoppingHouse(dir: string, ingredients: string[] = []) {
  const dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const deps = buildDeps({
    ...config, dataDir, dbPath: path.join(dataDir, 'cuisine.db'), recipesDir: path.join(dataDir, 'recipes'), imagesDir: path.join(dataDir, 'images'), tmpDir: path.join(dataDir, 'tmp'),
    anthropicApiKey: null, unsplashAccessKey: null, vapidPublicKey: null, vapidPrivateKey: null, shopWeekday: WEDNESDAY,
    aldiPriceLookup: false, walmartProductLookup: false,
  }, () => undefined);
  fs.writeFileSync(path.join(dataDir, 'recipes', 'stew.md'), `---\ntitle: Stew\nmeals: [dinner]\n---\n\n## Ingredients\n\n${ingredients.map(i => `- ${i}`).join('\n')}\n`);
  deps.plan.upsert({ ...blankEntry(TRIP, 'dinner'), kind: 'recipe', recipeSlug: 'stew' });

  const app = createApp(deps, { clientDir: dir, trust: { hostnames: new Set(['localhost']), publicOrigin: 'http://localhost' }, accessToken: null });
  const send = (url: string, method: string, body?: unknown) => app.request(`/api/shopping${url}`, {
    method, headers: { host: 'localhost', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const read = async () => (await send('', 'GET')).json() as Promise<ShoppingWeek>;
  return {
    deps, send, read,
    names: async () => (await read()).lines.map(l => l.name),
    line: async (name: string) => (await read()).lines.find(l => l.name === name),
    have: (key: string) => send('/lines/have', 'POST', { key }),
    skip: (key: string, skipped = true) => send('/lines/skipped', 'PUT', { key, skipped }),
    add: (name: string) => send('/lines', 'POST', { name }),
    tick: (key: string, checked = true, trip = TRIP) => send('/ticks', 'PUT', { trip, key, checked }),
    bought: (lines: unknown[], token = 'put-away-1', stock: unknown[] = []) => send('/bought', 'POST', { lines, stock, token }),
    price: (pantryItemId: number | null, name: string, cents: number) => send('/price', 'PUT', { line: { pantryItemId, name }, store: 'aldi', cents }),
  };
}
