// One page of the review: what would go on this day, decisions first, and what's already there.
import type { ISODate } from '../../../domain/dates.ts';
import { clashGroups } from '../../../domain/plan-import-choices.ts';
import type { ImportedMeal } from '../../../domain/plan-import.ts';
import { isExtraSlot } from '../../../domain/plan-slot.ts';
import type { PlanEntryView } from '../../../shared/views.ts';
import { entryTitle } from '../../ui/entry-title.ts';
import { ImportMealClash } from './ImportMealClash.tsx';
import { ImportMealRow } from './ImportMealRow.tsx';

export type ReviewRow = ImportedMeal & { key: number };

export function PlanImportDay({ date, rows, planned, today, onEdit, onRemove, onUse }: {
  date: ISODate | null; rows: ReviewRow[]; planned: PlanEntryView[]; today: ISODate;
  onEdit: (key: number) => void; onRemove: (key: number) => void; onUse: (key: number) => void;
}) {
  const past = date !== null && date < today;
  const existingAt = (slot: ReviewRow['slot']) => (slot === 'extra' ? null : planned.find(e => e.slot === slot) ?? null);
  // A slot with a meal already made holds nothing new, so two lines on it are nothing to choose between.
  const clashes = past ? [] : clashGroups(rows.filter(row => !existingAt(row.slot)?.outcome));
  const clashed = new Set(clashes.flat().map(row => row.key));
  const others = rows.filter(row => !clashed.has(row.key));
  const staying = planned.filter(entry => isExtraSlot(entry.slot) || !rows.some(row => row.slot === entry.slot));

  return (
    <div className="plan-day">
      {clashes.map(group => <ImportMealClash key={group[0].key} meals={group} onUse={onUse} onEdit={onEdit} />)}
      {others.map(row => (
        <ImportMealRow key={row.key} meal={row} existing={existingAt(row.slot)} past={past} onEdit={() => onEdit(row.key)} onRemove={() => onRemove(row.key)} />
      ))}
      {!rows.length && <p className="plan-day-empty">Nothing to add.</p>}
      {staying.length > 0 && (
        <div className="plan-day-staying">
          <span className="eyebrow">{rows.length ? 'Also planned' : 'Already planned'}</span>
          {staying.map(entry => <p key={entry.slot}><span className="plan-meal-slot">{isExtraSlot(entry.slot) ? 'extra' : entry.slot}</span> {entryTitle(entry)}</p>)}
        </div>
      )}
    </div>
  );
}
