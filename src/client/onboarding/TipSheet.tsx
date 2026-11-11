// A tip: a title, a few one-line bullets and one button.
import { Sheet } from '../ui/Sheet.tsx';
import type { Tip } from './tips.ts';

export function TipSheet({ tip, onClose }: { tip: Tip; onClose: () => void }) {
  return (
    <Sheet title={tip.title} onClose={onClose} footer={<button className="button wide" onClick={onClose}>Got it</button>}>
      <ul className="tip-list">
        {tip.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}
      </ul>
    </Sheet>
  );
}
