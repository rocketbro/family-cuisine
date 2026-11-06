import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { confirmPlanImport, discardPlanImport, planImportView, retryPlanImport, startPlanImport } from '../../application/plan-import.ts';
import { isoDate, slot } from '../schemas/common.ts';
import { body, files, formText } from '../validate.ts';

const MOST_TEXT = 20_000;

const placements = z.object({ meals: z.array(z.object({
  date: isoDate,
  slot: z.union([slot, z.literal('extra')]),
  match: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('recipe'), slug: z.string().min(1), title: z.string() }),
    z.object({ kind: z.literal('named'), name: z.string().min(1).max(200) }),
    z.object({ kind: z.literal('leftovers') }),
  ]),
})).max(100) });

export function planImportRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(planImportView(deps)))
    .post('/', async c => {
      const photos = await files(c, 'photos');
      const text = (await formText(c, 'text'))?.slice(0, MOST_TEXT) ?? null;
      return c.json({ id: startPlanImport(deps, { text, photos: photos.map(p => p.data) }, toISODate(new Date())) });
    })
    .post('/retry', c => {
      retryPlanImport(deps, toISODate(new Date()));
      return c.json({ ok: true });
    })
    .post('/:id/confirm', async c => {
      confirmPlanImport(deps, c.req.param('id'), (await body(c, placements)).meals, toISODate(new Date()));
      return c.json({ ok: true });
    })
    .delete('/', c => {
      discardPlanImport(deps);
      return c.json({ ok: true });
    });
}
