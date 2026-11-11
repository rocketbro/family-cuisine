import { Hono } from 'hono';
import type { Deps } from '../../application/deps.ts';
import { forgetNeverAdd, neverAddList } from '../../application/never-add.ts';

export function neverAddRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(neverAddList(deps)))
    .delete('/:id', c => {
      forgetNeverAdd(deps, Number(c.req.param('id')));
      return c.json({ ok: true });
    });
}
