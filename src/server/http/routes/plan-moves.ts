import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { moveMeal } from '../../application/move-meal.ts';
import { putBackMeal } from '../../application/put-back-meal.ts';
import { isoDate, slot } from '../schemas/common.ts';
import { cameOffMove } from '../schemas/meals.ts';
import { body, param } from '../validate.ts';

export function planMoveRoutes(deps: Deps) {
  return new Hono()
    .post('/came-off', async c => {
      const { meal, to } = await body(c, cameOffMove);
      return c.json({ ok: true, cameOff: putBackMeal(deps, meal, to, toISODate(new Date())) });
    })
    .post('/:date/:slot/move', async c => {
      const { to } = await body(c, z.object({ to: isoDate }));
      moveMeal(deps, { date: param(c.req.param('date'), isoDate), slot: param(c.req.param('slot'), slot) }, to, toISODate(new Date()));
      return c.json({ ok: true });
    });
}
