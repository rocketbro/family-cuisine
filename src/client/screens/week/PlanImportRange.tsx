// The days being planned: two date chips, each opening the phone's own date picker.
import { weekdayDate, type ISODate } from '../../../domain/dates.ts';
import { withFrom, withThrough, type ImportRange } from '../../../domain/plan-import.ts';

export function PlanImportRange({ range, today, onChange }: { range: ImportRange; today: ISODate; onChange: (range: ImportRange) => void }) {
  return (
    <div>
      <span className="eyebrow">Planning for</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        <label className="chip date-chip" aria-pressed>
          {weekdayDate(range.from)}
          <input type="date" min={today} value={range.from} aria-label="First day" onChange={e => e.target.value && onChange(withFrom(range, e.target.value))} />
        </label>
        <span className="faint small">through</span>
        <label className="chip date-chip" aria-pressed>
          {weekdayDate(range.through)}
          <input type="date" min={range.from} value={range.through} aria-label="Last day" onChange={e => e.target.value && onChange(withThrough(range, e.target.value))} />
        </label>
      </div>
    </div>
  );
}
