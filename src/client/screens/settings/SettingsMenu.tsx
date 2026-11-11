// Everything on Settings past this phone's look: a row for each screen, saying what's set there.
import { useEffect, useState } from 'react';
import type { Status } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useToday } from '../../hooks/useToday.ts';
import { usePreferences } from '../../preferences.ts';
import { pushEnabled, pushSupport } from '../../push.ts';
import { SettingRow } from './SettingRow.tsx';
import { avoidedSummary, cookingSummary, householdSummary, notificationSummary, planningSummary, shoppingSummary, stockUpSummary } from './setting-summaries.ts';

const WAITING = '…';

export function SettingsMenu({ status }: { status: Status | null }) {
  const [prefs] = usePreferences();
  const today = useToday();
  const { data: household } = useLoad('household', () => api.household());
  const { data: notes } = useLoad('kitchen-notes', () => api.kitchenNotes());
  const { data: goals } = useLoad('stock-up', () => api.stockUp());
  const { data: avoided } = useLoad('avoided-meals', () => api.avoidedMeals());
  const [pushOn, setPushOn] = useState(false);
  useEffect(() => { void pushEnabled().then(setPushOn); }, []);

  return (
    <nav className="section setting-rows" aria-label="More settings">
      <SettingRow to="/settings/household" title="Who’s eating" ask={household?.isSetUp === false}
        value={household ? householdSummary(household.profile, household.isSetUp) : WAITING} />
      <SettingRow to="/settings/shopping" title="Shopping" value={status ? shoppingSummary(today, status.shopping) : WAITING} />
      <SettingRow to="/settings/planning" title="Planning" value={household ? planningSummary(household.automaticPlanning) : WAITING} />
      <SettingRow to="/settings/cooking" title="How we cook" value={notes ? cookingSummary(notes.notes) : WAITING} />
      <SettingRow to="/settings/stock-up" title="Stock up" value={goals ? stockUpSummary(goals.map(g => g.name)) : WAITING} />
      <SettingRow to="/settings/avoided" title="Claude won’t suggest" value={avoided ? avoidedSummary(avoided.length) : WAITING} />
      <SettingRow to="/settings/notifications" title="Notifications"
        value={status ? notificationSummary({ support: pushSupport(), serverReady: status.pushKey !== null, on: pushOn, person: prefs.person }) : WAITING} />
    </nav>
  );
}
