import { Hono } from 'hono';
import { z } from 'zod';
import { isExtraSlot, type ExtraSlot } from '../../../domain/plan-slot.ts';
import type { Deps } from '../../application/deps.ts';
import { addExtra, changeExtra, removeExtra } from '../../application/plan-extras.ts';
import { isoDate } from '../schemas/common.ts';
import { body, param } from '../validate.ts';

const extra = z.custom<ExtraSlot>(value => typeof value === 'string' && isExtraSlot(value));

const extraChoice = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recipe'), recipeSlug: z.string(), multiplier: z.number().positive().max(10).optional() }),
  z.object({ kind: z.literal('note'), note: z.string().max(200) }),
]);

/** Adding and taking off. Done, batch size and cooking go through the plan's own routes, like any meal. */
export function planExtraRoutes(deps: Deps) {
  return new Hono()
    .post('/:date/extras', async c => c.json({ slot: addExtra(deps, param(c.req.param('date'), isoDate), await body(c, extraChoice)) }))
    .put('/:date/extras/:slot', async c => {
      changeExtra(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), extra), await body(c, extraChoice));
      return c.json({ ok: true });
    })
    .delete('/:date/extras/:slot', c => {
      removeExtra(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), extra));
      return c.json({ ok: true });
    });
}
