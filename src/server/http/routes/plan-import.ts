import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { revisePlanImport } from '../../application/plan-import-revise.ts';
import { confirmPlanImport, discardPlanImport, fillAfterPlanImport, planImportView, retryPlanImport, startPlanImport } from '../../application/plan-import.ts';
import { isoDate, slot } from '../schemas/common.ts';
import { body, files, formText } from '../validate.ts';

const MOST_TEXT = 20_000;

const match = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recipe'), slug: z.string().min(1), title: z.string() }),
  z.object({ kind: z.literal('named'), name: z.string().min(1).max(200) }),
  z.object({ kind: z.literal('leftovers') }),
]);
const importSlot = z.union([slot, z.literal('extra')]);

const placements = z.object({ meals: z.array(z.object({ date: isoDate, slot: importSlot, match })).max(100) });

const revision = z.object({
  said: z.string().max(5000),
  onDate: isoDate.nullable(),
  meals: z.array(z.object({
    said: z.string().max(500), date: isoDate.nullable(), slot: importSlot, match,
    confidence: z.enum(['sure', 'likely', 'unsure']),
  })).max(100),
});

export function planImportRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(planImportView(deps)))
    .post('/', async c => {
      const photos = await files(c, 'photos');
      const text = (await formText(c, 'text'))?.slice(0, MOST_TEXT) ?? null;
      const from = await formText(c, 'from');
      const through = await formText(c, 'through');
      const claudesIdeas = await formText(c, 'claudesIdeas') !== 'off';
      return c.json({ id: startPlanImport(deps, { text, photos: photos.map(p => p.data), from, through, claudesIdeas }, toISODate(new Date())) });
    })
    .post('/retry', c => {
      retryPlanImport(deps, toISODate(new Date()));
      return c.json({ ok: true });
    })
    .post('/:id/confirm', async c => {
      confirmPlanImport(deps, c.req.param('id'), (await body(c, placements)).meals, toISODate(new Date()));
      return c.json({ ok: true });
    })
    .post('/:id/revise', async c => {
      const input = await body(c, revision);
      return c.json(await revisePlanImport(deps, c.req.param('id'), input, toISODate(new Date())));
    })
    .post('/fill', async c => c.json({ added: await fillAfterPlanImport(deps, toISODate(new Date())) }))
    .delete('/', c => {
      discardPlanImport(deps);
      return c.json({ ok: true });
    });
}
