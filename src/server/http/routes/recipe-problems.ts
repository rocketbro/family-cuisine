// Its own path rather than under /recipes, where it would shadow a recipe of the same name.
import { Hono } from 'hono';
import type { Deps } from '../../application/deps.ts';
import { recipeFileProblems } from '../../application/recipes.ts';

export function recipeProblemRoutes(deps: Deps) {
  return new Hono().get('/', c => c.json(recipeFileProblems(deps)));
}
