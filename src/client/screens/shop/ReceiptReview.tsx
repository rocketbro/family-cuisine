// Looking a receipt over before anything changes: what's on the list, what's unplanned, what's
// new, and anything the model wasn't sure about. Names can be corrected right here, something new
// can be left off for good, Claude can make the changes someone says or types, and nothing is
// saved until Save.
import { useState } from 'react';
import { bringBack, canNeverAdd, changeRow, choicesToSave, reviewRows, substitute, type ReceiptRow } from '../../../domain/receipt-review.ts';
import type { ReceiptRevision, ReceiptView } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { ClaudeNote } from '../../ui/ClaudeNote.tsx';
import { TellClaude } from '../../ui/TellClaude.tsx';
import { LeftOutLines } from './LeftOutLines.tsx';
import { insteadCandidates, receiptGroups, reviewFacts } from './receipt-groups.ts';
import { NotOnReceipt } from './NotOnReceipt.tsx';
import { ReceiptLineRow } from './ReceiptLineRow.tsx';
import { RecipeSuggestion } from './RecipeSuggestion.tsx';
import { useReceiptRevision } from './useReceiptRevision.ts';

export function ReceiptReview({ receipt, onSaved, onPricesSaved }: {
  receipt: ReceiptView; onSaved: () => void; onPricesSaved: () => void;
}) {
  const { data: pantry } = useLoad('pantry', () => api.pantry());
  const { data: status } = useLoad('status', () => api.status());
  const [rows, setRows] = useState<ReceiptRow[]>(() => reviewRows(receipt.lines, receipt.leftOut));
  const [note, setNote] = useState<{ words: string; undo: ReceiptRow[] } | null>(null);
  const [recipe, setRecipe] = useState<ReceiptRevision['recipe']>(null);
  const [pricesOnly, setPricesOnly] = useState(receipt.old);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facts = reviewFacts(receipt, pantry?.map(p => p.name) ?? []);
  const listName = (key: string | null) => receipt.diff.skipped.find(l => l.key === key)?.name ?? null;
  const revision = useReceiptRevision({
    id: receipt.id, rows, ready: Boolean(status?.ai),
    onRevised: answer => {
      setNote({ words: answer.note || 'Done.', undo: rows });
      setRows(answer.rows);
      setRecipe(answer.recipe);
    },
  });
  const change = (next: ReceiptRow[]) => { setRows(next); setNote(null); };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.applyReceipt(receipt.id, choicesToSave(rows), pricesOnly);
      announceChange();
      if (pricesOnly) onPricesSaved(); else onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <datalist id="pantry-names">{pantry?.map(p => <option key={p.id} value={p.name} />)}</datalist>
      <label className="list-row section">
        <input type="checkbox" checked={pricesOnly} onChange={e => setPricesOnly(e.target.checked)} />
        <span className="grow">
          <span>Prices only</span>
          <span className="faint small receipt-line-detail">
            Learn what things cost and leave the pantry and this week’s list alone. Things not in the pantry are skipped, and the receipt isn’t kept.
          </span>
        </span>
      </label>
      <fieldset className="plain-fieldset" disabled={revision.asking}>
        {receiptGroups(receipt, rows, facts).filter(([, group]) => group.length).map(([title, group]) => (
          <section className="section" key={title}>
            <span className="eyebrow">{title}</span>
            <div className="list">
              {group.map(row => (
                <ReceiptLineRow
                  key={row.index}
                  row={row}
                  line={receipt.lines[row.index]}
                  neverable={canNeverAdd(row, facts)}
                  insteadOf={listName(row.insteadOf)}
                  onChange={c => change(changeRow(rows, row.index, c, facts))}
                />
              ))}
            </div>
          </section>
        ))}
        <LeftOutLines rows={rows.filter(row => row.leftOut)} onBringBack={index => change(bringBack(rows, index, facts))} />
      </fieldset>
      <NotOnReceipt
        missing={receipt.diff.skipped}
        rows={rows}
        candidates={insteadCandidates(receipt, rows, facts)}
        canSubstitute={!pricesOnly && !revision.asking}
        onChoose={(key, choice) => change(substitute(rows, key, choice, facts))}
      />
      {!receipt.listSaved && <p className="faint small section">No list was saved for this trip, so there’s nothing to compare it with.</p>}
      <div className="section stack receipt-foot">
        {recipe && <RecipeSuggestion {...recipe} />}
        {note && <ClaudeNote words={note.words} onUndo={() => { setRows(note.undo); setNote(null); }} />}
        {status?.ai && (
          <TellClaude asking={revision.asking} underway={revision.underway} free={revision.micFree} listen={() => void revision.listen()} type={revision.take} />
        )}
        {error && <p className="error">{error}</p>}
        <button className="button wide" disabled={busy || revision.underway} onClick={save}>{busy ? 'Saving…' : pricesOnly ? 'Save prices' : 'Save to the pantry'}</button>
      </div>
    </>
  );
}
