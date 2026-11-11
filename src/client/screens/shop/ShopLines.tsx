// The lines for one store, in the order you walk it. The checkbox only ticks; a tap on the name opens
// what else can happen to the line. Aldi lines carry a price; Walmart lines their product match.
import type { Store } from '../../../domain/pantry.ts';
import { formatDollars, isEstimate, lineCents } from '../../../domain/prices.ts';
import { shopSections } from '../../../domain/shop-sections.ts';
import type { PricedLine } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import type { ListView } from '../../preferences.ts';
import { lineReason, lineText } from './lineText.ts';
import { PriceButton } from './PriceButton.tsx';
import { WalmartMatch } from './WalmartMatch.tsx';

type Props = {
  lines: PricedLine[];
  store: Store;
  checked: ReadonlySet<string>;
  onToggle: (key: string, checked: boolean) => void;
  onOpen: (key: string) => void;
  view: ListView;
};

export function ShopLines({ lines, store, checked, onToggle, onOpen, view }: Props) {
  return (
    <>
      {shopSections(lines).map(section => (
        <div key={section.category} className="aisle">
          <h3 className="aisle-head">{section.category}</h3>
          <div className="list">
            {section.lines.map(line => {
              const done = checked.has(line.key);
              return (
                <div key={line.key} className={`list-row shop-line ${done ? 'done' : ''}`}>
                  <label className="shop-tick">
                    <input type="checkbox" aria-label={`${line.name} in the basket`} checked={done} onChange={() => onToggle(line.key, !done)} />
                  </label>
                  <button className="shop-open grow" aria-haspopup="dialog" aria-label={`${lineText(line)}: Have it or Not this trip`} onClick={() => onOpen(line.key)}>
                    <span className="shop-name">{lineText(line)}</span>
                    {view.reason && <span className="faint small" style={{ display: 'block' }}>{lineReason(line)}</span>}
                    {line.packages > 1 && (store === 'aldi' || line.walmartItemId) && (
                      <span className="faint small" style={{ display: 'block' }}>
                        {store === 'aldi' ? `Buy ${line.packages}` : `${line.packages} in the cart`}
                        {line.price ? ` · ${isEstimate(line) ? '≈' : ''}${formatDollars(lineCents(line, line.price))} in all` : ''}
                      </span>
                    )}
                    {store === 'aldi' && view.product && line.price?.product && <span className="faint small italic" style={{ display: 'block' }}>{line.price.product}</span>}
                  </button>
                  {store !== 'aldi' && !line.walmartItemId
                    ? <WalmartMatch line={line} />
                    : view.price && <PriceButton
                      price={line.price}
                      onSave={async cents => { await api.setPrice({ pantryItemId: line.pantryItemId, name: line.name }, store, cents); announceChange(); }}
                    />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
