// Beside a typed field: Save while it isn't saved, Saved once it is, nothing otherwise.
import { Check } from 'lucide-react';
import type { SavedField } from './useSavedField.ts';

export function SaveMark({ field }: { field: SavedField }) {
  if (field.state === 'saving') return <span className="save-mark faint small" role="status">Saving…</span>;
  if (field.dirty) return <button type="button" className="link-button save-mark" onClick={() => void field.commit()}>Save</button>;
  if (field.state === 'saved') return <span className="save-mark faint small" role="status"><Check size={14} /> Saved</span>;
  return null;
}
