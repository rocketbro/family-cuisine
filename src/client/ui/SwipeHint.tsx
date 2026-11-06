// Swipes can't be seen, so each phone is told about them once.
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { usePreferences } from '../preferences.ts';
import { Sheet } from './Sheet.tsx';

export function SwipeHint() {
  const [prefs, update] = usePreferences();
  if (prefs.swipeHintSeen || !window.matchMedia('(pointer: coarse)').matches) return null;
  const dismiss = () => update({ swipeHintSeen: true });
  return (
    <Sheet title="Swipe a meal" onClose={dismiss} footer={<button className="button wide" onClick={dismiss}>OK</button>}>
      <div className="stack">
        <p className="row" style={{ margin: 0, gap: 12 }}><ArrowRight size={20} style={{ flex: 'none' }} /> Swipe right to mark it done.</p>
        <p className="row" style={{ margin: 0, gap: 12 }}><ArrowLeft size={20} style={{ flex: 'none' }} /> Swipe left to swap it for something else.</p>
      </div>
    </Sheet>
  );
}
