// The end of the check-in: centered on the screen, with one way onward.
import { longDate, type ISODate } from '../../../domain/dates.ts';

export function CheckinDone({ date, onBack }: { date: ISODate; onBack: () => void }) {
  return (
    <div className="page">
      <div className="checkin-done">
        <span className="eyebrow">{longDate(date)}</span>
        <h1>All set</h1>
        <p className="muted">The pantry is up to date. Good night.</p>
        <button className="button" onClick={onBack}>Back to today</button>
      </div>
    </div>
  );
}
