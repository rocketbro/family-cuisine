// Two imported meals landed on one slot: side by side, and tapping one drops the other.
import { importedTitle, type ImportedMeal } from '../../../domain/plan-import.ts';
import { ImportMealWords } from './ImportMealWords.tsx';

export function ImportMealClash<T extends ImportedMeal & { key: number }>({ meals, onUse, onEdit }: {
  meals: T[]; onUse: (key: number) => void; onEdit: (key: number) => void;
}) {
  return (
    <article className="plan-clash">
      <span className="plan-meal-slot">{meals[0].slot[0].toUpperCase()}{meals[0].slot.slice(1)}: choose one</span>
      {meals.map(meal => (
        <div key={meal.key} className="plan-clash-choice">
          <h2 className="plan-meal-name">{importedTitle(meal)}</h2>
          <ImportMealWords meal={meal} />
          <div className="row plan-meal-actions">
            <button className="button small" onClick={() => onUse(meal.key)}>Use this</button>
            <button className="link-button" onClick={() => onEdit(meal.key)}>Change</button>
          </div>
        </div>
      ))}
    </article>
  );
}
