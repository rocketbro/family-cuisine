// "Done making this": the meal is recorded straight away, and the model works out the pantry
// changes for a look over. If those aren't saved, the evening check-in settles the meal instead.
import { Keyboard, Mic } from 'lucide-react';
import { useState } from 'react';
import type { PlanSlot } from '../../../domain/plan-slot.ts';
import type { Substitutions } from '../../../domain/substitutes.ts';
import type { ListenContext } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { Sheet } from '../../ui/Sheet.tsx';

type Props = {
  slug: string;
  title: string;
  factor: number;
  planned: { date: string; slot: PlanSlot } | null;
  aiOn: boolean;
  substituted: Substitutions;
  onClose: () => void;
  onDone: () => void;
};

export function DoneSheet({ slug, title, factor, planned, aiOn, substituted, onClose, onDone }: Props) {
  const dictation = useDictation();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = `Notes on ${title}`;

  const finish = async (then: (context: ListenContext) => Promise<void> | void) => {
    try {
      const meal = await api.cooked(slug, factor, planned, substituted);
      announceChange();
      onDone();
      if (aiOn) await then({ kind: 'cooked', date: meal.date, slot: meal.slot, slug, factor, substituted });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Sheet title="Nicely done" onClose={onClose} footer={
      typing
        ? <button className="button wide" disabled={!text.trim()} onClick={() => finish(c => dictation.send(text, c, label))}>Save</button>
        : <button className="button quiet wide" onClick={() => finish(c => dictation.send('', c, label))}>Made it as written</button>
    }>
      <p className="muted">{aiOn ? "Anything different from the recipe? Something swapped, left out, or used up? We'll fix the pantry." : "This evening's check-in will take care of the pantry."}</p>
      {dictation.holding && aiOn && <p className="small muted">“{dictation.holding}” isn’t finished yet, so anything you type here goes right after it. To talk instead, finish that first.</p>}
      {typing ? (
        <textarea
          className="field"
          autoFocus
          placeholder="Used Greek yogurt instead of buttermilk, and that was the last of the flour."
          value={text}
          onChange={e => setText(e.target.value)}
        />
      ) : aiOn && (
        <div className="row">
          <button className="button grow" disabled={Boolean(dictation.holding)} onClick={() => finish(c => dictation.start(c, label))}><Mic size={18} /> Say what changed</button>
          <button className="button quiet" aria-label="Type instead" onClick={() => setTyping(true)}><Keyboard size={18} /></button>
        </div>
      )}
      {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
    </Sheet>
  );
}
