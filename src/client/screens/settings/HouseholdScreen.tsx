// Who's eating, how much a meal should make and when dinner is. Shared by everyone in the house.
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import type { HouseholdView } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useSaveOnLeave } from '../../hooks/useSaveOnLeave.ts';
import { useSaveState, type SaveState } from '../../hooks/useSaveState.ts';
import { Loading, Problem } from '../../ui/Common.tsx';
import { FormField } from '../../ui/FormField.tsx';
import { SaveBar } from '../../ui/SaveNote.tsx';
import { SettingsPage } from './SettingsPage.tsx';

const MOST_PORTIONS = 24;

export function HouseholdScreen() {
  const { data: view, error, reload } = useLoad('household', () => api.household());
  const save = useSaveState();
  return (
    <SettingsPage title="Who’s eating">
      {error && <Problem message={error} onRetry={reload} />}
      {!view && !error && <Loading />}
      {/* A new copy of the form once a save lands, so it shows what the server kept. */}
      {view && <HouseholdForm key={JSON.stringify(view.profile)} view={view} save={save} onSaved={reload} />}
    </SettingsPage>
  );
}

function HouseholdForm({ view, save, onSaved }: { view: HouseholdView; save: SaveState; onSaved: () => Promise<void> }) {
  const { profile } = view;
  const [family, setFamily] = useState(profile.family);
  const [portions, setPortions] = useState(profile.portions);
  const [dinnerTime, setDinnerTime] = useState(profile.dinnerTime);
  const [names, setNames] = useState(profile.members.join(', '));

  const members = names.split(',').map(name => name.trim()).filter(Boolean);
  const changed = family.trim() !== profile.family || portions !== profile.portions || dinnerTime.trim() !== profile.dinnerTime || members.join() !== profile.members.join();
  const valid = dinnerTime.trim() !== '';

  const persist = () => save.run(async () => {
    await api.saveHousehold({ family: family.trim(), portions, dinnerTime: dinnerTime.trim(), members });
    announceChange();
    await onSaved();
  });
  useSaveOnLeave(changed && valid && save.phase !== 'saving', persist);

  return (
    <>
      {!view.isSetUp && <p className="notice">Start here. Claude plans and writes recipes for the people you describe.</p>}
      <FormField label="The family" htmlFor="household-family" help="In your own words. Claude plans and writes recipes for these people.">
        <textarea id="household-family" className="field" rows={2} value={family} onChange={e => setFamily(e.target.value)}
          placeholder="Two adults, a teenager and a six-year-old" />
      </FormField>
      <FormField inline label="Portions per meal" help="Counted in adult portions. New meals use this; meals already planned stay as they are.">
        <span className="stepper control">
          <button type="button" aria-label="One fewer portion" disabled={portions <= 1} onClick={() => setPortions(portions - 1)}><Minus size={18} /></button>
          <span>{portions}</span>
          <button type="button" aria-label="One more portion" disabled={portions >= MOST_PORTIONS} onClick={() => setPortions(portions + 1)}><Plus size={18} /></button>
        </span>
      </FormField>
      <FormField label="Dinner time" htmlFor="household-dinner" help="Shown beside dinner, and used when planning.">
        <input id="household-dinner" className="field" maxLength={30} value={dinnerTime} onChange={e => setDinnerTime(e.target.value)} placeholder="6:30 PM" />
      </FormField>
      <FormField label="Names" htmlFor="household-names" help="Commas between names. Each phone picks one under Notifications.">
        <input id="household-names" className="field" value={names} onChange={e => setNames(e.target.value)} placeholder="Sam, Alex" />
      </FormField>
      <SaveBar save={save} dirty={changed} disabled={!valid} onSave={persist} />
    </>
  );
}
