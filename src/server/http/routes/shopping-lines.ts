import { Hono } from 'hono';
import { z } from 'zod';
import { realDateOrNull, toISODate, type ISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { addOneOff, lineInHouse, skipLine } from '../../application/trip-edits.ts';
import { setTick } from '../../application/trip-ticks.ts';
import { body } from '../validate.ts';

const key = z.string().min(1).max(200);

export function shoppingLineRoutes(deps: Deps) {
  return new Hono()
    .put('/ticks', async c => {
      const tick = await body(c, z.object({ trip: z.string().refine(d => realDateOrNull(d) !== null), key, checked: z.boolean() }));
      return c.json(setTick(deps, toISODate(new Date()), tick.trip as ISODate, tick.key, tick.checked));
    })
    .post('/lines/have', async c => {
      const line = await body(c, z.object({ key }));
      lineInHouse(deps, toISODate(new Date()), line.key);
      return c.json({ ok: true });
    })
    .put('/lines/skipped', async c => {
      const line = await body(c, z.object({ key, skipped: z.boolean() }));
      skipLine(deps, toISODate(new Date()), line.key, line.skipped);
      return c.json({ ok: true });
    })
    .post('/lines', async c => {
      const { name } = await body(c, z.object({ name: z.string().min(1).max(80) }));
      return c.json(addOneOff(deps, toISODate(new Date()), name));
    });
}
