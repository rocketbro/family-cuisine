// The fields of the recipe editor. A field Claude has changed says so, and the ingredients spell
// out which lines, since a change in a long list is easy to miss.
import { Sparkles } from 'lucide-react';
import { NIGHT_BEFORE_LONGEST } from '../../../domain/night-before.ts';
import type { RecipeForm, RecipeFormField } from '../../../domain/recipe-form.ts';
import { RECIPE_MEALS, recipeMealLabel, type RecipeMeal } from '../../../domain/recipe.ts';

type Props = {
  form: RecipeForm;
  set: (change: Partial<RecipeForm>) => void;
  /** Fields Claude has changed. */
  marked: ReadonlySet<RecipeFormField>;
  lines: { added: string[]; removed: string[] };
  /** The form is with Claude, so it can't be typed in for now. */
  locked: boolean;
};

export function EditFields({ form, set, marked, lines, locked }: Props) {
  const toggle = (meal: RecipeMeal) => set({ meals: RECIPE_MEALS.filter(m => (m === meal ? !form.meals.includes(m) : form.meals.includes(m))) });
  /** A narrow field has room only for the icon. */
  const name = (field: RecipeFormField, words: string, narrow = false) => (
    <span className="eyebrow">{words}{marked.has(field) && (
      <span className="changed-mark">{narrow ? <Sparkles size={12} role="img" aria-label="Claude changed this" /> : <><Sparkles size={12} aria-hidden="true" /> Claude changed this</>}</span>
    )}</span>
  );
  const field = (name: RecipeFormField, base = 'field') => (marked.has(name) ? `${base} changed` : base);

  return (
    <fieldset className="stack recipe-edit-fields" disabled={locked}>
      <label className="stack" data-field="title">{name('title', 'Name')}<input className={field('title')} value={form.title} onChange={e => set({ title: e.target.value })} /></label>
      <div className="stack" data-field="meals">
        {name('meals', 'Good for')}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {RECIPE_MEALS.map(meal => <button key={meal} className="chip" aria-pressed={form.meals.includes(meal)} onClick={() => toggle(meal)}>{recipeMealLabel(meal)}</button>)}
        </div>
      </div>
      <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
        <label className="stack" style={{ width: 96 }} data-field="serves">{name('serves', 'Serves', true)}<input
          className={field('serves')}
          inputMode="decimal"
          value={form.serves}
          onChange={e => set({ serves: e.target.value })}
          style={{ width: '100%' }}
        /></label>
        <label className="stack grow" data-field="time">{name('time', 'Time')}<input
          className={field('time')}
          placeholder="25 min"
          value={form.time}
          onChange={e => set({ time: e.target.value })}
          style={{ width: '100%' }}
        /></label>
      </div>
      <label className="stack" data-field="nightBefore">
        {name('nightBefore', 'The night before')}
        <input className={field('nightBefore')} maxLength={NIGHT_BEFORE_LONGEST} placeholder="Soak the beans overnight" value={form.nightBefore} onChange={e => set({ nightBefore: e.target.value })} />
        <span className="faint small">Only for what can’t wait until the day. You’ll get a reminder the evening before it’s planned.</span>
      </label>
      <label className="stack" data-field="summary">{name('summary', 'About it')}<textarea className={field('summary')} value={form.summary} onChange={e => set({ summary: e.target.value })} /></label>
      <label className="stack" data-field="ingredients">
        {name('ingredients', 'Ingredients')}
        <textarea className={field('ingredients')} rows={10} value={form.ingredients} onChange={e => set({ ingredients: e.target.value })} />
        {(lines.added.length > 0 || lines.removed.length > 0) && (
          <span className="small changed-lines">
            {lines.added.length > 0 && <span>Now: {lines.added.join(' · ')}</span>}
            {lines.removed.length > 0 && <span>Was: {lines.removed.join(' · ')}</span>}
          </span>
        )}
        <span className="faint small">One per line, like “2 cups flour, sifted” or “parsley (optional)”. End a line with a colon to start a group.</span>
      </label>
      <label className="stack" data-field="body">
        {name('body', 'Steps and notes')}
        <textarea className={field('body')} rows={10} value={form.body} onChange={e => set({ body: e.target.value })} />
        <span className="faint small">Lines starting with ## are section headings.</span>
      </label>
    </fieldset>
  );
}
