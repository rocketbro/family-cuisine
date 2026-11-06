// Moving around inside a tab: open a screen (it remembers where it came from) and go back.
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { historyIndex, memory } from './history.ts';
import { parentOf, pathOf, tabOf, type NavState, type TabId } from './tabs.ts';

const MOST_STEPS = 4;

export function useOpen(): (to: string, options?: { replace?: boolean }) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback((to, options) => {
    const state: NavState = { tab: tabOf(location), back: pathOf(location) };
    navigate(to, { state, replace: options?.replace });
  }, [navigate, location]);
}

/** The state an in-app link should carry, for components that render <Link>. */
export function useChildState(): NavState {
  const location = useLocation();
  return { tab: tabOf(location), back: pathOf(location) };
}

/** Back to a screen further up this tab's stack, past any in between (the picker, once a goal is added). */
export function useReturnTo(): (target: string) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(target => {
    const index = historyIndex();
    memory.restoreNext();
    for (let steps = 1; index !== null && steps <= Math.min(index, MOST_STEPS); steps++) {
      if (memory.pathAt(index - steps) === target) { navigate(-steps); return; }
    }
    navigate(target, { replace: true, state: { tab: tabOf(location) } satisfies NavState });
  }, [navigate, location]);
}

/** Over to another tab, which then keeps its own stack. This tab stays where it was for coming back. */
export function useSwitchTab(): (tab: TabId, to: string) => void {
  const navigate = useNavigate();
  return useCallback((tab, to) => {
    navigate(to, { state: { tab } satisfies NavState });
  }, [navigate]);
}

export function useBack(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const state = location.state as NavState | null;
    const tab = tabOf(location);
    const target = state?.back ?? parentOf(location.pathname, tab);
    const index = historyIndex();
    memory.restoreNext();
    // Step back through real history when the previous entry is where we're going; otherwise
    // replace this screen with its parent, so back always lands in the same tab.
    if (index !== null && index > 0 && memory.pathAt(index - 1) === target) navigate(-1);
    else navigate(target, { replace: true, state: { tab } satisfies NavState });
  }, [navigate, location]);
}
