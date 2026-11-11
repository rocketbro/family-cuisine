import { Hono } from 'hono';
import { z } from 'zod';
import { toISODate } from '../../../domain/dates.ts';
import type { Deps } from '../../application/deps.ts';
import { answerTidyQuestion, leaveTidyQuestion, tidyUpView } from '../../application/tidy-up-cards.ts';
import { body } from '../validate.ts';

const card = z.object({ id: z.string().min(1).max(200) });

export function tidyUpRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(tidyUpView(deps, toISODate(new Date()))))
    .post('/answer', async c => {
      const { id, answer } = await body(c, card.extend({ answer: z.number().int().min(0).max(5) }));
      answerTidyQuestion(deps, id, answer);
      return c.json({ ok: true });
    })
    .post('/leave', async c => {
      leaveTidyQuestion(deps, (await body(c, card)).id);
      return c.json({ ok: true });
    });
}
