// When the evening's night-before reminder goes out, for the whole household. A phone's time wheel
// changes the value as it spins, so this saves when the field is left, or the screen is.
import { useState } from 'react';
import { clockValue, parseClock, type ClockTime } from '../../../domain/job-run.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useSaveOnLeave } from '../../hooks/useSaveOnLeave.ts';
import { useSaveState } from '../../hooks/useSaveState.ts';
import { FormField } from '../../ui/FormField.tsx';
import { SaveNote } from '../../ui/SaveNote.tsx';

export function NightBeforeTime({ time }: { time: ClockTime }) {
  const saved = clockValue(time);
  const [value, setValue] = useState(saved);
  const save = useSaveState();
  const dirty = value !== saved && parseClock(value) !== null && save.phase !== 'saving';
  const persist = () => save.run(async () => {
    await api.setNightBeforeTime(value);
    announceChange();
  });
  useSaveOnLeave(dirty, persist);

  return (
    <FormField label="Night-before reminder" htmlFor="night-before-time" help="For the whole household. If tomorrow’s meal needs something done tonight, like soaking beans, this is when you hear about it.">
      <input id="night-before-time" className="field" type="time" value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { if (dirty) void persist(); else if (!parseClock(value)) setValue(saved); }} />
      <SaveNote save={save} />
    </FormField>
  );
}
