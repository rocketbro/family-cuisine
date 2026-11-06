// The expanded row: only what someone changes standing in the kitchen. How much there is, where it
// is, and when it goes off. Everything else is behind See all (ItemDetailsSheet).
import { useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import type { PantryItem } from '../../../domain/pantry.ts';
import { moveTarget } from '../../../domain/portion-move.ts';
import { portionsText, type Storage } from '../../../domain/portions.ts';
import { AddPanel } from './AddPanel.tsx';
import { CountField } from './CountField.tsx';
import { MOVE_LABEL, portionsWith, type SaveChange } from './item-change.ts';
import { MovePanel } from './MovePanel.tsx';
import { PortionBlock } from './PortionBlock.tsx';
import { StockState } from './StockState.tsx';
import { UseByLine } from './UseByLine.tsx';

/** Things that plainly don't go in a freezer don't get asked. Saying how much can still put them there. */
const NOT_FROZEN = new Set(['Frozen', 'Pantry', 'Baking', 'Spices']);

type Props = { item: PantryItem; today: ISODate; onChange: SaveChange; onSeeAll: () => void };
type Panel = { kind: 'move'; from: Storage } | { kind: 'add' } | null;

export function PantryItemEditor({ item, today, onChange, onSeeAll }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [said, setSaid] = useState<{ words: string; stock: string } | null>(null);
  const open = (next: Panel) => { setSaid(null); setPanel(next); };
  const portions = item.portions.filter(p => p.amount !== 0);
  const inHouse = item.status !== 'out';
  const noForm = portions.length === 0;
  const stock = portionsText(portions);

  const movePanel = (from: Storage) => panel?.kind === 'move' && panel.from === from && (
    <MovePanel item={item} from={from} to={moveTarget(from)!} today={today} onChange={onChange}
      onDone={done => { setPanel(null); setSaid(done && { words: done.words, stock: done.after }); }} />
  );

  return (
    <div className="item-editor">
      {item.staple
        ? <p className="item-note">Always on hand, so it never goes on the list.</p>
        : item.count !== null ? <CountField item={item} onChange={onChange} /> : <StockState item={item} onChange={onChange} />}
      {said?.stock === stock && <p className="item-said" role="status">{said.words}</p>}

      {portions.map(p => (
        <div key={p.storage}>
          <PortionBlock
            name={item.name} portion={p} today={today} onMove={() => open({ kind: 'move', from: p.storage })}
            onSave={change => onChange({ portions: portionsWith(item.portions, p.storage, change) })}
          />
          {movePanel(p.storage)}
        </div>
      ))}
      {noForm && inHouse && <UseByLine name={item.name} useBy={item.useBy} estimated={item.useByEstimated} today={today} onChange={useBy => void onChange({ useBy })} />}
      {noForm && movePanel('fresh')}
      {panel?.kind === 'add' && <AddPanel item={item} today={today} onChange={onChange} onDone={() => setPanel(null)} />}

      {!panel && (
        <div className="spread item-foot">
          <span className="row item-actions">
            {item.count === null && <button type="button" className="chip" onClick={() => open({ kind: 'add' })}>{noForm ? 'Say how much' : 'Add more'}</button>}
            {noForm && inHouse && !NOT_FROZEN.has(item.category) && <button type="button" className="chip" onClick={() => open({ kind: 'move', from: 'fresh' })}>{MOVE_LABEL.frozen}</button>}
          </span>
          <button type="button" className="chip" onClick={onSeeAll}>See all</button>
        </div>
      )}
    </div>
  );
}
