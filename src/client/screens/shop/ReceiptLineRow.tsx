// One line of a receipt under review: keep it or not, what it is, and for something new that
// isn't kept, whether to leave it off every receipt from now on.
import type { ReceiptLine } from '../../../domain/receipts.ts';
import type { ReceiptRow } from '../../../domain/receipt-review.ts';
import { lineDetail } from './receiptText.ts';

type Props = {
  row: ReceiptRow;
  line: ReceiptLine;
  /** It's matched to nothing, so "never add" can be offered once it's unticked. */
  neverable: boolean;
  /** The list line it stands in for, by name. */
  insteadOf: string | null;
  onChange: (change: Partial<Omit<ReceiptRow, 'index'>>) => void;
};

export function ReceiptLineRow({ row, line, neverable, insteadOf, onChange }: Props) {
  return (
    <div className={`list-row receipt-line ${row.included ? '' : 'off'}`}>
      <input type="checkbox" aria-label={`Include ${row.name}`} checked={row.included} onChange={e => onChange({ included: e.target.checked })} />
      <span className="grow">
        <input
          className="field"
          list="pantry-names"
          aria-label={`What ${line.printed} is`}
          value={row.name}
          onChange={e => onChange({ name: e.target.value })}
        />
        <span className="receipt-line-detail faint small">{lineDetail(line)}</span>
        {insteadOf && <span className="receipt-line-detail small">Instead of {insteadOf}{row.always ? ', always' : ', this time'}</span>}
        {!row.included && neverable && !row.neverAdd && (
          <button className="link-button" onClick={() => onChange({ neverAdd: true })}>Never add this</button>
        )}
        {row.neverAdd && (
          <span className="receipt-line-detail small">
            Won’t be added from any receipt. <button className="subs-link" onClick={() => onChange({ neverAdd: false })}>Undo</button>
          </span>
        )}
      </span>
    </div>
  );
}
