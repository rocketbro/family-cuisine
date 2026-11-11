import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import { sayNotAsPlanned } from '../../application/checkin-catch-up.ts';
import { markMeal } from '../../application/checkin-meal.ts';
import { mealQuestions, settleMeal } from '../../application/meal-checkin.ts';
import { sayAnyLeft } from '../../application/dinner-left.ts';
import { checkinView, confirmPlannedMeals, recordPantry } from '../../application/checkin.ts';
import type { Deps } from '../../application/deps.ts';
import { isoDate, planSlot } from '../schemas/common.ts';
import { body, param } from '../validate.ts';

const mealMark = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('made') }),
  z.object({ outcome: z.literal('skipped') }),
  z.object({ outcome: z.literal('other'), name: z.string().trim().min(1).max(80) }),
]);

const pantryReport = z.object({
  counts: z.array(z.object({ pantryItemId: z.number(), used: z.number().min(0) })),
  needs: z.array(z.object({ pantryItemId: z.number(), answer: z.enum(['fine', 'low', 'out']) })),
  uses: z.array(z.object({ date: isoDate.optional(), slot: planSlot, pantryItemId: z.number(), answer: z.enum(['have', 'low', 'out', 'unused']) })).default([]),
});

export function checkinRoutes(deps: Deps) {
  return new Hono()
    .get('/:date', c => c.json(checkinView(deps, param(c.req.param('date'), isoDate))))
    .post('/:date/as-planned', c => {
      confirmPlannedMeals(deps, param(c.req.param('date'), isoDate));
      return c.json({ ok: true });
    })
    .post('/:date/not-as-planned', c => {
      sayNotAsPlanned(deps, param(c.req.param('date'), isoDate), toISODate(new Date()));
      return c.json({ ok: true });
    })
    .put('/:date/any-left', async c => {
      const { answer } = await body(c, z.object({ answer: z.enum(['some', 'none']) }));
      sayAnyLeft(deps, param(c.req.param('date'), isoDate), answer, toISODate(new Date()));
      return c.json({ ok: true });
    })
    .put('/:date/:slot', async c => {
      markMeal(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), planSlot), await body(c, mealMark));
      return c.json({ ok: true });
    })
    .get('/:date/:slot/questions', c => c.json(mealQuestions(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), planSlot))))
    .post('/:date/:slot/pantry', async c => {
      settleMeal(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), planSlot), await body(c, pantryReport));
      return c.json({ ok: true });
    })
    .post('/:date/pantry', async c => {
      recordPantry(deps, param(c.req.param('date'), isoDate), await body(c, pantryReport));
      return c.json({ ok: true });
    });
}
