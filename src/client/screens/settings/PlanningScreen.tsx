// What the app plans without being asked.
import { clockText } from '../../../domain/household.ts';
import type { AutomaticPlanning } from '../../../domain/automatic-planning.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useSaveState } from '../../hooks/useSaveState.ts';
import { Loading, Segmented } from '../../ui/Common.tsx';
import { FormField } from '../../ui/FormField.tsx';
import { SaveNote } from '../../ui/SaveNote.tsx';
import { SettingsPage } from './SettingsPage.tsx';

const ON_OFF = [{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }] as const;

export function PlanningScreen() {
  const { data: view } = useLoad('household', () => api.household());
  const save = useSaveState();
  if (!view) return <SettingsPage title="Planning"><Loading /></SettingsPage>;
  const { automaticPlanning: choice, schedule } = view;
  const change = (next: AutomaticPlanning) => save.run(async () => {
    await api.setAutomaticPlanning(next);
    announceChange();
  });

  return (
    <SettingsPage title="Planning">
      {choice.held && (
        <div className="notice spread" style={{ marginBottom: 20 }}>
          <span>Paused since you cleared the plan.</span>
          <button className="button quiet" disabled={save.phase === 'saving'} onClick={() => change({ ...choice, held: false })}>Start again</button>
        </div>
      )}
      <FormField label="Plan on grocery mornings" help={`Plans the meals for each trip that morning, at ${clockText(schedule.planTime)}.`}>
        <Segmented label="Plan on grocery mornings" options={[...ON_OFF]} value={choice.tripMorning ? 'on' : 'off'} disabled={save.phase === 'saving'}
          onChange={value => change({ ...choice, tripMorning: value === 'on' })} />
      </FormField>
      <FormField label="Nightly top-up" help="Fills in today and tomorrow overnight if they have open meals.">
        <Segmented label="Nightly top-up" options={[...ON_OFF]} value={choice.nightly ? 'on' : 'off'} disabled={save.phase === 'saving'}
          onChange={value => change({ ...choice, nightly: value === 'on' })} />
      </FormField>
      <SaveNote save={save} />
    </SettingsPage>
  );
}
