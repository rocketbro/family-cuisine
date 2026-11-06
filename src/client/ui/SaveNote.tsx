// Says what became of a save. SaveBar puts it together with the Save button.
import { Check } from 'lucide-react';
import type { SaveState } from '../hooks/useSaveState.ts';

export function SaveNote({ save, saving = 'Saving…', saved = 'Saved' }: { save: SaveState; saving?: string; saved?: string }) {
  const text = save.problem ?? (save.phase === 'saving' ? saving : save.phase === 'saved' ? saved : null);
  const look = save.problem ? 'failed' : save.phase === 'saved' ? 'saved' : '';
  return (
    <p className={`save-note ${look}`} role="status">
      {!save.problem && save.phase === 'saved' && <Check size={16} />}
      {text}
    </p>
  );
}

/** For a form saved as a whole: Save while there's something to save, then the note in its place. */
export function SaveBar({ save, dirty, disabled, label = 'Save', onSave }: {
  save: SaveState; dirty: boolean; disabled?: boolean; label?: string; onSave: () => unknown;
}) {
  return (
    <div className="save-bar">
      {dirty && save.phase !== 'saving'
        ? <button type="button" className="button wide" disabled={disabled} onClick={() => void onSave()}>{label}</button>
        : <SaveNote save={save} />}
      {dirty && save.problem && <SaveNote save={save} />}
    </div>
  );
}
