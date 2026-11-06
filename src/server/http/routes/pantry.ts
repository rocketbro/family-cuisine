import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Deps } from '../../application/deps.ts';
import { addPantryItem, applyPantryChanges, listPantry, removePantryItem, updatePantryItem } from '../../application/pantry.ts';
import { pantryChange, pantryFields, pantryPatch } from '../schemas/pantry.ts';
import { body } from '../validate.ts';

export function pantryRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(listPantry(deps)))
    .post('/', async c => c.json(addPantryItem(deps, await body(c, pantryFields.partial().required({ name: true })))))
    .patch('/:id', async c => {
      const item = updatePantryItem(deps, Number(c.req.param('id')), await body(c, pantryPatch));
      if (!item) throw new HTTPException(404, { message: 'No such item.' });
      return c.json(item);
    })
    .delete('/:id', c => {
      removePantryItem(deps, Number(c.req.param('id')));
      return c.json({ ok: true });
    })
    .post('/changes', async c => {
      const { changes } = await body(c, z.object({ changes: z.array(pantryChange) }));
      return c.json({ applied: applyPantryChanges(deps, changes) });
    });
}
