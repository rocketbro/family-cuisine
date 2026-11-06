// What the model made of it, before anything is saved. Everything starts ticked; untick
// what it got wrong.
import { slotLabel } from '../../domain/plan-slot.ts';
import { Mic, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { usesText } from '../../domain/drafted-meal.ts';
import type { ListenContext, Proposal } from '../../shared/api-types.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useDictation } from './useDictation.ts';
import { Sheet } from '../ui/Sheet.tsx';
import { PantryChangeRow } from './PantryChangeRow.tsx';


type Props = {
  proposal: Proposal;
  context: ListenContext;
  onClose: () => void;
  /** Record another part; everything said so far is sent again with it. */
  onKeepTalking: () => void;
};

export function ReviewSheet({ proposal, context, onClose, onKeepTalking }: Props) {
  const [skipMeals, setSkipMeals] = useState<Set<number>>(new Set());
  const [skipPantry, setSkipPantry] = useState<Set<number>>(new Set());
  const [days, setDays] = useState<Map<number, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meals = proposal.meals.filter((_, i) => !skipMeals.has(i));
  const corrected = proposal.pantry.map((change, i) => ({ ...change, lastsDays: days.get(i) ?? change.lastsDays }));
  const pantry = corrected.filter((_, i) => !skipPantry.has(i));
  const nothing = !proposal.meals.length && !proposal.pantry.length;
  const dictation = useDictation();
  const questions = proposal.questions ?? [];

  // Answering the follow-ups saves this first, then listens again with the questions in mind.
  const save = async (thenAnswer = false) => {
    setSaving(true);
    try {
      if (!nothing) await api.applyProposal(pantry, meals, context);
      announceChange();
      onClose();
      if (thenAnswer) await dictation.start({ kind: 'pantry', answering: questions }, 'Answering: say it however you like');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Sheet title={nothing ? (questions.length ? 'A few questions' : 'Nothing to change') : 'Does this look right?'} onClose={onClose} holdOpen={!nothing} footer={
      <div className="stack" style={{ gap: 8 }}>
        {questions.length > 0 && (
          <button className="button wide" disabled={saving} onClick={() => save(true)}><Mic size={18} /> {nothing ? 'Answer' : 'Save and answer'}</button>
        )}
        {nothing
          ? <button className={`button wide ${questions.length ? 'quiet' : ''}`} onClick={onClose}>{questions.length ? 'Skip' : 'OK'}</button>
          : <button
            className={`button wide ${questions.length ? 'quiet' : ''}`}
            disabled={saving || (!meals.length && !pantry.length)}
            onClick={() => save()}
          >
            {saving ? 'Saving…' : questions.length ? 'Just save' : 'Save'}
          </button>}
        {!questions.length && <button className="link-button" disabled={saving} onClick={onKeepTalking}><Plus size={15} /> I’m not done: keep talking</button>}
      </div>
    }>
      {questions.length > 0 && (
        <div className="notice questions">
          <span className="eyebrow">Before we save</span>
          <ul>{questions.map(q => <li key={q}>{q}</li>)}</ul>
        </div>
      )}
      <p className="muted">{proposal.summary}</p>
      {proposal.heard && (
        <details className="notice" style={{ marginTop: 12 }}>
          <summary className="small muted">What we heard</summary>
          <p className="italic" style={{ margin: '8px 0 0' }}>{proposal.heard}</p>
        </details>
      )}

      {proposal.meals.length > 0 && (
        <section className="section">
          <span className="eyebrow">Meals</span>
          <div className="list">
            {proposal.meals.map((meal, i) => (
              <Tick key={i} on={!skipMeals.has(i)} onToggle={() => setSkipMeals(toggle(skipMeals, i))}>
                <span className="grow">
                  {meal.title}
                  <div className="faint small">{slotLabel(meal.slot)}{meal.outcome === 'swapped' && meal.planned ? ` · instead of ${meal.planned}` : ''}</div>
                  {meal.uses && <div className="faint small">Really used {meal.uses.length ? usesText(meal.uses) : 'nothing from the pantry'}</div>}
                </span>
                <span className="chip">{meal.outcome === 'made' ? 'Made' : meal.outcome === 'swapped' ? 'Swapped' : 'Skipped'}</span>
              </Tick>
            ))}
          </div>
        </section>
      )}

      {proposal.pantry.length > 0 && (
        <section className="section">
          <span className="eyebrow">Pantry</span>
          <div className="list">
            {corrected.map((change, i) => (
              <Tick key={i} on={!skipPantry.has(i)} onToggle={() => setSkipPantry(toggle(skipPantry, i))}>
                <PantryChangeRow change={change} onLastsDays={n => setDays(new Map(days).set(i, n))} />
              </Tick>
            ))}
          </div>
        </section>
      )}
      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </Sheet>
  );
}

function Tick({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <label className="list-row" style={{ cursor: 'pointer', opacity: on ? 1 : 0.45 }}>
      <input type="checkbox" checked={on} onChange={onToggle} />
      {children}
    </label>
  );
}

function toggle(set: Set<number>, i: number): Set<number> {
  const next = new Set(set);
  if (next.has(i)) next.delete(i); else next.add(i);
  return next;
}
