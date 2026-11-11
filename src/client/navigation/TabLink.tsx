// A link to another screen in the same tab. Use it (or useOpen) for every in-app link that
// isn't the tab bar, so back knows where to return.
import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import type { NavState, TabId } from './tabs.ts';
import { useChildState } from './useTabNav.ts';

/** With `tab`, it crosses over to that tab instead, as `useSwitchTab` does, and this tab stays where it was. */
export function TabLink({ tab, ...props }: Omit<ComponentProps<typeof Link>, 'state'> & { tab?: TabId }) {
  const child = useChildState();
  return <Link {...props} state={tab ? { tab } satisfies NavState : child} />;
}
