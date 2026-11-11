// The receipt review through the whole app: what a phone sends, and what comes back.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { receiptLine, transactionalFakes, TRIP, tripLine } from '../../application/test-support/transactional-fakes.ts';
import { createApp } from '../app.ts';

const trust = { hostnames: new Set(['localhost']), publicOrigin: null };
const headers = { host: 'localhost' };
const post = (body: unknown) => ({ method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const ERASER = 'Mr. Clean Magic Eraser Original, 4 Count';

let clientDir: string;
beforeEach(() => {
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-client-'));
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html>');
});
afterEach(() => fs.rmSync(clientDir, { recursive: true, force: true }));

function reviewing() {
  const f = transactionalFakes();
  const app = createApp(f.deps, { clientDir, trust, accessToken: null });
  return { f, app };
}

describe('/api/receipts and /api/never-add', () => {
  it('saves a never-add, leaves it off the next receipt, lists it, and forgets it', async () => {
    const { f, app } = reviewing();
    const first = f.addReceipt({ lines: [receiptLine('milk'), receiptLine('Magic Eraser', { printed: ERASER })] });
    const saved = await app.request(`/api/receipts/${first}/apply`, post({ kept: [{ index: 0, name: 'milk' }], neverAdd: [{ index: 1, name: 'Magic Eraser' }] }));
    expect(saved.status).toBe(200);

    const next = f.addReceipt({ lines: [receiptLine('Magic Eraser', { printed: ERASER })] });
    const view = await (await app.request(`/api/receipts/${next}`, { headers })).json() as { leftOut: number[] };
    expect(view.leftOut).toEqual([0]);

    const list = await (await app.request('/api/never-add', { headers })).json() as { id: number; name: string }[];
    expect(list).toEqual([{ id: 1, printed: ERASER, name: 'Magic Eraser' }]);
    await app.request(`/api/never-add/${list[0].id}`, { method: 'DELETE', headers });
    expect(await (await app.request('/api/never-add', { headers })).json()).toEqual([]);
  });

  it('says plainly when there’s no key to change a receipt by talking', async () => {
    const { f, app } = reviewing();
    f.deps.ai.available = () => false;
    const id = f.addReceipt({ lines: [receiptLine('sponges')] });
    const response = await app.request(`/api/receipts/${id}/revise`, post({ said: 'never the sponges', rows: [] }));
    expect(response.status).toBe(503);
    expect((await response.json() as { error: string }).error).toMatch(/Anthropic API key/);
  });

  it('answers a revision with the rows held to what a tap could do', async () => {
    const { f, app } = reviewing();
    const milk = f.addItem('milk');
    const id = f.addReceipt({ lines: [receiptLine('sponges'), receiptLine('milk', { pantryItemId: milk.id })] });
    f.deps.ai.reviseReceipt = () => Promise.resolve({
      understood: true, note: 'Done.', recipe: null,
      lines: [0, 1].map(index => ({ index, name: index ? 'milk' : 'sponges', included: false, neverAdd: true, insteadOf: null, always: false })),
    });
    const row = (index: number, name: string) => ({ index, name, included: true, neverAdd: false, leftOut: false, insteadOf: null, always: false });
    const response = await app.request(`/api/receipts/${id}/revise`, post({ said: 'never track either', rows: [row(0, 'sponges'), row(1, 'milk')] }));
    const { rows } = await response.json() as { rows: { neverAdd: boolean; included: boolean }[] };
    expect(rows.map(r => [r.included, r.neverAdd])).toEqual([[false, true], [false, false]]);
    expect(f.receipt(id)?.status).toBe('ready');
  });

  it('saves a line bought instead of a list line', async () => {
    const { f, app } = reviewing();
    const jasmine = f.addItem('jasmine rice', { status: 'out' });
    f.deps.receipts.saveTripList(TRIP, [tripLine(jasmine.id, 'jasmine rice')]);
    const id = f.addReceipt({ lines: [receiptLine('basmati rice')] });
    const saved = await app.request(`/api/receipts/${id}/apply`, post({ kept: [{ index: 0, name: 'basmati rice' }], substitutes: [{ index: 0, listKey: `p${jasmine.id}`, always: true }] }));
    expect(saved.status).toBe(200);
    expect(f.deps.pantry.findByName('basmati rice')?.alsoCalled).toEqual(['jasmine rice']);
    const view = await (await app.request(`/api/receipts/${id}`, { headers })).json() as { diff: { skipped: unknown[] } };
    expect(view.diff.skipped).toEqual([]);
  });

  it('still takes a save from a phone that only sends what it kept', async () => {
    const { f, app } = reviewing();
    const id = f.addReceipt({ lines: [receiptLine('milk')] });
    expect((await app.request(`/api/receipts/${id}/apply`, post({ kept: [{ index: 0, name: 'milk' }] }))).status).toBe(200);
    expect(f.receipt(id)?.status).toBe('applied');
  });
});
