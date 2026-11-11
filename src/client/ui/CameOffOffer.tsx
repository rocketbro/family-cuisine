// "Tacos came off." under the meal that replaced it: one tap to put them on another day, or ignore it.
// It sits in the page, so it covers nothing and nobody has to answer it.
import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import type { CameOffMeal } from '../../domain/came-off.ts';
import type { ISODate } from '../../domain/dates.ts';
import { putBackOptions } from '../../domain/meal-move-options.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { Loading, Problem } from './Common.tsx';
import { MoveDayList } from './MoveDayList.tsx';
import { Sheet } from './Sheet.tsx';
import { useMoveDays } from './useMoveDays.ts';

export function CameOffOffer({ meal, onNext }: {
  meal: CameOffMeal;
  /** What's next to offer: the meal this one replaced in turn, or nothing, which ends the offer. */
  onNext: (next: CameOffMeal | null) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  return (
    <div className="came-off" role="status">
      <p className="grow">{meal.title} came off.</p>
      <button className="link-button" onClick={() => setChoosing(true)}><CalendarDays size={16} /> Move to another day</button>
      <button className="icon-button" aria-label={`Leave ${meal.title} off`} onClick={() => onNext(null)}><X size={18} /></button>
      {choosing && <ChooseDay meal={meal} onClose={() => setChoosing(false)} onDone={next => { setChoosing(false); onNext(next); }} />}
    </div>
  );
}

function ChooseDay({ meal, onClose, onDone }: { meal: CameOffMeal; onClose: () => void; onDone: (next: CameOffMeal | null) => void }) {
  const { days, entries, error, reload } = useMoveDays(meal.date, meal.slot);
  const [busy, setBusy] = useState(false);
  const write = useWrite();
  const pick = (to: ISODate) => {
    setBusy(true);
    void write.run(async () => {
      const { cameOff } = await api.putBackMeal(meal, to);
      announceChange();
      onDone(cameOff);
    }).finally(() => setBusy(false));
  };
  return (
    <Sheet title={`Move ${meal.title}`} onClose={onClose}>
      {error && <Problem message={error} onRetry={reload} />}
      {write.problem && <p className="error">{write.problem}</p>}
      {!days ? !error && <Loading /> : <MoveDayList options={putBackOptions(entries, meal.slot, days)} verb="Takes the place of" busy={busy} onPick={pick} />}
    </Sheet>
  );
}
