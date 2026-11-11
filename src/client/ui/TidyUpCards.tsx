// Questions the tidy-up left for the household: a line, a few answers, and a × that means leave it. Quiet, like MealsOffNote.
import { X } from 'lucide-react';
import { api } from '../api.ts';
import { announceChange } from '../data-events.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { useWrite } from '../hooks/useWrite.ts';

export function TidyUpCards() {
  const { data } = useLoad('tidy-up', () => api.tidyUp());
  const write = useWrite();
  if (!data?.cards.length) return null;

  const run = (act: () => Promise<unknown>) => void write.run(async () => { await act(); announceChange(); });

  return (
    <div className="section stack">
      {data.cards.map(card => (
        <div key={card.id} className="notice stack">
          <div className="spread">
            <div className="grow">{card.question}</div>
            <button className="icon-button" aria-label="Leave it" onClick={() => run(() => api.leaveTidyQuestion(card.id))}>
              <X size={18} />
            </button>
          </div>
          <div className="tidy-answers">
            {card.answers.map((label, index) => (
              <button key={label} className="button quiet small" onClick={() => run(() => api.answerTidyQuestion(card.id, index))}>{label}</button>
            ))}
          </div>
        </div>
      ))}
      {write.problem && <p className="error">{write.problem}</p>}
    </div>
  );
}
