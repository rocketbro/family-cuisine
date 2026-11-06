// Extras for the store, chosen to fit what the budget has left. Adjust them here; what's set goes in the cart.
import { formatDollars } from '../../../domain/prices.ts';
import type { StockLine } from '../../../domain/stock-up.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { Problem } from '../../ui/Common.tsx';
import { WalmartMatch } from './WalmartMatch.tsx';

type Props = { lines: StockLine[]; spendCents: number; checked: Set<string>; onToggle: (key: string) => void };

export function StockUpSection({ lines, spendCents, checked, onToggle }: Props) {
  const write = useWrite();
  const set = (line: StockLine, packages: number) => write.run(async () => {
    await api.setStockPackages(line.pantryItemId, packages);
    announceChange();
  });
  return (
    <section className="section">
      <span className="eyebrow">{spendCents > 0 ? `Stocking up with ${formatDollars(spendCents)}` : 'Stocking up'}</span>
      <div className="list">
        {lines.map(line => (
          <div key={line.key} className={`list-row shop-line ${checked.has(line.key) ? 'done' : ''}`}>
            <input type="checkbox" aria-label={`${line.name} bought`} disabled={line.packages === 0} checked={checked.has(line.key)} onChange={() => onToggle(line.key)} />
            <span className="grow">
              <span className="shop-name">{line.name}</span>
              <span className="faint small" style={{ display: 'block' }}>{line.progress}</span>
              <span className="faint small" style={{ display: 'block' }}>{line.cents === null ? 'No price yet' : `${formatDollars(line.cents)} each`}</span>
              {line.store === 'walmart' && !line.walmartItemId && <WalmartMatch line={line} />}
            </span>
            <span className="stepper">
              <button aria-label={`One fewer ${line.name}`} disabled={line.packages <= 0} onClick={() => set(line, line.packages - 1)}>−</button>
              <span>{line.packages}</span>
              <button aria-label={`One more ${line.name}`} onClick={() => set(line, line.packages + 1)}>+</button>
            </span>
          </div>
        ))}
      </div>
      {write.problem && <Problem message={write.problem} onRetry={write.retry} />}
    </section>
  );
}
