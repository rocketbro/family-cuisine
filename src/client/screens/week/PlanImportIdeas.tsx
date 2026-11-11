// Whether planning this import can use Claude's ideas, or only recipes in the book.
import { Segmented } from '../../ui/Common.tsx';

export function PlanImportIdeas({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div>
      <div className="spread">
        <span>Claude’s ideas</span>
        <div className="plan-ideas-switch">
          <Segmented label="Claude’s ideas" value={on ? 'on' : 'off'} onChange={value => onChange(value === 'on')} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        </div>
      </div>
      {!on && <p className="faint small" style={{ margin: '4px 0 0' }}>Only recipes in your book.</p>}
    </div>
  );
}
