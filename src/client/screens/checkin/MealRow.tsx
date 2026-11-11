// One planned meal at the check-in: a tap says what became of it, and tapping again changes it. A meal
// that has already come off the pantry only says what happened.
import { Check } from 'lucide-react';
import { useState } from 'react';
import { ateSomethingElse, type MealMark } from '../../../domain/checkin-marks.ts';
import type { ISODate } from '../../../domain/dates.ts';
import { usesText } from '../../../domain/drafted-meal.ts';
import { isExtraSlot, slotLabel, type ExtraSlot } from '../../../domain/plan-slot.ts';
import type { PlanEntryView } from '../../../shared/views.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { Segmented } from '../../ui/Common.tsx';
import { entryTitle } from '../../ui/entry-title.ts';

type Choice = MealMark['outcome'] | '';

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'made', label: 'Made' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'other', label: 'Something else' },
];
/** An extra is something else already. "Didn't make it" takes it off, as it always has. */
const EXTRA_OPTIONS = OPTIONS.slice(0, 1);
const SETTLED_WORD = { made: 'Made', swapped: 'Swapped', skipped: 'Skipped' };

function choiceOf(meal: PlanEntryView): Choice {
  if (!meal.outcome) return '';
  return meal.outcome === 'swapped' ? 'other' : meal.outcome;
}

/** A name typed over a planned dish. A meal planned only as a name already shows it as its title. */
function typedName(meal: PlanEntryView): string | null {
  return ateSomethingElse(meal) && meal.kind !== 'note' ? meal.note : null;
}

export function MealRow({ date, meal }: { date: ISODate; meal: PlanEntryView }) {
  const write = useWrite();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const saved = choiceOf(meal);
  // Shows a tap straight away, until the row comes back changed.
  const standing = `${saved}:${meal.note}`;
  const [tapped, setTapped] = useState<{ choice: Choice; over: string } | null>(null);

  const mark = async (next: MealMark) => {
    setTapped({ choice: next.outcome, over: standing });
    const ok = await write.run(async () => {
      await api.markMeal(date, meal.slot, next);
      announceChange();
    });
    if (!ok) setTapped(null);
    return ok;
  };
  const choose = (choice: Choice) => {
    if (choice === 'other') {
      setName(typedName(meal) ?? '');
      setNaming(true);
      return;
    }
    setNaming(false);
    if (choice && choice !== saved) void mark({ outcome: choice });
  };
  const settled = meal.pantrySettled || meal.checkinSettled;
  const extra = isExtraSlot(meal.slot);
  const had = typedName(meal);

  return (
    <div className="list-row checkin-meal">
      <div className="spread">
        <span className="grow">
          <span className="faint small">{slotLabel(meal.slot)}</span>
          <div style={{ fontSize: '1.15rem' }}>{entryTitle(meal)}</div>
          {meal.drafted && meal.drafted.uses.length > 0 && <div className="faint small">{meal.kind === 'recipe' ? 'Plus' : 'Uses'} {usesText(meal.drafted.uses)}</div>}
          {had && <div className="muted small">We had {had}</div>}
        </span>
        {settled && meal.outcome && <span className="chip"><Check size={14} />&nbsp;{SETTLED_WORD[meal.outcome]}</span>}
      </div>
      {!settled && (
        <div className="checkin-meal-controls">
          <Segmented label={`What became of ${entryTitle(meal)}`} options={extra ? EXTRA_OPTIONS : OPTIONS} value={naming ? 'other' : tapped?.over === standing ? tapped.choice : saved} onChange={choose} />
          {extra && <button className="chip" onClick={() => {
            const slot = meal.slot as ExtraSlot;
            void write.run(async () => { await api.removeExtra(date, slot); announceChange(); });
          }}>Didn’t make it</button>}
        </div>
      )}
      {naming && !settled && (
        <form className="row" style={{ gap: 8 }} onSubmit={e => {
          e.preventDefault();
          if (name.trim()) void mark({ outcome: 'other', name: name.trim() }).then(ok => { if (ok) setNaming(false); });
        }}>
          <input className="field grow" autoFocus maxLength={80} placeholder="What did you have?" aria-label="What did you have?" value={name} onChange={e => setName(e.target.value)} />
          <button className="button" disabled={!name.trim()}>Save</button>
        </form>
      )}
      {write.problem && <p className="error">{write.problem}</p>}
    </div>
  );
}
