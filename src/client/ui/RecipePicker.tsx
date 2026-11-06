// The recipe book in miniature: search, a photo, and whether you can make it now. Used
// wherever you choose a recipe without leaving the screen.
import { useState } from 'react';
import type { ISODate } from '../../domain/dates.ts';
import type { RecipeMeal } from '../../domain/recipe.ts';
import { inSeason } from '../../domain/seasons.ts';
import type { RecipeCard } from '../../shared/views.ts';
import { RecipeImage } from './RecipeImage.tsx';
import { StatusMark } from './StatusMark.tsx';

export function RecipePicker({ recipes, slot, date, onPick }: {
  recipes: RecipeCard[]; slot?: RecipeMeal; date?: ISODate; onPick?: (recipe: RecipeCard) => void;
}) {
  const [query, setQuery] = useState('');
  const shown = recipes
    .filter(r => !query || `${r.title} ${r.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => fit(b, slot) - fit(a, slot) || rank(a.availability.level) - rank(b.availability.level));

  return (
    <div>
      <input className="field" placeholder="Search recipes" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="picker-list">
        {shown.map(r => {
          const content = (
            <>
              <div className="thumb round"><RecipeImage image={r.image} title={r.title} size="thumb" /></div>
              <div className="body">
                <div className="title">{r.title}</div>
                <StatusMark availability={r.availability} />
                {date && !inSeason(r, date) && <div className="faint small">Out of season</div>}
              </div>
            </>
          );
          return onPick
            ? <button key={r.slug} className="picker-row" onClick={() => onPick(r)}>{content}</button>
            : <div key={r.slug} className="picker-row">{content}</div>;
        })}
        {!shown.length && <p className="muted italic">Nothing matches.</p>}
      </div>
    </div>
  );
}

const fit = (r: RecipeCard, slot?: RecipeMeal) => Number(slot ? r.meals.includes(slot) : 0);
const rank = (level: string) => (level === 'ready' ? 0 : level === 'most' ? 1 : 2);
