import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import { FRIDGE_TEXT_MAX } from '../../../domain/fridge.ts';
import type { Deps } from '../../application/deps.ts';
import { addFridgeLine, fridgeLines, usedUpFridgeLine } from '../../application/fridge.ts';
import { body } from '../validate.ts';

export function fridgeRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(fridgeLines(deps, toISODate(new Date()))))
    .post('/', async c => {
      const { text } = await body(c, z.object({ text: z.string().max(FRIDGE_TEXT_MAX * 4) }));
      addFridgeLine(deps, text, toISODate(new Date()));
      return c.json(fridgeLines(deps, toISODate(new Date())));
    })
    .delete('/:id', c => {
      usedUpFridgeLine(deps, c.req.param('id'));
      return c.json({ ok: true });
    });
}
