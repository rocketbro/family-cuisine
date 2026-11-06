// Where a goal stands, at a glance: how far along, what's there and what it's aiming for.
import type { StockStanding } from '../../../../domain/stock-up.ts';

export function StockMeter({ standing }: { standing: StockStanding }) {
  return (
    <>
      <span className="stock-meter" role="img" aria-label={`${standing.have}. ${standing.goal}.`}>
        <span style={{ width: `${Math.round(standing.share * 100)}%` }} />
      </span>
      <span className="stock-words"><span>{standing.have}</span><span>{standing.goal}</span></span>
    </>
  );
}
