import { Hono } from 'hono';
import { z } from 'zod';
import { checkinView, confirmPlannedMeals, recordPantry } from '../../application/checkin.ts';
import type { Deps } from '../../application/deps.ts';
import { isoDate, planSlot } from '../schemas/common.ts';
import { body, param } from '../validate.ts';

export function checkinRoutes(deps: Deps) {
  return new Hono()
    .get('/:date', c => c.json(checkinView(deps, param(c.req.param('date'), isoDate))))
    .post('/:date/as-planned', c => {
      confirmPlannedMeals(deps, param(c.req.param('date'), isoDate));
      return c.json({ ok: true });
    })
    .post('/:date/pantry', async c => {
      const report = await body(c, z.object({
        counts: z.array(z.object({ pantryItemId: z.number(), used: z.number().min(0) })),
        needs: z.array(z.object({ pantryItemId: z.number(), answer: z.enum(['fine', 'low', 'out']) })),
        uses: z.array(z.object({ date: isoDate.optional(), slot: planSlot, pantryItemId: z.number(), answer: z.enum(['have', 'low', 'out', 'unused']) })).default([]),
      }));
      recordPantry(deps, param(c.req.param('date'), isoDate), report);
      return c.json({ ok: true });
    });
}
