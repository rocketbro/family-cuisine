// Ingredients at the chosen batch size, with a dot for anything we're short on. In cook
// mode each one can be tapped off as it goes in.
import { groupIngredients } from '../../../domain/recipe.ts';
import { scaleIngredient } from '../../../domain/scaling.ts';
import type { RecipeDetail } from '../../../shared/views.ts';

type Props = {
  ingredients: RecipeDetail['ingredients'];
  factor: number;
  crossing: { isCrossed: (id: string) => boolean; toggle: (id: string) => void } | null;
};

export function IngredientList({ ingredients, factor, crossing }: Props) {
  return groupIngredients(ingredients).map(({ group, items }, gi) => (
    <div key={gi} className="ingredient-group">
      {group && <div className="eyebrow">{group}</div>}
      <ul className="ingredients">
        {items.map((ingredient, i) => {
          const id = `ing-${gi}-${i}`;
          const scaled = scaleIngredient(ingredient, factor);
          const crossed = crossing?.isCrossed(id) ?? false;
          return (
            <li key={i} className={`${crossing ? 'crossable' : ''} ${crossed ? 'crossed' : ''}`} onClick={crossing ? () => crossing.toggle(id) : undefined}>
              <span className={`dot ${ingredient.stock}`} title={ingredient.stock} />
              <span>
                {scaled.amountText && <strong>{scaled.amountText} </strong>}
                {scaled.item}
                {scaled.note && <span className="muted">, {scaled.note}</span>}
                {scaled.optional && <span className="faint italic"> (optional)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}
