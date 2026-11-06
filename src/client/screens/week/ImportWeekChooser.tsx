// Which week a plan that only names days means. Says what was assumed and lets them change it.
import { addDays, shortDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import { nextTrip, type ShopSchedule } from '../../../domain/shop-schedule.ts';

const range = (start: ISODate) => `${weekdayName(start).slice(0, 3)}, ${shortDate(start)} – ${weekdayName(addDays(start, 6)).slice(0, 3)}, ${shortDate(addDays(start, 6))}`;

export function ImportWeekChooser({ start, today, shopping, onChange }: {
  start: ISODate; today: ISODate; shopping: ShopSchedule; onChange: (start: ISODate) => void;
}) {
  const trip = nextTrip(today, shopping);
  return (
    <>
      <span className="eyebrow">Which week?</span>
      <p style={{ margin: '6px 0 10px' }}>The days it names are going on <strong>{range(start)}</strong>.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button className="chip" onClick={() => onChange(addDays(start, -7))}>A week earlier</button>
        <button className="chip" onClick={() => onChange(addDays(start, 7))}>A week later</button>
        {start !== today && <button className="chip" onClick={() => onChange(today)}>From today</button>}
        {start !== trip && <button className="chip" onClick={() => onChange(trip)}>From the trip, {shortDate(trip)}</button>}
        <label className="chip date-chip">
          From another day…
          <input type="date" value={start} aria-label="The week starts on" onChange={e => e.target.value && onChange(e.target.value)} />
        </label>
      </div>
    </>
  );
}
