// Someone tells the recipe editor what to change. Claude works on what the form holds right now,
// their own unsaved typing included, and the answer goes back to the form. Nothing is saved
// here: that's the editor's Save, the same as for changes typed by hand.
import type { RecipeForm } from '../../domain/recipe-form.ts';
import { checkRevision } from '../../domain/recipe-revision.ts';
import type { RecipeRevision } from '../../shared/api-types.ts';
import type { Deps } from './deps.ts';
import { UserError } from './user-error.ts';

const NOT_UNDERSTOOD = 'Claude couldn’t tell what to change, so nothing changed.';

export async function reviseRecipe(deps: Deps, slug: string, input: { said: string; form: RecipeForm }): Promise<RecipeRevision> {
  if (!deps.ai.available()) throw new UserError('Changing a recipe by talking needs the Anthropic API key in .env.', 503);
  if (!deps.recipes.get(slug)) throw new UserError('No such recipe.', 404);
  const said = input.said.trim();
  if (!said) throw new UserError('We didn’t catch anything. Try again a little closer to the phone.');

  const answer = await deps.ai.reviseRecipe({ said, form: input.form, pantryNames: deps.pantry.list().map(p => p.name) });
  if (!answer.understood) throw new UserError(answer.note.trim() || NOT_UNDERSTOOD, 422);
  const checked = checkRevision(input.form, answer);
  if ('problem' in checked) {
    deps.log(`left out a revision of ${slug}: ${checked.problem}`);
    throw new UserError(checked.problem, 502);
  }
  return { form: checked.form, note: answer.note.trim() };
}
