// One recipe, set at the size it's planned for. "Cooking mode" turns the page into a working
// copy that stays awake: tap things off as you go, and "Done" leaves it. Nothing is recorded.
import { CalendarPlus, ChefHat, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { shortDate, weekdayName } from '../../domain/dates.ts';
import { isPlanSlot } from '../../domain/plan-slot.ts';
import { MULTIPLIERS, multiplierLabel } from '../../domain/scaling.ts';
import { api } from '../api.ts';
import { useCookSession } from '../hooks/useCookSession.ts';
import { useBatchSize } from './recipe/useBatchSize.ts';
import { SeasonChips } from './recipe/SeasonChips.tsx';
import { useLoad } from '../hooks/useLoad.ts';
import { useWakeLock } from '../hooks/useWakeLock.ts';
import { Loading, Problem, Segmented } from '../ui/Common.tsx';
import { Markdown } from '../ui/Markdown.tsx';
import { describe } from '../ui/availability-words.ts';
import { EditSheet } from './recipe/EditSheet.tsx';
import { IngredientList } from './recipe/IngredientList.tsx';
import { NightBeforeLine } from './recipe/NightBeforeLine.tsx';
import { PhotoCredit, Portrait } from './recipe/PhotoActions.tsx';
import { PickNotice } from './recipe/PickNotice.tsx';
import { PlanSheet } from './recipe/PlanSheet.tsx';
import { SubstitutesSheet } from './recipe/SubstitutesSheet.tsx';
import { encodeSubstitutions } from '../../domain/substitutes.ts';
import type { RecipeDetail } from '../../shared/views.ts';

export function RecipeScreen() {
  const { slug = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  // Words about this recipe said on a receipt's review, ready for its "Tell Claude".
  const carried = search.get('tell');
  const slotParam = search.get('slot') ?? '';
  const planned = search.get('date') && isPlanSlot(slotParam) ? { date: search.get('date')!, slot: slotParam } : null;
  const { factor, change: changeFactor, problem: batchProblem, retry: retryBatch } = useBatchSize(Number(search.get('x')) || 1, planned);
  const cook = useCookSession(slug);
  const subs = encodeSubstitutions(cook.substituted);
  const { data: recipe, error, reload } = useLoad(`recipe:${slug}:${factor}:${subs}`, () => api.recipe(slug, factor, cook.substituted));
  const { data: status } = useLoad('status', () => api.status());
  const [sheet, setSheet] = useState<'plan' | 'subs' | 'edit' | null>(carried ? 'edit' : null);
  const closeEdit = () => {
    setSheet(null);
    if (!carried) return;
    // Once seen, the words don't come back with a reload; back still knows where to go.
    const rest = new URLSearchParams(search);
    rest.delete('tell');
    setSearch(rest, { replace: true, state: location.state });
  };
  const [plannedFor, setPlannedFor] = useState<string | null>(null);
  useWakeLock(cook.cooking);
  useEffect(() => {
    document.body.classList.toggle('cooking', cook.cooking);
    return () => document.body.classList.remove('cooking');
  }, [cook.cooking]);

  if (error) return <div className="page"><Problem message={error} onRetry={reload} /></div>;
  if (!recipe) return <div className="page"><Loading /></div>;

  const options = [...new Set([...MULTIPLIERS, factor])].sort((a, b) => a - b).map(m => ({ value: m, label: multiplierLabel(m) }));

  return (
    <div className={`page wide recipe ${cook.cooking ? 'cooking' : ''}`}>
      {cook.cooking && <div className="cooking-bar"><button className="button small" onClick={cook.end}>Done</button></div>}
      <div className="recipe-layout">
        <header className="recipe-intro">
          <Portrait slug={slug} title={recipe.title} image={recipe.image} canSearch={Boolean(status?.images)} editable={!cook.cooking} onChanged={reload} />
          <h1>{recipe.title}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{[recipe.time, `serves ${formatServes(recipe.serves * factor)}`].filter(Boolean).join(' · ')}</p>
          {recipe.source && (
            <p className="muted small">
              Sourced from {recipe.source.url ? <a href={recipe.source.url} target="_blank" rel="noreferrer">{recipe.source.name}</a> : <span className="italic">{recipe.source.name}</span>}
            </p>
          )}
          {!cook.cooking && (
            <>
              {recipe.nightBefore && <NightBeforeLine slug={slug} step={recipe.nightBefore} />}
              <div className="notice availability">
                <div className="row">
                  <span className={`dot ${recipe.availability.level}`} />
                  <span>{describe(recipe.availability)}</span>
                </div>
                <Swaps recipe={recipe} onOpen={() => setSheet('subs')} />
              </div>
              {recipe.claudesPick && <PickNotice slug={slug} title={recipe.title} onKept={reload} />}
              {recipe.summary && <p className="summary">{recipe.summary}</p>}
              <div className="row recipe-actions">
                <button className="button grow" onClick={cook.start}><ChefHat size={18} /> Cooking mode</button>
                <button className="button quiet grow" onClick={() => setSheet('plan')}><CalendarPlus size={18} /> Plan this</button>
              </div>
              {plannedFor && <p className="muted small" role="status" style={{ marginTop: 8 }}>{plannedFor}</p>}
            </>
          )}
        </header>

        <div className="recipe-main">
          <section>
            <h2 style={{ marginBottom: 12 }}>Ingredients</h2>
            <Segmented label="Batch size" options={options} value={factor} onChange={changeFactor} />
            {batchProblem && <Problem message={`Couldn’t save the batch size (${batchProblem}). It’s back to what the plan has.`} onRetry={retryBatch} />}
            <IngredientList ingredients={recipe.ingredients} factor={factor} crossing={cook.cooking ? cook : null} />
          </section>

          {recipe.body && <section className="section"><Markdown crossing={cook.cooking ? cook : undefined}>{recipe.body}</Markdown></section>}

          {!cook.cooking && <SeasonChips key={recipe.slug} slug={slug} seasons={recipe.seasons} />}

          {!cook.cooking && <button className="button quiet" style={{ marginTop: 24 }} onClick={() => setSheet('edit')}><Pencil size={16} /> Edit or delete</button>}

          <PhotoCredit image={recipe.image} />
        </div>
      </div>

      {sheet === 'plan' && <PlanSheet
        slug={slug}
        meals={recipe.meals}
        factor={factor}
        onClose={() => setSheet(null)}
        onPlanned={(date, slot) => { setSheet(null); setPlannedFor(`On the plan ${slot === 'extra' ? 'as an extra' : `for ${slot}`}, ${weekdayName(date)} ${shortDate(date)}.`); }}
      />}
      {sheet === 'edit' && <EditSheet slug={slug} carried={carried} onClose={closeEdit} />}
      {sheet === 'subs' && (
        <SubstitutesSheet recipe={recipe} factor={factor} onClose={() => setSheet(null)} onApply={chosen => { cook.setSubstituted(chosen); setSheet(null); }} />
      )}
    </div>
  );
}

function formatServes(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** The way into substitutes when we're short on something, and which swaps are in use. */
function Swaps({ recipe, onOpen }: { recipe: RecipeDetail; onOpen: () => void }) {
  const inUse = recipe.substitutes.flatMap(s => {
    const id = recipe.substituted[s.index];
    const option = s.options.find(o => o.id === id);
    return option ? [`${option.label.toLowerCase()} for ${s.ingredient.item}`] : [];
  });
  const short = recipe.substitutes.some(s => s.stock === 'missing' || s.stock === 'short' || s.stock === 'low');
  if (inUse.length) return <p className="small swaps-note" style={{ marginBottom: 0 }}>Using {inUse.join(', ')} · <button className="subs-link" style={{ marginTop: 0 }} onClick={onOpen}>Change</button></p>;
  if (!short) return null;
  return <button className="subs-link" onClick={onOpen}>See substitutes</button>;
}

