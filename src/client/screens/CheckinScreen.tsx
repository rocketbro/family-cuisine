// Where the evening notification lands. First, any earlier days nobody checked in. Step one: what did you eat? Step two: what did it use up?
// Step one is saved by the dictation bar's review sheet, which refreshes this screen.
import { useState } from 'react';
import { useParams } from 'react-router';
import { useBack } from '../navigation/useTabNav.ts';
import { longDate, type ISODate } from '../../domain/dates.ts';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useToday } from '../hooks/useToday.ts';
import { Loading, Problem } from '../ui/Common.tsx';
import { AnyLeft } from './checkin/AnyLeft.tsx';
import { CatchUpDay } from './checkin/CatchUpDay.tsx';
import { CatchUpQuestion } from './checkin/CatchUpQuestion.tsx';
import { CheckinDone } from './checkin/CheckinDone.tsx';
import { MealsStep } from './checkin/MealsStep.tsx';
import { PantryStep } from './checkin/PantryStep.tsx';

export function CheckinScreen() {
  const today = useToday();
  const { date = today } = useParams();
  const { data, error, reload } = useLoad(`checkin:${date}`, () => Promise.all([api.checkin(date), api.recipes()]));
  const [saving, setSaving] = useState(false);
  const [openDay, setOpenDay] = useState<ISODate | null>(null);
  const back = useBack();

  if (error) return <div className="page"><Problem message={error} onRetry={reload} /></div>;
  if (!data) return <div className="page"><Loading /></div>;
  const [view, recipes] = data;

  const save = async (work: () => Promise<unknown>) => {
    setSaving(true);
    try { await work(); await reload(); } finally { setSaving(false); }
  };

  if (openDay) return <CatchUpDay date={openDay} onDone={() => { setOpenDay(null); void reload(); }} />;
  const asking = view.step === 'meals' ? view.earlier[0] : undefined;
  if (asking) return <CatchUpQuestion key={asking.date} date={date} day={asking} onAnswered={reload} onOpen={setOpenDay} />;

  if (view.step === 'done') return <CheckinDone date={date} onBack={back} />;

  return (
    <div className="page">
      <span className="eyebrow">{longDate(date)}</span>
      <h1 style={{ marginTop: 6 }}>{view.step === 'meals' ? 'What did we eat?' : 'What did it use up?'}</h1>

      {view.step === 'meals' && (
        <MealsStep date={date} meals={view.meals} recipes={recipes} saving={saving} onAsPlanned={() => save(() => api.ateAsPlanned(date))} />
      )}
      {view.anyLeft && <AnyLeft date={date} answer={view.anyLeft.answer} />}
      {view.step === 'pantry' && (
        <PantryStep date={date} questions={view.questions} carried={view.carried} askingLeft={view.anyLeft !== null} saving={saving} onSubmit={report => save(() => api.recordPantry(date, report))} />
      )}
    </div>
  );
}
