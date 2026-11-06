// The lines for one store, checked off at the store. Aldi lines carry a price; Walmart
// lines carry their product match.
import type { Store } from '../../../domain/pantry.ts';
import { formatDollars, isEstimate, lineCents } from '../../../domain/prices.ts';
import type { PricedLine } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import type { ListView } from '../../preferences.ts';
import { lineText } from './lineText.ts';
import { PriceButton } from './PriceButton.tsx';
import { WalmartMatch } from './WalmartMatch.tsx';

type Props = { lines: PricedLine[]; store: Store; checked: Set<string>; onToggle: (key: string) => void; view: ListView };

export function ShopLines({ lines, store, checked, onToggle, view }: Props) {
  return (
    <div className="list">
      {lines.map(line => {
        const done = checked.has(line.key);
        return (
          <label key={line.key} className={`list-row shop-line ${done ? 'done' : ''}`}>
            <input type="checkbox" checked={done} onChange={() => onToggle(line.key)} />
            <span className="grow">
              <span className="shop-name">{lineText(line)}</span>
              {view.reason && <span className="faint small" style={{ display: 'block' }}>{line.reason === 'restock' ? 'Restock' : line.neededFor.join(', ')}</span>}
              {line.packages > 1 && (store === 'aldi' || line.walmartItemId) && (
                <span className="faint small" style={{ display: 'block' }}>
                  {store === 'aldi' ? `Buy ${line.packages}` : `${line.packages} in the cart`}
                  {line.price ? ` · ${isEstimate(line) ? '≈' : ''}${formatDollars(lineCents(line, line.price))} in all` : ''}
                </span>
              )}
              {store === 'aldi' && view.product && line.price?.product && <span className="faint small italic" style={{ display: 'block' }}>{line.price.product}</span>}
            </span>
            {store !== 'aldi' && !line.walmartItemId
              ? <WalmartMatch line={line} />
              : view.price && <PriceButton
                price={line.price}
                onSave={async cents => { await api.setPrice({ pantryItemId: line.pantryItemId, name: line.name }, store, cents); announceChange(); }}
              />}
          </label>
        );
      })}
    </div>
  );
}

