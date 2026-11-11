// An earlier day nobody checked in, in one tap. Yes goes the way of "We ate what was planned". No opens the day's rows.
import { useState } from 'react';
import { addDays, longDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import { slotLabel } from '../../../domain/plan-slot.ts';
import type { CheckinView } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { entryTitle } from '../../ui/entry-title.ts';

type Props = {
  /** The day this check-in is for. */
  date: ISODate;
  day: CheckinView['earlier'][number];
  onAnswered: () => unknown;
  onOpen: (date: ISODate) => void;
};

export function CatchUpQuestion({ date, day, onAnswered, onOpen }: Props) {
  const write = useWrite();
  const [saving, setSaving] = useState(false);
  const answer = async (work: () => Promise<unknown>, then: () => unknown) => {
    setSaving(true);
    const ok = await write.run(work);
    setSaving(false);
    if (ok) await then();
  };
  const name = weekdayName(day.date);

  return (
    <div className="page">
      <span className="eyebrow">{longDate(day.date)}</span>
      <h1 style={{ marginTop: 6 }}>{day.date === addDays(date, -7) ? `Last ${name}` : name} too?</h1>
      <p className="muted">Same as planned?</p>
      <div className="list">
        {day.meals.filter(meal => !meal.outcome).map(meal => (
          <div key={meal.slot} className="list-row">
            <span className="grow">
              <span className="faint small">{slotLabel(meal.slot)}</span>
              <div>{entryTitle(meal)}</div>
            </span>
          </div>
        ))}
      </div>
      {write.problem && <p className="error">{write.problem}</p>}
      <div className="sticky-actions">
        <button className="button wide" disabled={saving} onClick={() => void answer(() => api.ateAsPlanned(day.date), onAnswered)}>Yes</button>
        <button className="button quiet wide" disabled={saving} onClick={() => void answer(() => api.notAsPlanned(day.date), () => onOpen(day.date))}>No</button>
      </div>
    </div>
  );
}
