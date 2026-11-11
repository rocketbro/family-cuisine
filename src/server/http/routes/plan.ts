import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { clearUpcomingPlan, upcomingPlanCount } from '../../application/clear-plan.ts';
import { setMealDone, setMultiplier } from '../../application/meal-updates.ts';
import { planView } from '../../application/plan-view.ts';
import { setMeal } from '../../application/set-meal.ts';
import { writeUpNote } from '../../application/write-up-note.ts';
import { planToHorizon, planTrip } from '../../application/planning.ts';
import { rollMeal } from '../../application/pantry-meal.ts';
import { applySwaps, previewSwaps, saveMoneyView } from '../../application/save-money.ts';
import { isoDate, planSlot, slot } from '../schemas/common.ts';
import { chosenSwaps, mealChoice } from '../schemas/meals.ts';
import { body, param } from '../validate.ts';
import { planExtraRoutes } from './plan-extras.ts';
import { planMoveRoutes } from './plan-moves.ts';
import { planMealsOffRoutes } from './plan-meals-off.ts';

export function planRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(planView(deps, param(c.req.query('from'), isoDate), param(c.req.query('to'), isoDate))))
    .get('/upcoming', c => c.json({ meals: upcomingPlanCount(deps, toISODate(new Date())) }))
    .delete('/upcoming', c => c.json({ removed: clearUpcomingPlan(deps, toISODate(new Date())) }))
    .get('/save-money', c => c.json(saveMoneyView(deps)))
    .post('/save-money/preview', async c => c.json(previewSwaps(deps, (await body(c, chosenSwaps)).swaps)))
    .post('/save-money', async c => {
      await applySwaps(deps, (await body(c, chosenSwaps)).swaps);
      return c.json({ ok: true });
    })
    .route('/', planExtraRoutes(deps))
    .route('/', planMoveRoutes(deps))
    .route('/', planMealsOffRoutes(deps))
    .put('/:date/:slot', async c => {
      const cameOff = await setMeal(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), slot), await body(c, mealChoice));
      return c.json({ ok: true, cameOff });
    })
    .put('/:date/:slot/done', async c => {
      const { done } = await body(c, z.object({ done: z.boolean() }));
      setMealDone(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), planSlot), done);
      return c.json({ ok: true });
    })
    .post('/:date/:slot/write-up', async c => {
      await writeUpNote(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), planSlot));
      return c.json({ ok: true });
    })
    .post('/:date/:slot/roll', async c => {
      const { notThese } = await body(c, z.object({ notThese: z.array(z.string()).max(20) }));
      return c.json(await rollMeal(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), slot), notThese));
    })
    .patch('/:date/:slot/multiplier', async c => {
      const { multiplier } = await body(c, z.object({ multiplier: z.number().positive().max(10) }));
      setMultiplier(deps, param(c.req.param('date'), isoDate), param(c.req.param('slot'), planSlot), multiplier);
      return c.json({ ok: true });
    })
    .post('/fill', async c => c.json({ added: (await planToHorizon(deps, toISODate(new Date()))).added }))
    .post('/fill-trip', async c => {
      const { date } = await body(c, z.object({ date: isoDate }));
      return c.json({ added: (await planTrip(deps, toISODate(new Date()), date)).added });
    });
}
