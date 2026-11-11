// This phone's notifications: whose phone it is, turning them on, and what they'll be.
import { useEffect, useState } from 'react';
import { clockText } from '../../../domain/household.ts';
import { api } from '../../api.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useSaveState } from '../../hooks/useSaveState.ts';
import { usePreferences } from '../../preferences.ts';
import { enablePush, pushEnabled, pushSupport } from '../../push.ts';
import { Loading, Segmented } from '../../ui/Common.tsx';
import { FormField } from '../../ui/FormField.tsx';
import { SaveNote } from '../../ui/SaveNote.tsx';
import { NightBeforeTime } from './NightBeforeTime.tsx';
import { SettingsPage } from './SettingsPage.tsx';

export function NotificationsScreen() {
  const [prefs, update] = usePreferences();
  const { data: view } = useLoad('household', () => api.household());
  const { data: status } = useLoad('status', () => api.status());
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const save = useSaveState();
  const support = pushSupport();
  const pushKey = status?.pushKey ?? null;

  useEffect(() => { void pushEnabled().then(setOn); }, []);

  const turnOn = () => save.run(async () => {
    if (pushKey) await enablePush(prefs.person || 'Someone', pushKey);
    setOn(true);
  });
  const choosePerson = (person: string) => {
    update({ person });
    // An existing subscription carries the name it was made with, so it has to hear about this.
    if (on && pushKey && person) void save.run(() => enablePush(person, pushKey));
  };
  const sendTest = () => save.run(async () => {
    const { sent } = await api.testPush();
    setMessage(sent === 1 ? 'Sent to 1 phone.' : `Sent to ${sent} phones.`);
  });

  if (!view) return <SettingsPage title="Notifications"><Loading /></SettingsPage>;
  // A phone keeps the name it chose, even if the list of names changes later.
  const { schedule, profile } = view;
  const names = prefs.person && !profile.members.includes(prefs.person) ? [...profile.members, prefs.person] : profile.members;

  return (
    <SettingsPage title="Notifications">
      <FormField label="Whose phone is this" htmlFor={names.length ? undefined : 'whose-phone'} help="Kept on this phone. Add more names under Who’s eating.">
        {names.length > 0
          ? <Segmented label="Whose phone" value={prefs.person} onChange={choosePerson} options={names.map(name => ({ value: name, label: name }))} />
          : <input id="whose-phone" className="field" placeholder="Your name" value={prefs.person} onChange={e => update({ person: e.target.value })} />}
      </FormField>

      <FormField label="On this phone">
        {support === 'install' && <p className="notice" style={{ margin: 0 }}>On iPhone, tap Share → Add to Home Screen, then open Cuisine from there to turn these on.</p>}
        {support === 'unsupported' && <p className="notice" style={{ margin: 0 }}>This browser can’t get notifications.</p>}
        {support === 'ok' && !pushKey && <p className="notice" style={{ margin: 0 }}>Notifications aren’t set up on the server yet. The README explains how.</p>}
        {support === 'ok' && pushKey && (on
          ? <button className="button quiet wide" disabled={save.phase === 'saving'} onClick={sendTest}>Notifications are on. Send a test</button>
          : <button className="button wide" disabled={save.phase === 'saving' || !prefs.person} onClick={turnOn}>{prefs.person ? 'Turn on notifications' : 'Choose whose phone this is first'}</button>)}
        <SaveNote save={save} saved={message ?? 'Saved'} />
      </FormField>

      <FormField label="What you’ll get">
        <div className="list">
          {view.automaticPlanning.tripMorning && <div className="list-row"><span className="grow">Meals planned for the trip</span><span className="muted small">Grocery mornings, {clockText(schedule.planTime)}</span></div>}
          <div className="list-row"><span className="grow">“What did you make?”</span><span className="muted small">Every day, {clockText(schedule.checkinTime)}</span></div>
          <div className="list-row"><span className="grow">What to do the night before</span><span className="muted small">When a meal needs it, {clockText(schedule.nightBeforeTime)}</span></div>
        </div>
      </FormField>

      <NightBeforeTime key={`${schedule.nightBeforeTime.hour}:${schedule.nightBeforeTime.minute}`} time={schedule.nightBeforeTime} />
    </SettingsPage>
  );
}
