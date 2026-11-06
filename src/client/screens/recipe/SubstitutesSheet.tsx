// "See substitutes": every ingredient with a common swap, the ones we're short on first.
// Check the swaps you'll use and the recipe becomes a working copy with them in; cook mode
// and "Done making this" follow it.
import { Check } from 'lucide-react';
import { useState } from 'react';
import { scaleIngredient } from '../../../domain/scaling.ts';
import type { SubstituteChoice, Substitutions } from '../../../domain/substitutes.ts';
import type { RecipeDetail } from '../../../shared/views.ts';
import { Sheet } from '../../ui/Sheet.tsx';

type Props = {
  recipe: RecipeDetail;
  factor: number;
  onApply: (chosen: Substitutions) => void;
  onClose: () => void;
};

export function SubstitutesSheet({ recipe, factor, onApply, onClose }: Props) {
  const [chosen, setChosen] = useState<Record<number, string>>({ ...recipe.substituted });
  const short = (stock: string) => stock === 'missing' || stock === 'short' || stock === 'low';
  const rows = [...recipe.substitutes].sort((a, b) => Number(short(b.stock)) - Number(short(a.stock)));
  const pick = (index: number, id: string) => setChosen(c => {
    const next = { ...c };
    if (next[index] === id) delete next[index]; else next[index] = id;
    return next;
  });
  const count = Object.keys(chosen).length;

  return (
    <Sheet title="Substitutes" onClose={onClose} footer={
      <button className="button wide" onClick={() => onApply(chosen)}>{count ? `Use ${count} swap${count > 1 ? 's' : ''}` : 'Use the recipe as written'}</button>
    }>
      {!rows.length && <p className="muted">No common swaps for anything in this recipe.</p>}
      <div className="subs">
        {rows.map(({ index, ingredient, options, stock }) => {
          const scaled = scaleIngredient(ingredient, factor);
          return (
            <section key={index} className="subs-group">
              <div className="subs-head">
                <span className={`dot ${stock}`} />
                <span className="grow">{scaled.amountText && <strong>{scaled.amountText} </strong>}{scaled.item}</span>
                {short(stock) && <span className="faint small">{stock === 'low' ? 'running low' : stock === 'short' ? 'not enough' : 'out'}</span>}
              </div>
              <div className="list">
                {options.map(option => (
                  <Option key={option.id} option={option} factor={factor} selected={chosen[index] === option.id} onPick={() => pick(index, option.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}

function Option({ option, factor, selected, onPick }: {
  option: SubstituteChoice; factor: number; selected: boolean; onPick: () => void;
}) {
  const amounts = option.ingredients.map(i => {
    const s = scaleIngredient(i, factor);
    return [s.amountText, s.item].filter(Boolean).join(' ');
  }).join(' + ');
  return (
    <button className="sub-option list-row" aria-pressed={selected} onClick={onPick}>
      <span className="sub-check">{selected && <Check size={15} />}</span>
      <span className="grow">
        <span>{option.label}</span>
        <span className="muted small" style={{ display: 'block' }}>{amounts}{option.approximate ? ' (to taste)' : ''}</span>
        {option.note && <span className="faint small" style={{ display: 'block' }}>{option.note}</span>}
      </span>
      <span className={`small ${option.missing.length ? 'faint' : ''}`}>{option.missing.length ? `need ${option.missing.join(', ')}` : 'have it'}</span>
    </button>
  );
}
