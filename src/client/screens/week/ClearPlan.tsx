// Taking everything still to come off the plan. What's been eaten and past days stay, so it says how many
// meals will go and asks once. With nothing to take off, there's no button.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useToday } from '../../hooks/useToday.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { Problem } from '../../ui/Common.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

export function ClearPlan() {
  const today = useToday();
  const { data } = useLoad(`plan-upcoming:${today}`, () => api.upcomingPlan());
  const [asking, setAsking] = useState(false);
  const [clearing, setClearing] = useState(false);
  const write = useWrite();
  const meals = data?.meals ?? 0;
  if (!meals && !asking) return null;

  const clear = async () => {
    setClearing(true);
    const cleared = await write.run(async () => {
      await api.clearUpcomingPlan();
      announceChange();
    });
    setClearing(false);
    if (cleared) setAsking(false);
  };

  return (
    <>
      <button className="button quiet danger wide section" onClick={() => setAsking(true)}><Trash2 size={18} /> Clear the plan</button>
      {asking && (
        <Sheet title="Clear the plan?" onClose={() => setAsking(false)} holdOpen={clearing} footer={(
          <div className="row">
            <button className="button quiet grow" disabled={clearing} onClick={() => setAsking(false)}>Keep</button>
            <button className="button danger grow" disabled={clearing} onClick={clear}>{clearing ? 'Clearing…' : 'Clear'}</button>
          </div>
        )}>
          <p style={{ marginTop: 0 }}>This removes {meals} {meals === 1 ? 'meal' : 'meals'} you haven’t eaten yet.</p>
          {write.problem && <Problem message={write.problem} />}
        </Sheet>
      )}
    </>
  );
}
