// Says what Claude changed in the form, that it isn't saved, and takes it back on request.
import { Sparkles } from 'lucide-react';
import { fieldsInWords, markedFields, type Revision } from './revision-history.ts';

export function RevisionNote({ history, onUndo }: { history: readonly Revision[]; onUndo: () => void }) {
  const last = history.at(-1);
  if (!last) return null;
  const marked = [...markedFields(history)];
  return (
    <div className="revision-note" role="status">
      <Sparkles size={16} aria-hidden="true" />
      <p className="grow">
        <strong>{marked.length ? `Claude changed ${fieldsInWords(marked)}.` : 'Claude didn’t change anything.'}</strong>
        {last.note && ` ${last.note}`}
        {marked.length > 0 && ' Not saved yet.'}
      </p>
      {last.changed.length > 0 && <button className="subs-link" style={{ marginTop: 0 }} onClick={onUndo}>Undo</button>}
    </div>
  );
}
