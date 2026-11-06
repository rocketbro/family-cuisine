// Fills the Walmart cart in one tap. Walmart's link only adds and the app can't see the cart, so
// the app remembers what it sent this trip and a second tap adds only what's new. That holds
// even if saving the record fails: the link opens regardless, and the phone remembers meanwhile.
import { ShoppingCart } from 'lucide-react';
import { walmartCartUrl } from '../../../domain/walmart.ts';
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { Problem } from '../../ui/Common.tsx';
import { linesToSend } from './cart-outbox.ts';
import { useCartRecord } from './useCartRecord.ts';

type Props = {
  week: Pick<ShoppingWeek, 'shopDate' | 'walmartToSend' | 'walmartSentCount' | 'walmartUnmatched'>;
  onChange: () => void | Promise<void>;
};

export function WalmartCartButton({ week, onChange }: Props) {
  const record = useCartRecord(week.shopDate, onChange);
  const { walmartUnmatched: unmatched } = week;
  const toSend = linesToSend(week.walmartToSend, record.unrecorded);
  const url = walmartCartUrl(toSend);
  const count = toSend.length;
  const sent = week.walmartSentCount + week.walmartToSend.length - count;
  const label = sent > 0 ? `${count} new` : unmatched.length === 0 ? 'all' : `${count}`;

  return (
    <>
      {url && (
        <a className="button wide" style={{ marginTop: 14 }} href={url} target="_blank" rel="noreferrer" onClick={() => record.sent(toSend)}>
          <ShoppingCart size={18} /> Add {label} {count === 1 ? 'item' : 'items'} to the Walmart cart
        </a>
      )}
      {sent > 0 && (
        <p className="faint small" style={{ marginTop: 10 }}>
          {sent} {sent === 1 ? 'item' : 'items'} already sent to the Walmart cart for this trip.{' '}
          <button className="link-button" onClick={() => void record.startOver()}>Cart emptied? Start over</button>
        </p>
      )}
      {record.recordProblem && (
        <Problem
          message={`Couldn’t save what went to the Walmart cart (${record.recordProblem}). This phone remembers, so tapping again won’t add those twice.`}
          onRetry={record.retryRecord}
        />
      )}
      {record.forgetProblem && <Problem message={`Couldn’t start over (${record.forgetProblem}).`} onRetry={record.retryForget} />}
    </>
  );
}
