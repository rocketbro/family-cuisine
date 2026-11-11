// What receipts leave out because the family said "never add this", and taking one back.
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { FormField } from '../../../ui/FormField.tsx';
import { SaveNote } from '../../../ui/SaveNote.tsx';

export function NeverAddList() {
  const { data, reload } = useLoad('never-add', () => api.neverAdd());
  const save = useSaveState();

  const forget = (id: number) => save.run(async () => {
    await api.forgetNeverAdd(id);
    announceChange();
    await reload();
  });

  return (
    <FormField label="Never added from receipts" help={data?.length ? 'Receipts leave these out.' : 'Nothing yet. Untick something new on a receipt and choose Never add this.'}>
      {!!data?.length && (
        <div className="list">
          {data.map(entry => (
            <div key={entry.id} className="list-row">
              <span className="grow">{entry.name}</span>
              <button className="button small quiet" aria-label={`Offer ${entry.name} on receipts again`} disabled={save.phase === 'saving'} onClick={() => forget(entry.id)}>Offer again</button>
            </div>
          ))}
        </div>
      )}
      <SaveNote save={save} saved="Receipts will offer it again" />
    </FormField>
  );
}
