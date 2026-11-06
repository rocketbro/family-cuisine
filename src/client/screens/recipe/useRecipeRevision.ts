// The recipe editor's mic: field dictation whose words go to Claude with what the form holds at
// that moment, not into a text box. The words and audio stay until Claude's answer is in the form.
// If the sheet has closed by then, the bar holds the words and they go through again when this
// recipe's editor next opens, on whatever it holds then. A failure lands on the bar's Retry.
import { useEffect, useRef, useState } from 'react';
import type { RecipeForm } from '../../../domain/recipe-form.ts';
import type { RecipeRevision } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import type { FieldLanding } from '../../dictation/field-words.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { useFieldDictation } from '../../dictation/useFieldDictation.ts';

type Options = {
  slug: string;
  title: string;
  form: RecipeForm;
  /** Claude is available. Until then the mic isn't offered, and words waiting for this recipe stay on the bar. */
  ready: boolean;
  onRevised: (before: RecipeForm, revision: RecipeRevision) => void;
};

export function useRecipeRevision({ slug, title, form, ready, onRevised }: Options) {
  const dictation = useDictation();
  const [asking, setAsking] = useState(false);
  const closed = useRef(false);
  useEffect(() => {
    closed.current = false;
    return () => { closed.current = true; };
  }, []);

  const field = `recipe-edit:${slug}`;
  const listen = useFieldDictation(field, `Changes to ${title}`, async (said): Promise<FieldLanding> => {
    setAsking(true);
    try {
      const revision = await api.reviseRecipe(slug, said, form);
      if (closed.current) return 'gone';
      onRevised(form, revision);
      return 'in';
    } catch (e) {
      if (closed.current) return 'gone';
      throw e;
    } finally {
      setAsking(false);
    }
  }, ready);

  const mine = dictation.heldField === field;
  return {
    listen,
    /** The form is with Claude, so typing now would be written over. */
    asking,
    /** Words on their way for this form. Saving now would leave them behind. */
    underway: asking || (mine && ['listening', 'working', 'paused'].includes(dictation.phase)),
    /** Another dictation's unfinished, so the mic can't start. Its label, to say so. */
    heldBy: dictation.holding && !mine ? dictation.holding : null,
    micFree: !dictation.holding,
  };
}
