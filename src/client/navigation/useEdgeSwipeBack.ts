// Swipe in from the left edge to go back. Safari does this itself, but a home-screen app
// gets no back gesture on iPhone, so the installed app does it here. Back stays inside the
// tab you're in (see useBack); tab roots have nowhere to go back to.
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { isTabRoot } from './tabs.ts';
import { useBack } from './useTabNav.ts';

export const EDGE = 28;       // px from the left edge where a swipe may start
const TRIGGER = 90;    // px of travel that counts as "back"

export function useEdgeSwipeBack(): void {
  const back = useBack();
  const { pathname } = useLocation();

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone || isTabRoot(pathname)) return;

    let start: { x: number; y: number } | null = null;
    let dx = 0;
    let done = false;
    const page = () => document.querySelector<HTMLElement>('.page');

    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      const blocked = document.body.classList.contains('sheet-open') || e.touches.length > 1;
      start = t.clientX <= EDGE && !blocked ? { x: t.clientX, y: t.clientY } : null;
      dx = 0;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      dx = t.clientX - start.x;
      if (Math.abs(t.clientY - start.y) > Math.abs(dx)) { start = null; reset(); return; }
      const el = page();
      if (el && dx > 0) { el.style.transition = 'none'; el.style.transform = `translateX(${dx * 0.5}px)`; }
    };
    const up = () => {
      const go = start !== null && dx > TRIGGER && !done;
      start = null;
      reset();
      if (go) { done = true; back(); }
    };
    const reset = () => {
      const el = page();
      if (el) { el.style.transition = 'transform 0.2s ease'; el.style.transform = ''; }
    };

    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
      const el = page();
      if (el) el.style.transform = '';
    };
  }, [pathname, back]);
}
