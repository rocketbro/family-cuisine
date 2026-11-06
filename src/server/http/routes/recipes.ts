import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { decodeSubstitutions } from '../../../domain/substitutes.ts';
import type { Deps } from '../../application/deps.ts';
import {
  deleteRecipe, editRecipe, getRecipe, importFromPhotos, importFromUrl, importFromWords, keepPick, listRecipes,
  refreshRecipeImage, setRecipePhoto, setRecipeSeasons,
} from '../../application/recipes.ts';
import { toISODate } from '../../../domain/dates.ts';
import { finishCooking } from '../../application/cooking.ts';
import { reviseRecipe } from '../../application/revise-recipe.ts';
import { SEASONS } from '../../../domain/seasons.ts';
import { isoDate, planSlot } from '../schemas/common.ts';
import { recipeChanges, recipeRevision } from '../schemas/recipes.ts';
import { body, files, formText } from '../validate.ts';

export function recipeRoutes(deps: Deps) {
  return new Hono()
    .get('/', c => c.json(listRecipes(deps)))
    .get('/:slug', c => {
      const factor = Number(c.req.query('x'));
      const recipe = getRecipe(deps, c.req.param('slug'), factor > 0 && factor <= 10 ? factor : 1, decodeSubstitutions(c.req.query('subs')));
      if (!recipe) throw new HTTPException(404, { message: 'No such recipe.' });
      return c.json(recipe);
    })
    .put('/:slug', async c => {
      editRecipe(deps, c.req.param('slug'), await body(c, recipeChanges));
      return c.json({ ok: true });
    })
    .post('/:slug/revise', async c => c.json(await reviseRecipe(deps, c.req.param('slug'), await body(c, recipeRevision))))
    .delete('/:slug', c => {
      deleteRecipe(deps, c.req.param('slug'));
      return c.json({ ok: true });
    })
    .post('/:slug/photo', async c => {
      const [photo] = await files(c, 'photo', 1);
      if (!photo) throw new HTTPException(400, { message: 'No photo attached.' });
      await setRecipePhoto(deps, c.req.param('slug'), photo.data);
      return c.json({ ok: true });
    })
    .put('/:slug/seasons', async c => {
      const { seasons } = await body(c, z.object({ seasons: z.array(z.enum(SEASONS)) }));
      setRecipeSeasons(deps, c.req.param('slug'), seasons);
      return c.json({ ok: true });
    })
    .post('/:slug/image/refresh', async c => c.json({ found: await refreshRecipeImage(deps, c.req.param('slug')) }))
    .post('/:slug/cooked', async c => {
      const input = await body(c, z.object({
        factor: z.number().positive(), date: isoDate.optional(), slot: planSlot.optional(),
        substituted: z.record(z.string().regex(/^\d+$/), z.string().max(100)).optional(),
      }));
      const now = new Date();
      return c.json(finishCooking(deps, { ...input, slug: c.req.param('slug'), today: toISODate(now), hour: now.getHours() + now.getMinutes() / 60 }));
    })
    .post('/:slug/keep', c => {
      keepPick(deps, c.req.param('slug'));
      return c.json({ ok: true });
    })
    .post('/import/words', async c => {
      const { words } = await body(c, z.object({ words: z.string().max(20000) }));
      return c.json({ slug: await importFromWords(deps, words) });
    })
    .post('/import/url', async c => {
      const { url, notes, viaClaude } = await body(c, z.object({ url: z.url(), notes: z.string().max(20000).nullable().optional(), viaClaude: z.boolean().optional() }));
      return c.json({ slug: await importFromUrl(deps, url, notes ?? null, viaClaude ?? false) });
    })
    .post('/import/photos', async c => {
      const photos = await files(c, 'photos');
      return c.json({ slug: await importFromPhotos(deps, photos.map(p => p.data), await formText(c, 'source'), await formText(c, 'notes')) });
    });
}
