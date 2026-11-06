// Which seasons you'd want this in. The planner only uses it then; choosing it yourself still works.
import { useState } from 'react';
import { SEASONS, type Season } from '../../../domain/seasons.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';

const LABEL: Record<Season, string> = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };

export function SeasonChips({ slug, seasons }: { slug: string; seasons: Season[] }) {
  const [chosen, setChosen] = useState<Season[]>(seasons.length ? seasons : SEASONS);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (season: Season) => {
    const next = chosen.includes(season) ? chosen.filter(s => s !== season) : SEASONS.filter(s => s === season || chosen.includes(s));
    if (!next.length) return;
    const before = chosen;
    setChosen(next);
    try {
      await api.setRecipeSeasons(slug, next);
      setError(null);
      announceChange();
    } catch (e) {
      setChosen(before);
      setError((e as Error).message);
    }
  };

  return (
    <section className="section">
      <span className="eyebrow">Good in</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {SEASONS.map(season => <button key={season} className="chip" aria-pressed={chosen.includes(season)} onClick={() => toggle(season)}>{LABEL[season]}</button>)}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
