// Through the whole app: what the Clear the plan button sends, and what comes back.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, toISODate } from '../../../domain/dates.ts';
import { blankEntry } from '../../../domain/plan.ts';
import { fakeDeps } from '../../application/test-support/full-deps-fake.ts';
import { createApp } from '../app.ts';

const headers = { host: 'localhost' };
const today = toISODate(new Date());

let clientDir: string;
beforeEach(() => {
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-client-'));
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html>');
});
afterEach(() => fs.rmSync(clientDir, { recursive: true, force: true }));

describe('/api/plan/upcoming', () => {
  it('counts, clears and says how many, keeping what happened', async () => {
    const deps = fakeDeps();
    const app = createApp(deps, { clientDir, trust: { hostnames: new Set(['localhost']), publicOrigin: null }, accessToken: null });
    deps.plan.upsert(blankEntry(addDays(today, -1), 'dinner'));
    deps.plan.upsert({ ...blankEntry(today, 'lunch'), outcome: 'made' });
    deps.plan.upsert(blankEntry(today, 'dinner'));
    deps.plan.addExtra(blankEntry(addDays(today, 1), 'extra-1'));

    expect(await (await app.request('/api/plan/upcoming', { headers })).json()).toEqual({ meals: 2 });
    expect(await (await app.request('/api/plan/upcoming', { method: 'DELETE', headers })).json()).toEqual({ removed: 2 });
    expect(await (await app.request('/api/plan/upcoming', { headers })).json()).toEqual({ meals: 0 });
    expect(deps.plan.range(addDays(today, -1), addDays(today, 1)).map(entry => entry.slot)).toEqual(['dinner', 'lunch']);
  });
});
