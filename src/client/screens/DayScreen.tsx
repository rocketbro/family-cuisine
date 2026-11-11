// The home screen: today's three meals. Also any other day, from the Plan tab.
import { useParams } from 'react-router';
import { TabLink } from '../navigation/TabLink.tsx';
import { addDays, longDate } from '../../domain/dates.ts';
import { minutesOf } from '../../domain/job-run.ts';
import { mealsOnly } from '../../domain/plan-slot.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useHour, useMinutes, useToday } from '../hooks/useToday.ts';
import { ClipboardList, Settings } from 'lucide-react';
import { Loading, Problem } from '../ui/Common.tsx';
import { ExtrasSection } from '../ui/ExtrasSection.tsx';
import { MealCard } from '../ui/MealCard.tsx';
import { MealsOffNote } from '../ui/MealsOffNote.tsx';
import { TidyUpCards } from '../ui/TidyUpCards.tsx';
import { TomorrowNote } from '../ui/NightBeforeNote.tsx';

export function DayScreen() {
  const params = useParams();
  const today = useToday();
  const hour = useHour();
  const minutes = useMinutes();
  const date = params.date ?? today;
  const isToday = date === today;
  const { data, error, reload } = useLoad(`day:${date}`, () => Promise.all([api.plan(date, addDays(date, 1)), api.status(), api.checkin(date), api.household()]));

  if (error) return <div className="page"><Problem message={error} onRetry={reload} /></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const [planned, status, checkin, household] = data;
  const entries = planned.filter(entry => entry.date === date);
  const tomorrow = planned.filter(entry => entry.date !== date);
  const [weekday, rest] = longDate(date).split(', ');
  const eveningDone = checkin.step === 'done';
  const meals = mealsOnly(entries);
  const showCheckin = isToday && !eveningDone && hour >= 19;

  return (
    <div className="page wide">
      <div className="spread title-row">
        <h1>{weekday}</h1>
        {!params.date && <TabLink to="/settings" className="icon-button phone-only" aria-label="Settings"><Settings size={22} /></TabLink>}
      </div>
      <p className="muted italic" style={{ fontSize: '1.15rem' }}>{rest}</p>

      {showCheckin && (
        <TabLink to={`/checkin/${date}`} className="banner" style={{ marginTop: 18 }}>
          <div className="eyebrow">This evening</div>
          <div style={{ fontSize: '1.15rem', marginTop: 4 }}>How did today go? Tell us what you ate.</div>
        </TabLink>
      )}

      {isToday && !household.isSetUp && (
        <TabLink to="/settings/household" className="banner" style={{ marginTop: 18 }}>
          <div className="eyebrow">Getting started</div>
          <div style={{ fontSize: '1.15rem', marginTop: 4 }}>Tell Cuisine who’s eating, so meals come out the right size.</div>
        </TabLink>
      )}

      {isToday && minutes >= minutesOf(household.schedule.nightBeforeTime) && <TomorrowNote entries={tomorrow} />}

      <MealsOffNote date={date} today={today} />
      {isToday && <TidyUpCards />}

      {meals.length === 0 ? (
        <div className="section stack">
          <p className="muted">No meals planned.</p>
          <TabLink to="/week" tab="week" className="button"><ClipboardList size={18} /> Go to Plan</TabLink>
        </div>
      ) : (
        <div className="meals">
          {meals.map(entry => <MealCard key={entry.slot} entry={entry} timeNote={entry.slot === 'dinner' ? status.dinnerTime : undefined} />)}
        </div>
      )}

      <ExtrasSection date={date} entries={entries} schedule={status.shopping} />

      {!isToday && (
        <p className="section"><TabLink to={`/checkin/${date}`} className="link-button">Record what we ate this day</TabLink></p>
      )}
    </div>
  );
}
