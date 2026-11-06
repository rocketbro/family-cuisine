// How this family always cooks, typed or said. Claude follows it in every plan and recipe.
import { Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { useFieldDictation } from '../../dictation/useFieldDictation.ts';
import { useSaveOnLeave } from '../../hooks/useSaveOnLeave.ts';
import { useSaveState } from '../../hooks/useSaveState.ts';
import { Problem } from '../../ui/Common.tsx';
import { SaveBar } from '../../ui/SaveNote.tsx';
import { SettingsPage } from './SettingsPage.tsx';

const FEWEST_ROWS = 8;

export function CookingScreen() {
  const [saved, setSaved] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const save = useSaveState();
  const dictation = useDictation();

  useEffect(() => {
    api.kitchenNotes().then(({ notes }) => { setSaved(notes); setText(notes); }, (e: Error) => setLoadProblem(e.message));
  }, []);

  // Only once the notes are in: until then, loading them would write over any words that landed.
  const listen = useFieldDictation('kitchen-notes', 'How you cook', said => {
    setText(current => (current.trim() ? `${current.trim()}\n${said}` : said));
  }, saved !== null);

  const changed = saved !== null && text.trim() !== saved;
  const persist = () => save.run(async () => {
    await api.setKitchenNotes(text);
    setSaved(text.trim());
    setText(text.trim());
    announceChange();
  });
  useSaveOnLeave(changed && save.phase !== 'saving', persist);

  return (
    <SettingsPage title="How we cook"
      intro="Claude follows this when it plans a meal or writes a recipe. Recipes already saved don’t change."
      action={<button type="button" className="icon-button" aria-label="Say it instead" disabled={dictation.phase !== 'idle'} onClick={listen}><Mic size={22} /></button>}>
      {loadProblem && <Problem message={loadProblem} />}
      <textarea id="kitchen-notes" className="field" aria-label="How we cook" disabled={saved === null} value={text} onChange={e => setText(e.target.value)}
        rows={Math.max(FEWEST_ROWS, text.split('\n').length + 4)}
        placeholder="Butter, never margarine. No cilantro. We have a stand mixer. “Stock” and “broth” are the same thing here." />
      <SaveBar save={save} dirty={changed} onSave={persist} />
    </SettingsPage>
  );
}
