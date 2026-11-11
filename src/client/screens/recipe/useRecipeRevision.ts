// The recipe editor's "Tell Claude": its words go to Claude with what the form holds at that
// moment (`useClaudeRevision`). If the sheet has closed by then, the bar holds the words and they go
// through again when this recipe's editor next opens, on whatever it holds then.
import type { RecipeForm } from '../../../domain/recipe-form.ts';
import type { RecipeRevision } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { useClaudeRevision } from '../../dictation/useClaudeRevision.ts';

type Options = {
  slug: string;
  title: string;
  form: RecipeForm;
  /** Claude is available. Until then the mic isn't offered, and words waiting for this recipe stay on the bar. */
  ready: boolean;
  onRevised: (before: RecipeForm, revision: RecipeRevision) => void;
};

export function useRecipeRevision({ slug, title, form, ready, onRevised }: Options) {
  return useClaudeRevision({
    field: `recipe-edit:${slug}`,
    label: `Changes to ${title}`,
    ask: said => api.reviseRecipe(slug, said, form),
    onAnswer: revision => onRevised(form, revision),
    ready,
  });
}
