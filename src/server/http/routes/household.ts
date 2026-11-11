// Household settings that live on the server (not per phone): who's eating, the shopping day and
// the ZIP code.
import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { householdView, saveHouseholdProfile } from '../../application/household-profile.ts';
import { kitchenNotes, setKitchenNotes } from '../../application/kitchen-notes.ts';
import { saveAutomaticPlanning } from '../../application/automatic-planning.ts';
import { saveNightBeforeTime } from '../../application/night-before-time.ts';
import { setStockUpList, stockUpList } from '../../application/stock-up.ts';
import { parseUnit } from '../../../domain/units.ts';
import { moveTrip } from '../../application/shop-day.ts';
import { setStoreZip } from '../../application/store-location.ts';
import { isoDate, storage } from '../schemas/common.ts';
import { body } from '../validate.ts';

export function householdRoutes(deps: Deps) {
  return new Hono()
    .get('/profile', c => c.json(householdView(deps)))
    .put('/profile', async c => {
      const profile = await body(c, z.object({
        family: z.string().max(1000),
        portions: z.number().int().min(1).max(24),
        dinnerTime: z.string().trim().min(1).max(30),
        members: z.array(z.string().max(60)).max(12),
      }));
      saveHouseholdProfile(deps, profile);
      return c.json({ ok: true });
    })
    .get('/kitchen-notes', c => c.json({ notes: kitchenNotes(deps) ?? '' }))
    .put('/kitchen-notes', async c => {
      const { notes } = await body(c, z.object({ notes: z.string().max(5000) }));
      setKitchenNotes(deps, notes);
      return c.json({ ok: true });
    })
    .get('/stock-up', c => c.json(stockUpList(deps)))
    .put('/stock-up', async c => {
      const { goals } = await body(c, z.object({ goals: z.array(z.object({
        pantryItemId: z.number().int().positive(),
        amount: z.number().positive(),
        unit: z.string().nullable().refine(unit => unit === null || parseUnit(unit) !== null).transform(unit => (unit === null ? null : parseUnit(unit))),
        storage,
      })) }));
      setStockUpList(deps, goals);
      return c.json({ ok: true });
    })
    .put('/night-before-time', async c => {
      const { time } = await body(c, z.object({ time: z.string().max(5) }));
      saveNightBeforeTime(deps, time);
      return c.json({ ok: true });
    })
    .put('/automatic-planning', async c => {
      saveAutomaticPlanning(deps, await body(c, z.object({ tripMorning: z.boolean(), nightly: z.boolean(), held: z.boolean() })));
      return c.json({ ok: true });
    })
    .put('/zip', async c => {
      const { zip } = await body(c, z.object({ zip: z.string().max(10).nullable() }));
      return c.json({ location: await setStoreZip(deps, zip) });
    })
    .put('/trip', async c => {
      const { from, to } = await body(c, z.object({ from: isoDate, to: isoDate }));
      await moveTrip(deps, toISODate(new Date()), from, to);
      return c.json({ ok: true });
    });
}
