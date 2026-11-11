// What a tap on a line's name opens: the two ways it can leave the list, kept away from the checkbox
// so neither happens by accident in the aisle.
import { isOneOffKey } from '../../../domain/trip-edits.ts';
import type { PricedLine } from '../../../shared/api-types.ts';
import { Problem } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { lineReason, lineText } from './lineText.ts';
import type { LineActions } from './useLineActions.ts';

type Props = { line: PricedLine; inCart: boolean; actions: LineActions; onClose: () => void };

export function LineSheet({ line, inCart, actions, onClose }: Props) {
  const oneOff = isOneOffKey(line.key);
  const leaveWith = (act: (key: string) => Promise<boolean>) => async () => { if (await act(line.key)) onClose(); };
  const working = actions.busy !== null;
  return (
    <Sheet title={lineText(line)} onClose={onClose}>
      <p className="muted small">{lineReason(line)}</p>
      <div className="stack line-choices">
        {(!oneOff || line.pantryItemId !== null) && (
          <button className="button quiet wide line-choice" disabled={working} onClick={leaveWith(actions.inHouse)}>
            <strong>Have it</strong>
            <span className="faint small">Off the list. Pantry says have.</span>
          </button>
        )}
        <button className="button quiet wide line-choice" disabled={working} onClick={leaveWith(actions.skip)}>
          <strong>Not this trip</strong>
          <span className="faint small">{oneOff ? 'Off the list and total.' : 'Off the list and total. Back next trip.'}</span>
        </button>
      </div>
      {inCart && <p className="small muted section">Already in the Walmart cart. Take it out there too.</p>}
      {actions.problem && <Problem message={actions.problem} onRetry={actions.retry} />}
    </Sheet>
  );
}
