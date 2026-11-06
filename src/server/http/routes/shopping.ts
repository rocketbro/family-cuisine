import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { setTripBudget } from '../../application/budget.ts';
import { setFinds, setStockPackages } from '../../application/trip-plan.ts';
import { noteListOpened } from '../../application/list-opened.ts';
import { chooseStore, markBought, shoppingWeek } from '../../application/shopping.ts';
import { refreshAldiPrices } from '../../application/aldi-lookup.ts';
import { setPrice, setWalmartProduct } from '../../application/shopping-prices.ts';
import { forgetSentToCart, noteSentToCart } from '../../application/walmart-cart.ts';
import { store } from '../schemas/common.ts';
import { body } from '../validate.ts';

const lineRef = z.object({ pantryItemId: z.number().nullable(), name: z.string().min(1) });

export function shoppingRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(shoppingWeek(deps, toISODate(new Date()))))
    .post('/opened', c => {
      noteListOpened(deps, toISODate(new Date()));
      return c.json({ ok: true });
    })
    .put('/store', async c => {
      const choice = await body(c, z.object({ store }));
      chooseStore(deps, toISODate(new Date()), choice.store);
      return c.json({ ok: true });
    })
    .post('/bought', async c => {
      const { lines, stock, token } = await body(c, z.object({
        lines: z.array(z.object({ pantryItemId: z.number().nullable(), name: z.string(), quantity: z.number().nullable() })),
        stock: z.array(z.object({ pantryItemId: z.number(), packages: z.number().int().min(1) })).default([]),
        token: z.string().min(8).max(100).optional(),
      }));
      markBought(deps, lines, toISODate(new Date()), stock, token ?? null);
      return c.json({ ok: true });
    })
    .put('/price', async c => {
      const price = await body(c, z.object({ line: lineRef, store, cents: z.number().int().min(0).max(1_000_000).nullable() }));
      setPrice(deps, price.line, price.store, price.cents);
      return c.json({ ok: true });
    })
    .post('/prices/refresh', async c => c.json({ found: await refreshAldiPrices(deps, toISODate(new Date())) }))
    .put('/budget', async c => {
      const { cents } = await body(c, z.object({ cents: z.number().int().min(0).max(10_000_000).nullable() }));
      setTripBudget(deps, cents);
      return c.json({ ok: true });
    })
    .put('/finds', async c => {
      const { cents } = await body(c, z.object({ cents: z.number().int().min(0).max(10_000_000) }));
      setFinds(deps, toISODate(new Date()), cents);
      return c.json({ ok: true });
    })
    .put('/stock', async c => {
      const { pantryItemId, packages } = await body(c, z.object({ pantryItemId: z.number().int(), packages: z.number().int().min(0).max(50) }));
      setStockPackages(deps, toISODate(new Date()), pantryItemId, packages);
      return c.json({ ok: true });
    })
    .put('/walmart-product', async c => {
      const { line, link } = await body(c, z.object({ line: lineRef, link: z.string().min(1).max(2000) }));
      return c.json(await setWalmartProduct(deps, line, link));
    })
    .post('/walmart-sent', async c => {
      const { lines } = await body(c, z.object({ lines: z.array(z.object({ itemId: z.string().regex(/^\d+$/), quantity: z.number().int().min(1).max(50) })) }));
      noteSentToCart(deps, toISODate(new Date()), lines);
      return c.json({ ok: true });
    })
    .delete('/walmart-sent', c => {
      forgetSentToCart(deps);
      return c.json({ ok: true });
    });
}
