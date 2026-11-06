// The coming trip: which day it's on, whether that's the usual day, and changing just this one.
import { longDate, weekdayName } from '../../../../domain/dates.ts';
import { nextTrip, regularFor, tripIfUnmoved, type ShopSchedule } from '../../../../domain/shop-schedule.ts';
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { useToday } from '../../../hooks/useToday.ts';
import { TabLink } from '../../../navigation/TabLink.tsx';
import { FormField } from '../../../ui/FormField.tsx';
import { SaveNote } from '../../../ui/SaveNote.tsx';

export function NextTrip({ schedule }: { schedule: ShopSchedule }) {
  const today = useToday();
  const save = useSaveState();
  const trip = nextTrip(today, schedule);
  const regular = regularFor(trip, schedule);
  const moved = regular !== trip;
  const unmoved = tripIfUnmoved(today, schedule);

  const undo = () => save.run(async () => {
    await api.moveNextTrip(null);
    announceChange();
  });

  return (
    <FormField label="Next trip">
      <p className="trip-day">{longDate(trip)}</p>
      <p className="form-field-help">{moved ? `Moved from ${weekdayName(regular)}, for this trip only.` : 'Your usual day.'}</p>
      <div className="settings-actions">
        <TabLink to="/settings/shopping/move" className="button quiet">{moved ? 'Move it to a different day' : 'Move just this trip'}</TabLink>
        {moved && <button type="button" className="button quiet" disabled={save.phase === 'saving'} onClick={undo}>Put it back on {longDate(unmoved)}</button>}
      </div>
      <SaveNote save={save} saving="Moving it and re-checking the plan…" />
    </FormField>
  );
}
