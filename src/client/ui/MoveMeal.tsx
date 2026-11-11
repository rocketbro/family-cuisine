// "Move to another day" on the swap sheet: the same slot on another day, trading places with what's there.
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import type { ISODate } from '../../domain/dates.ts';
import { moveOptions } from '../../domain/meal-move-options.ts';
import type { MealSlot } from '../../domain/recipe.ts';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useWrite } from '../hooks/useWrite.ts';
import { Loading, Problem } from './Common.tsx';
import { MoveDayList } from './MoveDayList.tsx';
import { useMoveDays } from './useMoveDays.ts';

export function MoveMeal({ date, slot, title, onMoved }: { date: ISODate; slot: MealSlot; title: string; onMoved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ marginBottom: 14 }}>
      <button className="button quiet wide" aria-expanded={open} onClick={() => setOpen(!open)}>
        <CalendarDays size={18} /> Move {title} to another day
      </button>
      {open && <DayChoices date={date} slot={slot} onMoved={onMoved} />}
    </section>
  );
}

function DayChoices({ date, slot, onMoved }: { date: ISODate; slot: MealSlot; onMoved: () => void }) {
  const { days, entries, error, reload, today } = useMoveDays(date, slot);
  const [busy, setBusy] = useState(false);
  const write = useWrite();
  const pick = async (to: ISODate) => {
    setBusy(true);
    const moved = await write.run(async () => {
      await api.moveMeal(date, slot, to);
      announceChange();
    });
    setBusy(false);
    if (moved) onMoved();
  };
  if (error) return <Problem message={error} onRetry={reload} />;
  if (!days) return <Loading />;
  return (
    <>
      {write.problem && <p className="error">{write.problem}</p>}
      <MoveDayList options={moveOptions(entries, { date, slot }, days, today)} verb="Trades with" busy={busy} onPick={pick} />
    </>
  );
}
