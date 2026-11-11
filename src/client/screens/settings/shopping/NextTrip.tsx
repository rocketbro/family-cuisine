// The next shopping day. Choosing one moves that trip, and weeks count on from it.
import { weekdayName } from '../../../../domain/dates.ts';
import { nextTrip, type ShopSchedule } from '../../../../domain/shop-schedule.ts';
import { useToday } from '../../../hooks/useToday.ts';
import { FormField } from '../../../ui/FormField.tsx';
import { TripDayPicker } from '../../../ui/TripDayPicker.tsx';

export function NextTrip({ schedule }: { schedule: ShopSchedule }) {
  const today = useToday();
  const trip = nextTrip(today, schedule);
  return (
    <FormField label="Next shopping day" help={`${trip === today ? 'Today' : weekdayName(trip)}. After that, a week later unless you pick another day.`}>
      <TripDayPicker key={trip} trip={trip} min={today} label="Next shopping day" />
    </FormField>
  );
}
