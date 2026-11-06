// A choice from a list, or a date, drawn the same on every phone. The real select or date input
// sits invisibly on top, so tapping brings up the phone's own picker and VoiceOver reads it.
import { ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

export function PickSelect({ label, value, onChange, options, shown }: {
  label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; shown?: ReactNode;
}) {
  return (
    <label className="pick">
      <span className="grow">{shown ?? options.find(o => o.value === value)?.label ?? value}</span>
      <ChevronsUpDown size={15} />
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function PickDate({ label, value, onChange, disabled, urgent, children }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; urgent?: boolean; children: ReactNode;
}) {
  return (
    <label className={`pick ${urgent ? 'use-by-soon' : ''}`}>
      <span className="grow">{children}</span>
      <input type="date" aria-label={label} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
