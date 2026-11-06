// A link to another screen in the same tab. Use it (or useOpen) for every in-app link that
// isn't the tab bar, so back knows where to return.
import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import { useChildState } from './useTabNav.ts';

export function TabLink(props: Omit<ComponentProps<typeof Link>, 'state'>) {
  return <Link {...props} state={useChildState()} />;
}
