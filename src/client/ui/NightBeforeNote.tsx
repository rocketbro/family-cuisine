// The quiet line under a planned meal whose night-before step is due tonight or was due last night,
// and the Today screen's look ahead at tomorrow, once the evening's reminder time has come.
import { Moon } from 'lucide-react';
import { dueForMeal, nightBeforeLine } from '../../domain/night-before.ts';
import { nightBeforeNotice, nightBeforeTasks } from '../../domain/night-before-reminder.ts';
import type { PlanEntryView } from '../../shared/views.ts';
import { useToday } from '../hooks/useToday.ts';
import { TabLink } from '../navigation/TabLink.tsx';

export function NightBeforeNote({ entry }: { entry: PlanEntryView }) {
  const today = useToday();
  const step = entry.recipe?.nightBefore;
  const due = step ? dueForMeal(entry, today) : null;
  if (!step || !due) return null;
  return <p className="night-before small muted"><Moon size={14} aria-hidden="true" /><span>{nightBeforeLine(step, due)}</span></p>;
}

export function TomorrowNote({ entries }: { entries: readonly PlanEntryView[] }) {
  const notice = nightBeforeNotice(nightBeforeTasks(entries, slug => entries.find(e => e.recipeSlug === slug)?.recipe));
  if (!notice) return null;
  return (
    <TabLink to={notice.url} className="night-before tomorrow small muted">
      <Moon size={14} aria-hidden="true" /><span>{notice.title}. {notice.body}</span>
    </TabLink>
  );
}
