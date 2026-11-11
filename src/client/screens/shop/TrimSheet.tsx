// What "$12 over" leads to: lines to leave off, the ones no meal needs first, with the amount at the
// top moving as they come off. Only prices we know, because nothing here estimates.
import { formatDollars, lineCents } from '../../../domain/prices.ts';
import { overBudget, trimChoices } from '../../../domain/trip-edits.ts';
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { Problem } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { lineReason, lineText } from './lineText.ts';
import { SkippedRow } from './SkippedLines.tsx';
import type { LineActions } from './useLineActions.ts';

type Props = { week: ShoppingWeek; ticked: ReadonlySet<string>; actions: LineActions; onClose: () => void };

export function TrimSheet({ week, ticked, actions, onClose }: Props) {
  const withTax = week.total.cents + (week.tax?.cents ?? 0);
  const over = overBudget(week.budgetCents, withTax);
  const choices = trimChoices(week.lines, ticked);
  const unpriced = week.lines.filter(l => !l.price).length;
  const room = formatDollars((week.budgetCents ?? withTax) - withTax);
  return (
    <Sheet title={over > 0 ? `${formatDollars(over)} over` : 'On budget'} onClose={onClose}
      footer={<button className="button wide" onClick={onClose}>Done</button>}>
      <p className="muted small" style={{ marginTop: 0 }} aria-live="polite">
        {over > 0 ? 'Leave something off this trip. Restocks come first, then what saves the most.' : `${room} of room${unpriced ? ' so far' : ''}.`}
      </p>
      <div className="list">
        {choices.map(line => (
          <div key={line.key} className="list-row">
            <span className="grow">
              {lineText(line)} <span className="muted">{formatDollars(lineCents(line, line.price!))}</span>
              <span className="faint small" style={{ display: 'block' }}>{lineReason(line)}</span>
            </span>
            <button className="button quiet" aria-label={`Not this trip: ${line.name}`} disabled={actions.busy !== null} onClick={() => void actions.skip(line.key)}>Not this trip</button>
          </div>
        ))}
      </div>
      {unpriced > 0 && <p className="faint small">{unpriced} more without a price {unpriced === 1 ? 'isn’t' : 'aren’t'} counted here.</p>}
      {week.skipped.length > 0 && (
        <section className="section">
          <span className="eyebrow">{week.skipped.length} skipped</span>
          <div className="list">{week.skipped.map(line => <SkippedRow key={line.key} line={line} actions={actions} />)}</div>
        </section>
      )}
      {actions.problem && <Problem message={actions.problem} onRetry={actions.retry} />}
    </Sheet>
  );
}
