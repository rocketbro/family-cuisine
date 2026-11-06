import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../../application/deps.ts';
import { sendTestNotification, subscribeToPush } from '../../application/push.ts';
import { body } from '../validate.ts';

export function pushRoutes(deps: Deps) {
  return new Hono()
    .post('/subscribe', async c => {
      const { subscription, person } = await body(c, z.object({
        person: z.string().min(1).max(40),
        subscription: z.object({ endpoint: z.url().max(2000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(200) }) }),
      }));
      subscribeToPush(deps, subscription, person);
      return c.json({ ok: true });
    })
    .post('/test', async c => c.json({ sent: await sendTestNotification(deps) }));
}
