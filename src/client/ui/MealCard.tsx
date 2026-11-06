// One planned meal: what it is and whether you can make it. On a phone, swipe right to mark it
// done and left to swap it; desktop has the same two as buttons.
import { ArrowLeftRight, Check } from 'lucide-react';
import { useState } from 'react';
import { TabLink } from '../navigation/TabLink.tsx';
import { usesText } from '../../domain/drafted-meal.ts';
import { isExtraSlot, slotLabel } from '../../domain/plan-slot.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useToday } from '../hooks/useToday.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { multiplierLabel } from '../../domain/scaling.ts';
import type { PlanEntryView } from '../../shared/views.ts';
import { Problem } from './Common.tsx';
import { NightBeforeNote } from './NightBeforeNote.tsx';
import { RecipeImage } from './RecipeImage.tsx';
import { StatusMark } from './StatusMark.tsx';
import { SwipeRow } from './SwipeRow.tsx';
import { SwapSheet } from './SwapSheet.tsx';

export function MealCard({ entry, timeNote }: { entry: PlanEntryView; timeNote?: string }) {
  const [swapping, setSwapping] = useState(false);
  const swap = () => setSwapping(true);
  const done = entry.outcome === 'made' || entry.outcome === 'swapped';
  const today = useToday();
  const canCheck = entry.date <= today;
  const write = useWrite();
  const toggleDone = () => write.run(async () => {
    await api.setMealDone(entry.date, entry.slot, !done);
    announceChange();
  });
  return (
    <section className={`section meal ${done ? 'done' : ''}`}>
      <div className="spread" style={{ marginBottom: 10 }}>
        <span className="eyebrow">{slotLabel(entry.slot)}{timeNote ? ` · ${timeNote}` : ''}</span>
        <button className="link-button phone-quiet" onClick={swap}>Swap</button>
      </div>
      <SwipeRow onSwipeRight={canCheck ? () => { void toggleDone(); } : undefined} onSwipeLeft={swap}
        rightMark={<Check size={22} strokeWidth={3} />} leftMark={<ArrowLeftRight size={22} />}>
        <div className="meal-card">
          <MealBody entry={entry} swap={swap} />
          {canCheck && <DoneCheck slot={entry.slot} done={done} onToggle={toggleDone} />}
        </div>
      </SwipeRow>
      <NightBeforeNote entry={entry} />
      {write.problem && <Problem message={write.problem} onRetry={write.retry} />}
      {entry.drafted && (
        <div className="small muted" style={{ marginTop: 8 }}>
          {entry.drafted.how && <p style={{ margin: '0 0 4px' }}>{entry.drafted.how}</p>}
          {entry.drafted.uses.length > 0 && <p className="faint" style={{ margin: 0 }}>{entry.kind === 'recipe' ? 'Plus' : 'Uses'} {usesText(entry.drafted.uses)}</p>}
        </div>
      )}
      {swapping && !isExtraSlot(entry.slot) && <SwapSheet date={entry.date} slot={entry.slot} note={entry.kind === 'note' ? entry.note : null} onClose={() => setSwapping(false)} />}
    </section>
  );
}

/** Marks the meal made, so the evening check-in has nothing to ask about it. On a phone it only shows once it's done. */
export function DoneCheck({ slot, done, onToggle }: { slot: PlanEntryView['slot']; done: boolean; onToggle: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={`meal-check ${done ? '' : 'phone-quiet'}`} role="checkbox" aria-checked={done} aria-label={`${slotLabel(slot)} done`} disabled={busy} onClick={toggle}>
      <span className="phone-quiet">Done</span>
      <span className="meal-check-box">{done && <Check size={14} strokeWidth={3} />}</span>
    </button>
  );
}

export function MealBody({ entry, swap }: { entry: PlanEntryView; swap: () => void }) {
  if (entry.kind === 'leftovers') {
    return (
      <div className="card">
        <div className="body">
          <div className="title">Leftovers</div>
          <div className="meta">{entry.leftoversTitle ? `From ${entry.leftoversTitle}` : 'From earlier this week'}</div>
        </div>
      </div>
    );
  }
  if (entry.kind === 'note' || !entry.recipe) {
    return (
      <button className="card" onClick={swap}>
        <div className="body">
          <div className="title">{entry.note ?? 'Nothing planned yet'}</div>
        </div>
      </button>
    );
  }
  const r = entry.recipe;
  const params = new URLSearchParams({ x: String(entry.multiplier), date: entry.date, slot: entry.slot });
  return (
    <TabLink to={`/recipes/${r.slug}?${params}`} className="card">
      <div className="thumb"><RecipeImage image={r.image} title={r.title} size="thumb" /></div>
      <div className="body">
        <div className="title">{r.title}</div>
        <div className="meta">
          {[r.time, entry.multiplier !== 1 ? `${multiplierLabel(entry.multiplier)} batch` : null].filter(Boolean).join(' · ')}
        </div>
        {entry.outcome !== 'made' && entry.outcome !== 'swapped' && <div style={{ marginTop: 6 }}><StatusMark availability={r.availability} /></div>}
      </div>
    </TabLink>
  );
}
