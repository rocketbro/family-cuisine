// "In the fridge": bits to use up that aren't pantry stock. Said or typed in the family's words, gone by
// themselves after a few days. Claude sees them when planning and rolling the dice; nothing else does.
import { Mic, Refrigerator } from 'lucide-react';
import { useState } from 'react';
import { FRIDGE_DAYS, FRIDGE_TEXT_MAX, fridgeAge } from '../../../domain/fridge.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { useFieldDictation } from '../../dictation/useFieldDictation.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useToday } from '../../hooks/useToday.ts';
import { Problem } from '../../ui/Common.tsx';

export function FridgeList() {
  const { data, error, reload } = useLoad('fridge', () => api.fridge());
  const today = useToday();
  const dictation = useDictation();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const listen = useFieldDictation('fridge', 'What’s in the fridge to use up', said => setText(now => (now.trim() ? `${now.trim()}, ${said}` : said)));

  const run = async (work: () => Promise<unknown>): Promise<boolean> => {
    setProblem(null);
    try {
      await work();
      announceChange();
      return true;
    } catch (e) {
      setProblem((e as Error).message);
      return false;
    }
  };
  const add = async () => {
    if (text.trim() && await run(() => api.addToFridge(text))) setText('');
  };
  const lines = data ?? [];

  return (
    <section className="section fridge">
      <div className="category-head">
        <Refrigerator size={18} />
        <span className="eyebrow grow">In the fridge</span>
        {lines.length > 0 && <span className="faint small">{lines.length}</span>}
      </div>
      {lines.length > 0 && (
        <div className="list">
          {lines.map(line => (
            <div key={line.id} className="list-row">
              <div className="grow">
                {line.text}
                <div className="faint small">{fridgeAge(line, today)}</div>
              </div>
              <button className="button quiet" onClick={() => void run(() => api.usedUpFromFridge(line.id))}>Used up</button>
            </div>
          ))}
        </div>
      )}
      <form className="fridge-add" onSubmit={e => { e.preventDefault(); void add(); }}>
        <div className="row">
          <input className="field" aria-label="Add to the fridge" maxLength={FRIDGE_TEXT_MAX} placeholder="sautéed onions, peppers and black beans" value={text} onChange={e => setText(e.target.value)} />
          <button type="button" className="icon-button" aria-label="Say it instead" disabled={dictation.phase !== 'idle'} onClick={listen}><Mic size={20} /></button>
          {text.trim() && <button className="button">Add</button>}
        </div>
        <p className="form-field-help">Cooked bits to use up, not stock. Claude plans around them first. They drop off after {FRIDGE_DAYS} days.</p>
      </form>
      {(problem ?? error) && <Problem message={(problem ?? error)!} onRetry={reload} />}
    </section>
  );
}
