// One meal off the plan: what it was read as, how sure that is, and what it would replace.
import type { ImportConfidence, ImportedMeal } from '../../../domain/plan-import.ts';
import type { PlanEntryView } from '../../../shared/views.ts';
import { entryTitle } from '../../ui/entry-title.ts';

const SURE: Record<ImportConfidence, { text: string; color: string }> = {
  sure: { text: 'Sure', color: 'var(--ink-faint)' },
  likely: { text: 'Best guess', color: 'var(--ink-soft)' },
  unsure: { text: 'Not sure', color: 'var(--missing)' },
};

function matchedAs({ match }: Pick<ImportedMeal, 'match'>): { title: string; means: string } {
  if (match.kind === 'recipe') return { title: match.title, means: 'From your recipes' };
  if (match.kind === 'leftovers') return { title: 'Leftovers', means: 'Leftovers, nothing to buy' };
  return { title: match.name, means: 'Just a name: no recipe, so nothing for it goes on the list' };
}

function alreadyThere(title: string, existing: PlanEntryView): string {
  const there = entryTitle(existing);
  if (existing.outcome) return `${there} is already recorded here, so this won’t replace it.`;
  return there === title ? 'Already planned here.' : `Replaces ${there}`;
}

export function ImportMealRow({ meal, existing, otherExtras, past, clash, onEdit, onRemove }: {
  meal: ImportedMeal; existing: PlanEntryView | null; otherExtras: PlanEntryView[]; past: boolean; clash: boolean; onEdit: () => void; onRemove: () => void;
}) {
  const { title, means } = matchedAs(meal);
  const sure = SURE[meal.confidence];
  return (
    <div className="list-row" style={{ alignItems: 'flex-start', opacity: past ? 0.55 : 1 }}>
      <span className="grow">
        <span className="spread">
          <span className="faint small" style={{ textTransform: 'capitalize' }}>{meal.slot}</span>
          <span className="small" style={{ color: sure.color }}>{sure.text}</span>
        </span>
        <span style={{ display: 'block', fontSize: '1.15rem' }}>{title}</span>
        <span className="faint small" style={{ display: 'block' }}>“{meal.said}” · {means}</span>
        {meal.slot === 'extra' && <span className="faint small" style={{ display: 'block' }}>On top of the day’s meals</span>}
        {past && <span className="small" style={{ display: 'block' }}>That day has passed, so this won’t be saved.</span>}
        {!past && existing && <span className="small" style={{ display: 'block' }}>{alreadyThere(title, existing)}</span>}
        {!past && otherExtras.length > 0 && <span className="small" style={{ display: 'block' }}>Already an extra that day: {otherExtras.map(entryTitle).join(', ')}. This adds another.</span>}
        {clash && <span className="error" style={{ display: 'block' }}>Another meal is set for this slot too.</span>}
        <span className="row" style={{ gap: 14, marginTop: 2 }}>
          <button className="link-button" onClick={onEdit}>Change</button>
          <button className="link-button" onClick={onRemove}>Remove</button>
        </span>
      </span>
    </div>
  );
}
