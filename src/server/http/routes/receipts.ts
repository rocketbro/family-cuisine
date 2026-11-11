import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { addReceipt, applyReceipt, dismissSuggestion, receiptFile, receiptView, removeReceipt, retryReceipt, savePricesOnly, tripsView } from '../../application/receipts.ts';
import { reviseReceipt } from '../../application/receipt-revise.ts';
import { receiptChoices, receiptRevision } from '../schemas/receipts.ts';
import { body, files } from '../validate.ts';

export function receiptRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(tripsView(deps)))
    .post('/', async c => c.json({ id: addReceipt(deps, await files(c, 'files'), toISODate(new Date())) }))
    .post('/suggestions/dismiss', async c => {
      const { key } = await body(c, z.object({ key: z.string().min(1).max(100) }));
      dismissSuggestion(deps, key);
      return c.json({ ok: true });
    })
    .get('/:id', c => {
      const view = receiptView(deps, Number(c.req.param('id')));
      if (!view) throw new HTTPException(404, { message: 'That receipt is gone.' });
      return c.json(view);
    })
    .get('/:id/files/:index', c => {
      const file = receiptFile(deps, Number(c.req.param('id')), Number(c.req.param('index')));
      if (!file) return c.notFound();
      return c.body(new Uint8Array(file.data), 200, { 'Content-Type': file.type });
    })
    .post('/:id/retry', c => {
      retryReceipt(deps, Number(c.req.param('id')), toISODate(new Date()));
      return c.json({ ok: true });
    })
    .post('/:id/revise', async c => c.json(await reviseReceipt(deps, Number(c.req.param('id')), await body(c, receiptRevision))))
    .post('/:id/apply', async c => {
      const { kept, pricesOnly, ...decisions } = await body(c, receiptChoices);
      (pricesOnly ? savePricesOnly : applyReceipt)(deps, Number(c.req.param('id')), kept, decisions);
      return c.json({ ok: true });
    })
    .delete('/:id', c => {
      removeReceipt(deps, Number(c.req.param('id')));
      return c.json({ ok: true });
    });
}
