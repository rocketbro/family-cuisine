// Cheaper swaps for this trip's meals. Pick the ones you like; confirming changes the plan, and with it the list.
import { useEffect, useState } from 'react';
import { shortDate, weekdayName } from '../../../domain/dates.ts';
import { formatDollars } from '../../../domain/prices.ts';
import type { ChosenSwap, SwapIdea } from '../../../domain/save-money.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { Loading, Problem } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

const keyOf = (idea: Pick<SwapIdea, 'date' | 'slot'>) => `${idea.date}:${idea.slot}`;
const asSwap = ({ date, slot, toSlug, multiplier }: SwapIdea): ChosenSwap => ({ date, slot, toSlug, multiplier });

function savingText({ savedCents, fewerItems }: Pick<SwapIdea, 'savedCents' | 'fewerItems'>): string {
  if (savedCents > 0) return `Saves about ${formatDollars(savedCents)}`;
  return `${fewerItems} fewer ${fewerItems === 1 ? 'thing' : 'things'} to buy`;
}

export function SaveMoneySheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { data, error, reload } = useLoad('save-money', () => api.saveMoney());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [together, setTogether] = useState<Pick<SwapIdea, 'savedCents' | 'fewerItems'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ideas = data?.ideas;
  const pickedKey = [...picked].sort().join();

  // Ideas share ingredients, so the total has to be worked out for the ones picked.
  useEffect(() => {
    const chosen = (ideas ?? []).filter(idea => pickedKey.split(',').includes(keyOf(idea)));
    if (!chosen.length) return;
    const stale = new AbortController();
    api.previewSwaps(chosen.map(asSwap)).then(result => { if (!stale.signal.aborted) setTogether(result); }, () => {});
    return () => stale.abort();
  }, [ideas, pickedKey]);

  const chosen = (ideas ?? []).filter(idea => picked.has(keyOf(idea)));
  const toggle = (key: string) => {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setPicked(next);
  };
  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await api.applySwaps(chosen.map(asSwap));
      announceChange();
      onChanged();
      onClose();
    } catch (e) {
      setProblem((e as Error).message);
      setBusy(false);
    }
  };

  const footer = chosen.length > 0 ? (
    <button className="button wide" disabled={busy} onClick={confirm}>
      {busy ? 'Updating…' : `Swap ${chosen.length} ${chosen.length === 1 ? 'meal' : 'meals'}`}
      {!busy && together && (together.savedCents > 0 || together.fewerItems > 0) ? ` · ${savingText(together).toLowerCase()}` : ''}
    </button>
  ) : undefined;

  return (
    <Sheet title="Save money" onClose={onClose} footer={footer}>
      {error && <Problem message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {ideas && !ideas.length && <p className="muted">Nothing in the recipe book would make this trip cheaper right now.</p>}
      {ideas && ideas.length > 0 && (
        <>
          <p className="muted small" style={{ marginTop: 0 }}>Pick what you’d swap. The plan and grocery list change when you confirm.</p>
          <div className="list">
            {ideas.map(idea => (
              <label key={keyOf(idea)} className="list-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={picked.has(keyOf(idea))} onChange={() => toggle(keyOf(idea))} />
                <span className="grow">
                  <span className="faint small" style={{ display: 'block', textTransform: 'capitalize' }}>{weekdayName(idea.date)} {shortDate(idea.date)} · {idea.slot}</span>
                  <span style={{ display: 'block' }}>{idea.toTitle}</span>
                  <span className="faint small" style={{ display: 'block' }}>Instead of {idea.fromTitle}</span>
                  <span className="small" style={{ display: 'block', marginTop: 2 }}>{savingText(idea)}{idea.ready ? ' · already in the house' : ''}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
      {problem && <p className="error">{problem}</p>}
    </Sheet>
  );
}
