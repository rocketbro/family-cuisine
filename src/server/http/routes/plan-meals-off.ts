import { Hono } from 'hono';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { dismissMealOff, putMealBack } from '../../application/meals-off.ts';
import { mealsOffView } from '../../application/meals-off-view.ts';
import { isoDate, slot } from '../schemas/common.ts';
import { param } from '../validate.ts';

export function planMealsOffRoutes(deps: Deps) {
  return new Hono()
    .get('/:date/meals-off', c => c.json(mealsOffView(deps, param(c.req.param('date'), isoDate), toISODate(new Date()))))
    .post('/:date/:slot/dismiss-meal-off', c => {
      dismissMealOff(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), slot));
      return c.json({ ok: true });
    })
    .post('/:date/:slot/put-back', c => {
      putMealBack(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), slot), toISODate(new Date()));
      return c.json({ ok: true });
    });
}
