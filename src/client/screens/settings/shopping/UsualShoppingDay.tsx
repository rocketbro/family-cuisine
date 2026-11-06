// The household's regular shopping day, for every week. The plan is re-checked after a change,
// since the days before groceries only get ready meals.
import { useState } from 'react';
import { WEEKDAYS } from '../../../../domain/dates.ts';
import { nextTrip, regularFor, type ShopSchedule } from '../../../../domain/shop-schedule.ts';
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { useToday } from '../../../hooks/useToday.ts';
import { Segmented } from '../../../ui/Common.tsx';
import { FormField } from '../../../ui/FormField.tsx';
import { SaveNote } from '../../../ui/SaveNote.tsx';

const OPTIONS = WEEKDAYS.map((name, value) => ({ value, label: name.slice(0, 3) }));

export function UsualShoppingDay({ schedule }: { schedule: ShopSchedule }) {
  const [choosing, setChoosing] = useState<number | null>(null);
  const save = useSaveState();
  const trip = nextTrip(useToday(), schedule);
  const moved = regularFor(trip, schedule) !== trip;

  const choose = async (weekday: number) => {
    if (weekday === schedule.weekday) return;
    setChoosing(weekday);
    await save.run(async () => {
      await api.setShopWeekday(weekday);
      announceChange();
    });
    setChoosing(null);
  };

  return (
    <FormField label="Usual shopping day" help={`Every ${WEEKDAYS[choosing ?? schedule.weekday]}.${moved ? ' Changing this cancels the moved trip.' : ''}`}>
      <Segmented tight label="Usual shopping day" value={choosing ?? schedule.weekday} onChange={choose} options={OPTIONS} disabled={save.phase === 'saving'} />
      <SaveNote save={save} saving="Saving and re-checking the plan…" />
    </FormField>
  );
}
