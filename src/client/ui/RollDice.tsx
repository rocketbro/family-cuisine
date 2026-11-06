// "Roll the dice": a meal put together from what's in the house, with what it would use.
import { Dices } from 'lucide-react';
import { useState } from 'react';
import type { ISODate } from '../../domain/dates.ts';
import { usesText, type DraftedMeal } from '../../domain/drafted-meal.ts';
import type { MealSlot } from '../../domain/recipe.ts';
import { api } from '../api.ts';
import { AvoidMeal } from './AvoidMeal.tsx';

type Props = { date: ISODate; slot: MealSlot; onUse: (draft: DraftedMeal) => Promise<void> };

export function RollDice({ date, slot, onUse }: Props) {
  const [draft, setDraft] = useState<DraftedMeal | null>(null);
  const [passedOn, setPassedOn] = useState<string[]>([]);
  const [busy, setBusy] = useState<'rolling' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roll = async () => {
    const notThese = draft ? [...passedOn, draft.title] : passedOn;
    setBusy('rolling');
    setError(null);
    try {
      setDraft(await api.rollMeal(date, slot, notThese));
      setPassedOn(notThese);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const choose = async (chosen: DraftedMeal) => {
    setBusy('saving');
    setError(null);
    try {
      await onUse(chosen);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const rollLabel = busy === 'rolling' ? 'Looking through the pantry…' : draft ? 'Roll again' : 'Roll the dice';
  return (
    <section style={{ marginBottom: 14 }}>
      {draft && (
        <div className="notice" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '1.15rem' }}>{draft.title}</div>
          <p className="muted small" style={{ margin: '4px 0 0' }}>{draft.why}</p>
          {draft.how && <p className="small" style={{ margin: '8px 0 0' }}>{draft.how}</p>}
          {draft.uses.length > 0 && <p className="faint small" style={{ margin: '8px 0 0' }}>{draft.recipeSlug ? 'Plus' : 'Uses'} {usesText(draft.uses)}</p>}
          <button
            className="button wide"
            style={{ marginTop: 12 }}
            disabled={busy !== null}
            onClick={() => choose(draft)}
          >
            {busy === 'saving' ? (draft.recipeSlug ? 'Saving…' : 'Writing the recipe…') : 'Use this'}
          </button>
          <AvoidMeal title={draft.title} slug={null} onDone={roll} />
        </div>
      )}
      <button className={`button wide ${draft ? 'quiet' : ''}`} disabled={busy !== null} onClick={roll}><Dices size={18} /> {rollLabel}</button>
      {!draft && !busy && <p className="faint small" style={{ margin: '6px 0 0', textAlign: 'center' }}>Something from what’s already in the house</p>}
      {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
    </section>
  );
}
