// One tap on what's left of dinner. It saves straight away, and tapping the other one changes it.
import { useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import type { DinnerLeft } from '../../../domain/dinner-left.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useWrite } from '../../hooks/useWrite.ts';

const CHOICES: { value: DinnerLeft; label: string }[] = [{ value: 'some', label: 'Yes, some' }, { value: 'none', label: 'No, all gone' }];

export function AnyLeft({ date, answer }: { date: ISODate; answer: DinnerLeft | null }) {
  const [chosen, setChosen] = useState(answer);
  const write = useWrite();
  const choose = async (value: DinnerLeft) => {
    if (await write.run(() => api.sayAnyLeft(date, value))) {
      setChosen(value);
      announceChange();
    }
  };
  return (
    <section className="section">
      <span className="eyebrow">Any dinner left?</span>
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        {CHOICES.map(({ value, label }) => (
          <button key={value} className="chip" aria-pressed={chosen === value} onClick={() => void choose(value)}>{label}</button>
        ))}
      </div>
      {write.problem && <p className="error">{write.problem}</p>}
    </section>
  );
}
