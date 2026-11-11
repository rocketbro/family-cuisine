// "No" to an earlier day: mark what happened, or nothing. Either way the check-in stops asking.
import { longDate, weekdayName, type ISODate } from '../../../domain/dates.ts';
import { api } from '../../api.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { Loading, Problem } from '../../ui/Common.tsx';
import { MealRow } from './MealRow.tsx';

export function CatchUpDay({ date, onDone }: { date: ISODate; onDone: () => void }) {
  const { data, error, reload } = useLoad(`catch-up-day:${date}`, () => api.checkin(date));
  if (error) return <div className="page"><Problem message={error} onRetry={reload} /></div>;
  if (!data) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <span className="eyebrow">{longDate(date)}</span>
      <h1 style={{ marginTop: 6 }}>What did we eat?</h1>
      <section className="section">
        <div className="list">
          {data.meals.map(meal => <MealRow key={meal.slot} date={date} meal={meal} />)}
        </div>
        <p className="muted small">Anything not marked stays off the record, and nothing comes off the pantry for it.</p>
      </section>
      <div className="sticky-actions">
        <button className="button wide" onClick={onDone}>Done with {weekdayName(date)}</button>
      </div>
    </div>
  );
}
