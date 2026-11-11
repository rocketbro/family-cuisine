// Under the dates on the Plan tab: when the trip after this stretch is, which is how long it has to last.
import { addDays, type ISODate } from '../../../domain/dates.ts';
import type { TripWindow } from '../../../domain/shop-schedule.ts';
import { TripDayPicker } from '../../ui/TripDayPicker.tsx';

export function NextTripLine({ window, today }: { window: TripWindow; today: ISODate }) {
  if (window.end < today) return null;
  const next = addDays(window.end, 1);
  const earliest = addDays(window.start, 1);
  return (
    <div className="row" style={{ gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
      <span className="muted">Next trip</span>
      <TripDayPicker key={next} trip={next} min={earliest > today ? earliest : today} label="Next trip" />
    </div>
  );
}
