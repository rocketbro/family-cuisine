// The days a meal can go to, each saying what's on it, so one tap on a row is the whole move.
import { addDays, weekdayDate, weekdayName, type ISODate } from '../../domain/dates.ts';
import type { MoveOption } from '../../domain/meal-move-options.ts';
import type { PlanEntryView } from '../../shared/views.ts';
import { useToday } from '../hooks/useToday.ts';
import { entryTitle } from './entry-title.ts';

export type DayOption = MoveOption<PlanEntryView>;

function nearDay(date: ISODate, today: ISODate): string | null {
  if (date === today) return 'Today';
  return date === addDays(today, 1) ? 'Tomorrow' : null;
}

function whatHappens(option: DayOption, verb: string): string {
  if (option.refused === 'trade-into-past') return option.other ? `Has ${entryTitle(option.other)}` : 'Can’t go here';
  if (option.refused) return !option.other ? 'Can’t go here' : option.other.outcome === 'skipped' ? 'Skipped' : `${entryTitle(option.other)} was already made`;
  if (!option.other) return 'Nothing planned';
  if (option.leftoversOff.includes(option.other)) return 'Its leftovers come off';
  return `${verb} ${entryTitle(option.other)}`;
}

export function MoveDayList({ options, verb, busy, onPick }: {
  options: DayOption[];
  /** What happens to the meal on the other day: "Trades with", "Takes the place of". */
  verb: string;
  busy: boolean;
  onPick: (date: ISODate) => void;
}) {
  const today = useToday();
  return (
    <div className="move-days">
      {options.map(option => (
        <button key={option.date} className="move-day" disabled={busy || option.refused !== null} onClick={() => onPick(option.date)}>
          <span className="move-day-name">{nearDay(option.date, today) ?? weekdayDate(option.date)}</span>
          <span className="move-day-what">{whatHappens(option, verb)}</span>
          {option.leftoversOff.filter(e => e !== option.other).map(e => (
            <span key={`${e.date}:${e.slot}`} className="move-day-what">{nearDay(e.date, today) ?? weekdayName(e.date)}’s leftovers come off</span>
          ))}
        </button>
      ))}
    </div>
  );
}
