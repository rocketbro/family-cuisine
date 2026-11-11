// Changing a recipe by hand or by telling Claude, or taking it out of the book. Always edits the
// recipe as written, whatever size or swaps the screen behind it is showing. Nothing is saved
// until Save, whoever made the change.
import { Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formFromRecipe, type RecipeForm } from '../../../domain/recipe-form.ts';
import type { RecipeRevision } from '../../../shared/api-types.ts';
import type { RecipeDetail } from '../../../shared/views.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { Loading, Problem } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { CarriedWords } from './CarriedWords.tsx';
import { DeleteRecipe } from './DeleteRecipe.tsx';
import { EditFields } from './EditFields.tsx';
import { markedFields, revisedLines, revisionOf, withoutLastRevision, type Revision } from './revision-history.ts';
import { RevisionNote } from './RevisionNote.tsx';
import { useRecipeRevision } from './useRecipeRevision.ts';
import { useSheetFootHeight } from './useSheetFootHeight.ts';

/** `carried` is what someone said about this recipe elsewhere, offered to Claude here with one tap. */
export function EditSheet({ slug, carried = null, onClose }: { slug: string; carried?: string | null; onClose: () => void }) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.recipe(slug).then(setRecipe, (e: Error) => setError(e.message));
  }, [slug]);

  if (!recipe) return <Sheet title="Edit recipe" onClose={onClose}>{error ? <Problem message={error} /> : <Loading />}</Sheet>;
  return <EditForm recipe={recipe} carried={carried} onClose={onClose} />;
}

function EditForm({ recipe, carried, onClose }: { recipe: RecipeDetail; carried: string | null; onClose: () => void }) {
  const [form, setForm] = useState<RecipeForm>(() => formFromRecipe(recipe));
  const [waiting, setWaiting] = useState(carried);
  const [history, setHistory] = useState<Revision[]>([]);
  const [saving, setSaving] = useState(false);
  // What Claude matched to pantry items; on Save the server keeps the recipe's names as other names.
  const [matches, setMatches] = useState<RecipeRevision['pantryMatches']>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: status } = useLoad('status', () => api.status());
  const aiOn = Boolean(status?.ai);
  const fields = useRef<HTMLDivElement>(null);
  const inFooter = useSheetFootHeight();

  const onRevised = (before: RecipeForm, { form: after, note, pantryMatches }: RecipeRevision) => {
    setMatches(past => [...past, ...pantryMatches]);
    const revision = revisionOf(before, after, note);
    setForm(after);
    setHistory(past => [...past, revision]);
    // The sheet can be scrolled anywhere: bring what changed into view.
    const first = revision.changed[0];
    if (first) requestAnimationFrame(() => fields.current?.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const revision = useRecipeRevision({ slug: recipe.slug, title: recipe.title, form, ready: aiOn, onRevised });

  const undo = () => {
    const undone = withoutLastRevision(form, history);
    setForm(undone.form);
    setHistory(undone.history);
  };

  const talk = () => {
    // On a phone the keyboard would hide the bar that says it's listening.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    void revision.listen();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.editRecipe(recipe.slug, { ...form, serves: Number(form.serves), time: form.time.trim() || null, nightBefore: form.nightBefore.trim() || null, pantryMatches: matches });
      announceChange();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const footer = (
    <div ref={inFooter}>
      {error && <p className="error" style={{ marginTop: 0 }}>{error}</p>}
      {aiOn && revision.heldBy && <p className="small muted" style={{ marginTop: 0 }}>“{revision.heldBy}” isn’t finished yet. Finish it on the bar to tell Claude what to change here.</p>}
      {aiOn && waiting && (
        <CarriedWords words={waiting} asking={revision.asking} disabled={revision.underway || saving}
          apply={async words => { if ((await revision.take(words)) === 'in') setWaiting(null); }} />
      )}
      <RevisionNote history={history} onUndo={undo} />
      <div className="row">
        {aiOn && <button className="button quiet" aria-label="Tell Claude what to change" disabled={!revision.micFree || saving} onClick={talk}><Mic size={18} /> Tell Claude</button>}
        <button className="button wide grow" disabled={saving || revision.underway} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );

  return (
    <Sheet title="Edit recipe" onClose={onClose} footer={footer} holdOpen>
      <div className="stack recipe-edit" ref={fields}>
        <EditFields form={form} set={change => setForm(now => ({ ...now, ...change }))} marked={markedFields(history)} lines={revisedLines(form, history)} locked={revision.asking} />
        <DeleteRecipe slug={recipe.slug} title={recipe.title} />
      </div>
    </Sheet>
  );
}
