// Whether the Recipes list includes the dishes Claude came up with: all together, or apart. A chip
// that opens the phone's own menu, with the real select sitting invisibly on top of it.
import { ChevronDown } from 'lucide-react';
import type { ClaudeView } from './recipe-filter.ts';

const CHOICES: { value: ClaudeView; label: string; chip: string }[] = [
  { value: 'show', label: 'Include Claude’s picks', chip: 'Claude' },
  { value: 'hide', label: 'Hide Claude’s picks', chip: 'Claude hidden' },
  { value: 'only', label: 'Only Claude’s picks', chip: 'Only Claude' },
];

export function ClaudeFilter({ view, onChange }: { view: ClaudeView; onChange: (view: ClaudeView) => void }) {
  const chosen = CHOICES.find(choice => choice.value === view) ?? CHOICES[0];
  return (
    <label className={`chip chip-menu ${view === 'show' ? '' : 'on'}`}>
      {chosen.chip} <ChevronDown size={14} aria-hidden="true" />
      <select aria-label="Claude’s picks" value={view} onChange={e => onChange(e.target.value as ClaudeView)}>
        {CHOICES.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select>
    </label>
  );
}
