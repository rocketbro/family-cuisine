// The recipe book. Each recipe shows at a glance whether you can make it tonight.
import { useState } from 'react';
import { TabLink } from '../navigation/TabLink.tsx';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { usePreferences } from '../preferences.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { Plus } from 'lucide-react';
import { ClaudeFilter } from './recipe/ClaudeFilter.tsx';
import { recipeShows, type ClaudeView, type RecipeFilter } from './recipe/recipe-filter.ts';
import { RecipeFileNotices } from './recipe/RecipeFileNotices.tsx';
import { RecipeImage } from '../ui/RecipeImage.tsx';
import { StatusMark } from '../ui/StatusMark.tsx';

const FILTERS: { value: RecipeFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'ready', label: 'Can make now' },
  { value: 'breakfast', label: 'Breakfast' }, { value: 'lunch', label: 'Lunch' }, { value: 'dinner', label: 'Dinner' }, { value: 'extra', label: 'Extras' },
];

export function RecipesScreen() {
  const { data, error, reload } = useLoad('recipes', () => api.recipes());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecipeFilter>('all');
  const [{ hideClaudesPicks }, setPreferences] = usePreferences();

  // Hiding them is remembered on this phone. Looking at only them is a look, for now.
  const [onlyPicks, setOnlyPicks] = useState(false);
  const claude: ClaudeView = onlyPicks ? 'only' : hideClaudesPicks ? 'hide' : 'show';
  const chooseClaude = (view: ClaudeView) => {
    setOnlyPicks(view === 'only');
    if (view !== 'only') setPreferences({ hideClaudesPicks: view === 'hide' });
  };

  const shown = (data ?? []).filter(r => recipeShows(r, { query, filter, claude }));

  return (
    <div className="page wide">
      <div className="spread title-row">
        <h1>Recipes</h1>
        <TabLink to="/recipes/import" className="icon-button" aria-label="Add a recipe"><Plus size={24} /></TabLink>
      </div>

      <input className="field" style={{ marginTop: 18 }} placeholder="Search recipes" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="chip-row" style={{ marginTop: 10 }}>
        <ClaudeFilter view={claude} onChange={chooseClaude} />
        {FILTERS.map(f => <button key={f.value} className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>)}
      </div>

      {error && <Problem message={error} onRetry={reload} />}
      {!data ? <Loading /> : (
        <div className="card-grid section">
          {shown.map(r => (
            <TabLink key={r.slug} to={`/recipes/${r.slug}`} className="card">
              <div className="thumb round"><RecipeImage image={r.image} title={r.title} size="thumb" /></div>
              <div className="body">
                <div className="title">{r.title}</div>
                <div className="meta">{[r.time, r.kind === 'simple' ? 'no recipe needed' : null].filter(Boolean).join(' · ')}</div>
                <div style={{ marginTop: 6 }}><StatusMark availability={r.availability} /></div>
              </div>
            </TabLink>
          ))}
          {!shown.length && <p className="muted italic">{data.length ? 'Nothing matches.' : 'No recipes yet. Tap + to add one.'}</p>}
        </div>
      )}
      <RecipeFileNotices />
    </div>
  );
}
