// One pantry item: tap the status to cycle have → low → out, step counted items, tap the
// name for what's changed most often. Opened, the row's own control gives way to the labelled ones.
import { ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { addDays, type ISODate } from '../../../domain/dates.ts';
import { nextStatus, type PantryItem } from '../../../domain/pantry.ts';
import { portionsText } from '../../../domain/portions.ts';
import { USE_SOON_DAYS, dateWording } from '../../../domain/use-by.ts';
import type { SaveChange } from './item-change.ts';
import { PantryItemEditor } from './PantryItemEditor.tsx';

const LABEL = { have: 'Have', low: 'Low', out: 'Out' } as const;

type Props = {
  item: PantryItem;
  today: ISODate;
  editing: boolean;
  onEdit: () => void;
  onChange: SaveChange;
  onSeeAll: () => void;
  /** A save of this row that failed. */
  problem: ReactNode;
};

export function PantryRow({ item, today, editing, onEdit, onChange, onSeeAll, problem }: Props) {
  const dateLabel = item.status === 'out' ? null : dateWording(item, today);
  const dated = item.portions.find(p => p.useBy === item.useBy && p.useBy !== null);
  const soon = item.useBy !== null && item.useBy <= addDays(today, USE_SOON_DAYS);
  const portions = item.portions.filter(p => p.amount !== 0);

  return (
    <div>
      <div className="list-row">
        <button className="grow plain-button" aria-expanded={editing} onClick={onEdit}>
          {item.name}
          {item.staple && <span className="faint small"> · always on hand</span>}
          {item.store !== 'any' && <span className="faint small"> · {item.store === 'aldi' ? 'Aldi' : 'Walmart'}</span>}
          {portions.length > 0 && <div className="faint small">{portionsText(portions)}</div>}
          {dateLabel && <div className={`small ${soon ? 'use-by-soon' : 'faint'}`}>{dated ? `${dated.storage}: ` : ''}{dateLabel}</div>}
        </button>
        {editing ? (
          <button className="icon-button" aria-label={`Close ${item.name}`} onClick={onEdit}><ChevronUp size={20} /></button>
        ) : item.portions.length > 0 ? (
          <span className={`chip stock-toggle ${item.status}`}>{LABEL[item.status]}</span>
        ) : item.count !== null ? (
          <span className="stepper">
            <button aria-label="One fewer" onClick={() => void onChange({ count: Math.max(0, item.count! - 1) })}>−</button>
            <span>{item.count}</span>
            <button aria-label="One more" onClick={() => void onChange({ count: item.count! + 1 })}>+</button>
          </span>
        ) : !item.staple && (
          <button
            className={`chip stock-toggle ${item.occasional && item.status === 'out' ? 'occasional' : item.status}`}
            onClick={() => void onChange({ status: nextStatus(item.status) })}
          >
            {item.occasional && item.status === 'out' ? 'As needed' : LABEL[item.status]}
          </button>
        )}
      </div>
      {editing && <PantryItemEditor item={item} today={today} onChange={onChange} onSeeAll={onSeeAll} />}
      {problem}
    </div>
  );
}
