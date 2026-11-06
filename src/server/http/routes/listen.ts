// The dictation bar's two calls: "here's what I said" (words, already transcribed) and "yes,
// save those changes". Recordings themselves go through routes/recordings.ts.
import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { applyProposal, listen } from '../../application/listen.ts';
import { listenContext } from '../schemas/listen.ts';
import { mealUpdate } from '../schemas/meals.ts';
import { proposedChange } from '../schemas/pantry.ts';
import { body } from '../validate.ts';

export function listenRoutes(deps: Deps) {
  return new Hono()
    .post('/', async c => {
      const { text, context } = await body(c, z.object({ text: z.string().max(100_000), context: listenContext }));
      return c.json(await listen(deps, { text, context, today: toISODate(new Date()) }));
    })
    .post('/apply', async c => {
      const proposal = await body(c, z.object({ pantry: z.array(proposedChange), meals: z.array(mealUpdate), context: listenContext }));
      applyProposal(deps, proposal);
      return c.json({ ok: true });
    });
}
