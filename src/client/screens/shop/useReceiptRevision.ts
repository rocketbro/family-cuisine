// The receipt review's "Tell Claude": said or typed words go to Claude with the rows as they stand
// on screen (`useClaudeRevision`), and go through again if the review comes back after closing.
import type { ReceiptRow } from '../../../domain/receipt-review.ts';
import type { ReceiptRevision } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { useClaudeRevision } from '../../dictation/useClaudeRevision.ts';

export function useReceiptRevision({ id, rows, ready, onRevised }: {
  id: number; rows: ReceiptRow[]; ready: boolean; onRevised: (revision: ReceiptRevision) => void;
}) {
  return useClaudeRevision({
    field: `receipt-review:${id}`,
    label: 'Changes to the receipt',
    ask: said => api.reviseReceipt(id, said, rows),
    onAnswer: onRevised,
    ready,
  });
}
