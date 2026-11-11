// What Claude just changed on a screen under review, that it isn't saved, and taking it back.
import { Sparkles } from 'lucide-react';

export function ClaudeNote({ words, onUndo }: { words: string; onUndo: () => void }) {
  return (
    <div className="revision-note" role="status">
      <Sparkles size={16} aria-hidden="true" />
      <p className="grow">{words} Not saved yet.</p>
      <button className="subs-link" style={{ marginTop: 0 }} onClick={onUndo}>Undo</button>
    </div>
  );
}
