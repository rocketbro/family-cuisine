// What each line on the list shows. Item names always stay; the rest can be switched off.
import type { ListView } from '../../preferences.ts';
import { Sheet } from '../../ui/Sheet.tsx';

const OPTIONS: { key: keyof ListView; label: string; hint: string }[] = [
  { key: 'reason', label: 'What it’s for', hint: 'The meals that need it, or Restock' },
  { key: 'product', label: 'Aldi product', hint: 'The brand and size the price is for' },
  { key: 'price', label: 'Price', hint: 'What each item costs at Aldi' },
];

type Props = { view: ListView; onChange: (view: ListView) => void; onClose: () => void };

export function ListViewSheet({ view, onChange, onClose }: Props) {
  return (
    <Sheet title="Show on the list" onClose={onClose}>
      <div className="list">
        {OPTIONS.map(({ key, label, hint }) => (
          <label key={key} className="list-row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={view[key]} onChange={e => onChange({ ...view, [key]: e.target.checked })} />
            <span className="grow">{label}<div className="faint small">{hint}</div></span>
          </label>
        ))}
      </div>
    </Sheet>
  );
}
