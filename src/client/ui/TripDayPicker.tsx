// A chip showing a trip's day, opening the phone's date picker. A phone's wheel changes the value as
// it spins, so the move is saved when the picker closes, or the screen does.
import { useState } from 'react';
import { weekdayDate, type ISODate } from '../../domain/dates.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useSaveOnLeave } from '../hooks/useSaveOnLeave.ts';
import { useSaveState } from '../hooks/useSaveState.ts';
import { SaveNote } from './SaveNote.tsx';

export function TripDayPicker({ trip, min, label }: { trip: ISODate; min: ISODate; label: string }) {
  const [day, setDay] = useState(trip);
  const save = useSaveState();
  const dirty = day !== trip && day >= min && save.phase !== 'saving';
  const persist = () => save.run(async () => {
    await api.moveTrip(trip, day);
    announceChange();
  });
  useSaveOnLeave(dirty, persist);

  return (
    <>
      <label className="chip date-chip" aria-pressed>
        {weekdayDate(day)}
        <input type="date" min={min} value={day} aria-label={label}
          onChange={e => { if (e.target.value) setDay(e.target.value); }}
          onBlur={() => { if (dirty) void persist(); else if (day < min) setDay(trip); }} />
      </label>
      <SaveNote save={save} saving="Moving it and re-checking the plan…" />
    </>
  );
}
