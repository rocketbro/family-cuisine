import { Hono } from 'hono';
import { z } from 'zod';
import { avoidMeal } from '../../application/claudes-picks.ts';
import type { Deps } from '../../application/deps.ts';
import { body } from '../validate.ts';

export function avoidedMealRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(deps.avoided.list()))
    .post('/', async c => {
      const { title, reason, slug } = await body(c, z.object({ title: z.string().trim().min(1).max(200), reason: z.string().max(1000).nullable(), slug: z.string().nullable() }));
      avoidMeal(deps, title, reason, slug);
      return c.json({ ok: true });
    })
    .delete('/:id', c => {
      deps.avoided.remove(Number(c.req.param('id')));
      return c.json({ ok: true });
    });
}
