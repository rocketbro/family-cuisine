// Where the evening notification lands. Step one: what did you eat? Step two: what did it use up?
// Step one is saved by the dictation bar's review sheet, which refreshes this screen.
import { useState } from 'react';
import { useParams } from 'react-router';
import { useBack } from '../navigation/useTabNav.ts';
import { longDate } from '../../domain/dates.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useToday } from '../hooks/useToday.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { MealsStep } from './checkin/MealsStep.tsx';
import { PantryStep } from './checkin/PantryStep.tsx';

export function CheckinScreen() {
  const today = useToday();
  const { date = today } = useParams();
  const { data, error, reload } = useLoad(`checkin:${date}`, () => Promise.all([api.checkin(date), api.recipes()]));
  const [saving, setSaving] = useState(false);
  const back = useBack();

  if (error) return <div className="page"><Problem message={error} onRetry={reload} /></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const [view, recipes] = data;

  const save = async (work: () => Promise<unknown>) => {
    setSaving(true);
    try { await work(); await reload(); } finally { setSaving(false); }
  };

  return (
    <div className="page">
      <span className="eyebrow">{longDate(date)}</span>
      <h1 style={{ marginTop: 6 }}>{view.step === 'done' ? 'All set' : view.step === 'meals' ? 'What did we eat?' : 'What did it use up?'}</h1>

      {view.step === 'meals' && (
        <MealsStep date={date} meals={view.meals} recipes={recipes} saving={saving} onAsPlanned={() => save(() => api.ateAsPlanned(date))} />
      )}
      {view.step === 'pantry' && (
        <PantryStep date={date} questions={view.questions} carried={view.carried} saving={saving} onSubmit={report => save(() => api.recordPantry(date, report))} />
      )}
      {view.step === 'done' && (
        <div className="section stack">
          <p className="muted" style={{ fontSize: '1.1rem' }}>The pantry is up to date. Good night.</p>
          <button className="button quiet" onClick={back}>Back to today</button>
        </div>
      )}
    </div>
  );
}
