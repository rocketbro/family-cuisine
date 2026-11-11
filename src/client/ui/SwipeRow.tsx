// A row with an action on each side: swipe right for one, left for the other. Touch only, and it
// leaves the browser's vertical scrolling and the app's edge swipe back alone.
import { useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { EDGE } from '../navigation/useEdgeSwipeBack.ts';

/** Travel before a touch counts as a sideways swipe, and before letting go triggers the action. */
const STARTS_AT = 10;
const TRIGGER = 72;
const MOST_TRAVEL = 120;

type Props = {
  children: ReactNode;
  onSwipeRight: () => void;
  /** Left out when there's nothing to do that way. */
  onSwipeLeft?: () => void;
  rightMark: ReactNode;
  leftMark: ReactNode;
};

export function SwipeRow({ children, onSwipeRight, onSwipeLeft, rightMark, leftMark }: Props) {
  const row = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  const justSwiped = useRef(false);
  const travel = useRef(0);

  const show = (dx: number, animated: boolean) => {
    if (!content.current || !row.current) return;
    content.current.style.transition = animated ? 'transform 0.2s ease' : 'none';
    content.current.style.transform = dx ? `translateX(${dx}px)` : '';
    row.current.dataset.swipe = dx > 0 ? 'right' : dx < 0 ? 'left' : '';
  };

  const down = (e: PointerEvent) => {
    start.current = e.pointerType === 'touch' && e.clientX > EDGE ? { x: e.clientX, y: e.clientY } : null;
    swiping.current = false;
    justSwiped.current = false;
    travel.current = 0;
  };

  const move = (e: PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    if (!swiping.current) {
      if (Math.abs(e.clientY - start.current.y) > STARTS_AT) { start.current = null; return; }
      if (Math.abs(dx) < STARTS_AT) return;
      swiping.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const allowed = (dx > 0 ? !onSwipeRight : !onSwipeLeft) ? 0 : Math.sign(dx) * Math.min(Math.abs(dx), MOST_TRAVEL);
    travel.current = allowed;
    show(allowed, false);
  };

  const up = () => {
    if (!swiping.current) return;
    justSwiped.current = true;
    swiping.current = false;
    start.current = null;
    show(0, true);
    if (travel.current >= TRIGGER) onSwipeRight();
    else if (travel.current <= -TRIGGER) onSwipeLeft?.();
  };

  const cancel = () => {
    start.current = null;
    swiping.current = false;
    show(0, true);
  };

  // The finger that swiped shouldn't also tap through to the recipe.
  const click = (e: MouseEvent) => {
    if (!justSwiped.current) return;
    justSwiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={row} className="swipe-row" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onClickCapture={click}>
      <div className="swipe-mark swipe-mark-right" aria-hidden="true">{rightMark}</div>
      <div className="swipe-mark swipe-mark-left" aria-hidden="true">{leftMark}</div>
      <div ref={content} className="swipe-content">{children}</div>
    </div>
  );
}
