// Shows each screen's first-visit tip, from one place. It never covers an open sheet, never
// shows before a screen has loaded, waits for the household to be set up, and shows at most one
// tip per screen visited. Screens know nothing about it.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { hasSeen, markSeen, onTipsForgotten } from './tip-memory.ts';
import { tipForPath } from './tip-route.ts';
import { TipSheet } from './TipSheet.tsx';
import { TIPS, type TipId } from './tips.ts';
import { whenSettled } from './when-settled.ts';

export function OnboardingHost() {
  const { pathname } = useLocation();
  const { data: household } = useLoad('household', () => api.household());
  const ready = household?.isSetUp === true;
  const [open, setOpen] = useState<TipId | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => onTipsForgotten(() => setAgain(n => n + 1)), []);

  useEffect(() => {
    setOpen(null);
    const id = tipForPath(pathname);
    if (!ready || !id || hasSeen(id)) return;
    return whenSettled(() => {
      markSeen(id);
      setOpen(id);
    });
  }, [pathname, ready, again]);

  return open ? <TipSheet tip={TIPS[open]} onClose={() => setOpen(null)} /> : null;
}
