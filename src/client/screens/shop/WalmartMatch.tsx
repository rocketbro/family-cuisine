// Finding a line's Walmart product the first time: search Walmart, copy the product's link,
// paste it here. After that the item goes straight into the one-tap cart every week.
import { Check } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { walmartSearchUrl } from '../../../domain/walmart.ts';
import type { PricedLine } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';

export function WalmartMatch({ line }: { line: Pick<PricedLine, 'name' | 'pantryItemId' | 'walmartItemId'> }) {
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (line.walmartItemId) return <span className="faint" aria-label="In the Walmart cart"><Check size={17} /></span>;

  const paste = async (e: MouseEvent) => {
    e.preventDefault();
    setError(null);
    let link: string | null = null;
    try { link = await navigator.clipboard.readText(); } catch { /* not allowed here; ask instead */ }
    if (!link?.includes('walmart')) link = window.prompt(`Paste the Walmart link for ${line.name}`) ?? null;
    if (!link) return;
    try {
      await api.setWalmartProduct({ pantryItemId: line.pantryItemId, name: line.name }, link);
      announceChange();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <span className="walmart-match">
      {searched
        ? <button className="link-button" onClick={paste}>Paste link</button>
        : <a className="link-button" href={walmartSearchUrl(line.name)} target="_blank" rel="noreferrer" onClick={e => { e.stopPropagation(); setSearched(true); }}>Find</a>}
      {error && <span className="error small">{error}</span>}
    </span>
  );
}
