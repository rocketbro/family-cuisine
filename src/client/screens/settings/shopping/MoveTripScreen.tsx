// Moves only the coming trip: a day to tap, and the rest of the weeks stay as they are. The trip's
// usual day clears the move instead of recording one.
import { Check } from 'lucide-react';
import { useState } from 'react';
import { longDate, weekdayName, type ISODate } from '../../../../domain/dates.ts';
import { nextTrip, regularFor, tripMoveChoices } from '../../../../domain/shop-schedule.ts';
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { useToday } from '../../../hooks/useToday.ts';
import { useBack } from '../../../navigation/useTabNav.ts';
import { Loading } from '../../../ui/Common.tsx';
import { SaveNote } from '../../../ui/SaveNote.tsx';
import { SettingsPage } from '../SettingsPage.tsx';

export function MoveTripScreen() {
  const { data: status, reload } = useLoad('status', () => api.status());
  const today = useToday();
  const back = useBack();
  const save = useSaveState();
  const [choosing, setChoosing] = useState<ISODate | null>(null);

  if (!status) return <SettingsPage title="Move the next trip"><Loading /></SettingsPage>;
  const schedule = status.shopping;
  const trip = nextTrip(today, schedule);
  const regular = regularFor(trip, schedule);

  const choose = async (day: ISODate) => {
    if (day === trip) { back(); return; }
    setChoosing(day);
    const moved = await save.run(async () => {
      await api.moveNextTrip(day === regular ? null : day);
      announceChange();
      await reload(); // so the screen underneath opens on the new day
    });
    setChoosing(null);
    if (moved) back();
  };

  const note = (day: ISODate) => {
    if (day === trip) return 'Next trip';
    if (day === regular) return 'Usual day';
    return day === today ? 'Today' : null;
  };

  return (
    <SettingsPage title="Move the next trip" intro={`Only this trip moves. Your usual day stays ${weekdayName(regular)}.`}>
      <div className="setting-rows">
        {tripMoveChoices(today, schedule).map(day => (
          <button key={day} type="button" className="setting-row" disabled={save.phase === 'saving'} aria-current={day === trip ? 'true' : undefined} onClick={() => choose(day)}>
            <span className="grow">
              <span className="setting-title">{longDate(day)}</span>
              {note(day) && <span className="setting-value">{note(day)}</span>}
            </span>
            {day === trip && <Check size={20} className="chevron" />}
            {day === choosing && <span className="setting-value">Moving…</span>}
          </button>
        ))}
      </div>
      <SaveNote save={save} saving="Moving it and re-checking the plan…" />
    </SettingsPage>
  );
}
