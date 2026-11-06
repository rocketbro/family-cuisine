// One pantry change in the review sheet. A shelf-life guess can be corrected right here.
import { shortDate } from '../../domain/dates.ts';
import { portionsText } from '../../domain/portions.ts';
import type { ProposedChange } from '../../shared/api-types.ts';

const STATUS = { have: 'Have', low: 'Low', out: 'Out' } as const;

type Props = { change: ProposedChange; onLastsDays: (days: number) => void };

export function PantryChangeRow({ change, onLastsDays }: Props) {
  const details = [
    change.current && `was ${change.current}`,
    change.portions && portionsText(change.portions.filter(p => p.amount !== 0)),
    ...(change.portions ?? []).filter(p => p.useBy).map(p => `${p.storage} use by ${shortDate(p.useBy!)}`),
    change.useBy && `use by ${shortDate(change.useBy)}`,
    change.keepStocked === true && 'keep stocked',
    change.keepStocked === false && 'as needed',
  ].filter(Boolean).join(' · ');
  const days = change.lastsDays;

  return (
    <>
      <span className="grow">
        {change.name} {change.isNew && <span className="faint small">· new</span>}
        {details && <div className="faint small">{details}</div>}
        {days !== null && !change.useBy && (
          <div className="faint small row" style={{ gap: 8, marginTop: 4 }}>
            lasts about
            <span className="stepper">
              <button type="button" aria-label="One day less" disabled={days <= 1} onClick={e => { e.preventDefault(); onLastsDays(days - 1); }}>−</button>
              <span>{days}</span>
              <button type="button" aria-label="One day more" onClick={e => { e.preventDefault(); onLastsDays(days + 1); }}>+</button>
            </span>
            days
          </div>
        )}
      </span>
      <span className={`chip stock-toggle ${change.status}`}>{change.count !== null && !change.portions ? change.count : STATUS[change.status]}</span>
    </>
  );
}
