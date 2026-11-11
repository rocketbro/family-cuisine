// One meal off the plan: its name, what it does to what's already planned, and what you can do about it.
import { importedTitle, type ImportedMeal } from '../../../domain/plan-import.ts';
import type { PlanEntryView } from '../../../shared/views.ts';
import { entryTitle } from '../../ui/entry-title.ts';
import { ImportMealWords } from './ImportMealWords.tsx';

function AlreadyThere({ title, existing, onKeep }: { title: string; existing: PlanEntryView; onKeep: () => void }) {
  const there = entryTitle(existing);
  if (existing.outcome) return <p className="plan-meal-note">{there} is already made. This won’t be saved.</p>;
  if (there.toLowerCase() === title.toLowerCase()) return <p className="plan-meal-note">Already planned.</p>;
  return (
    <div className="plan-replaces">
      <span>Replaces {there}</span>
      <button className="button quiet small" onClick={onKeep}>Keep {there}</button>
    </div>
  );
}

export function ImportMealRow({ meal, existing, past, onEdit, onRemove }: {
  meal: ImportedMeal; existing: PlanEntryView | null; past: boolean; onEdit: () => void; onRemove: () => void;
}) {
  const title = importedTitle(meal);
  return (
    <article className="plan-meal" style={{ opacity: past ? 0.6 : 1 }}>
      <span className="plan-meal-slot">{meal.slot}</span>
      <h2 className="plan-meal-name">{title}</h2>
      <ImportMealWords meal={meal} />
      {past && <p className="plan-meal-note">This day has passed. It won’t be saved.</p>}
      {!past && existing && <AlreadyThere title={title} existing={existing} onKeep={onRemove} />}
      <div className="row plan-meal-actions">
        <button className="link-button" onClick={onEdit}>{meal.date ? 'Change' : 'Choose a day'}</button>
        <button className="link-button" onClick={onRemove}>Remove</button>
      </div>
    </article>
  );
}
