import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Deps } from '../../application/deps.ts';
import { retryReceipt } from '../../application/receipts.ts';
import { fileReceiptStore } from './file-receipt-store.ts';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-heic-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

it('keeps a HEIC receipt off macOS and says plainly what to do instead', async () => {
  const store = fileReceiptStore(dir, 'linux');
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(32)]);
  const saved = store.save(heic);
  expect(saved.type).toBe('image/heic');
  await expect(store.forModel(saved)).rejects.toThrow(/can’t read HEIC.*screenshot or a JPEG/);
  expect(store.read(saved)).toEqual(heic);
});

it('shows that message on the receipt, not the generic one', async () => {
  const store = fileReceiptStore(dir, 'linux');
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(32)]);
  const saved = store.save(heic);
  const update = vi.fn();
  const deps = {
    receiptFiles: store,
    receipts: { get: () => ({ files: [saved] }), update },
    log: () => undefined,
  } as unknown as Deps;
  retryReceipt(deps, 1, '2026-01-01');
  await vi.waitFor(() => expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'failed', error: expect.stringContaining('HEIC') })));
});
