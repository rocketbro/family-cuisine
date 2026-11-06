// How much of one pantry item to keep, how it's kept and what a package holds.
import { useState } from 'react';
import type { PantryItem } from '../../../../domain/pantry.ts';
import type { Storage } from '../../../../domain/portions.ts';
import { packageForGoal, stockStanding, type StockGoal } from '../../../../domain/stock-up.ts';
import { api } from '../../../api.ts';
import { announceChange } from '../../../data-events.ts';
import { useSaveOnLeave } from '../../../hooks/useSaveOnLeave.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { useReturnTo } from '../../../navigation/useTabNav.ts';
import { Segmented } from '../../../ui/Common.tsx';
import { FormField } from '../../../ui/FormField.tsx';
import { SaveBar, SaveNote } from '../../../ui/SaveNote.tsx';
import { amountFrom, asChoice, choiceOf, goalUnits, KEPT, packFields, packFrom, packUnitFor, packUnits, startingStorage, startingUnit, unitOf, type UnitChoice } from './goal-form.ts';
import { asInput, withGoal, withoutGoal } from './goal-list.ts';
import { StockMeter } from './StockMeter.tsx';

const LIST = '/settings/stock-up';

export function StockGoalForm({ item, onSaved }: { item: PantryItem; onSaved: () => Promise<void> }) {
  const goal = item.stockUp;
  const pack = packFields(item.packSize);
  const [storage, setStorage] = useState<Storage>(goal?.storage ?? startingStorage(item));
  const [amount, setAmount] = useState(goal ? String(goal.amount) : '');
  const [unit, setUnit] = useState<UnitChoice>(goal ? choiceOf(goal.unit) : startingUnit(item, storage));
  const [packAmount, setPackAmount] = useState(pack?.amount ?? '');
  // Follows the goal's unit until someone chooses one or there's a saved package.
  const [chosenPackUnit, setPackUnit] = useState<UnitChoice | null>(pack?.unit ?? null);
  const packUnit = chosenPackUnit ?? packUnitFor(unit);
  const save = useSaveState();
  const removing = useSaveState();
  const returnTo = useReturnTo();

  const goalAmount = amountFrom(amount);
  const packValue = amountFrom(packAmount);
  const packChanged = packAmount.trim() !== (pack?.amount ?? '') || (packAmount.trim() !== '' && packUnit !== pack?.unit);
  const packValid = packAmount.trim() === '' || packValue !== null;
  const goalChanged = !goal || goal.storage !== storage || goal.amount !== goalAmount || choiceOf(goal.unit) !== unit;
  const valid = goalAmount !== null && packValid;

  const persist = () => save.run(async () => {
    if (goalAmount === null) return;
    if (packChanged) await api.updatePantryItem(item.id, { packSize: packValue === null ? null : packFrom(packValue, packUnit) });
    if (goalChanged) {
      const fresh = await api.stockUp();
      await api.setStockUp(withGoal(fresh.map(asInput), { pantryItemId: item.id, amount: goalAmount, unit: unitOf(unit), storage }));
    }
    announceChange();
    await onSaved();
    if (!goal) returnTo(LIST);
  });

  const remove = () => removing.run(async () => {
    const fresh = await api.stockUp();
    await api.setStockUp(withoutGoal(fresh.map(asInput), item.id));
    announceChange();
    await onSaved();
    returnTo(LIST);
  });

  // Leaving an existing goal keeps what changed. Leaving a new one is changing your mind.
  const dirty = goalChanged || packChanged;
  useSaveOnLeave(Boolean(goal) && dirty && valid && save.phase !== 'saving' && removing.phase === 'idle', persist);

  const shownGoal: StockGoal = { amount: goalAmount ?? goal?.amount ?? 0, unit: unitOf(unit), storage, rank: 0 };
  const standing = stockStanding(item, shownGoal);
  const packSize = packValue === null ? null : packFrom(packValue, packUnit);
  const countsPackages = packageForGoal({ packSize }, shownGoal) !== null;
  const chooseStorage = (next: Storage) => {
    setStorage(next);
    if (!goal && !amount) setUnit(startingUnit(item, next));
  };

  return (
    <>
      <div className="stock-standing">
        <StockMeter standing={goalAmount === null ? { ...standing, goal: 'No goal yet', share: 0 } : standing} />
      </div>

      <div className="settings-body">
        <FormField label="Kept as">
          <Segmented label="Kept as" value={storage} onChange={chooseStorage} options={KEPT} />
        </FormField>

        <FormField label="How much to keep" htmlFor="stock-amount">
          <div className="form-pair">
            <input id="stock-amount" className="field" inputMode="decimal" placeholder="10" value={amount} onChange={e => setAmount(e.target.value)} />
            <select className="field" aria-label="Unit" value={unit} onChange={e => setUnit(asChoice(e.target.value))}>
              {goalUnits(unit).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </FormField>

        <FormField label="Usual package" htmlFor="stock-pack"
          help={countsPackages ? 'What one package holds. The list counts packages toward the goal.' : 'What one package holds. Until it knows, in a unit that matches the goal, the list adds one package a trip.'}>
          <div className="form-pair">
            <input id="stock-pack" className="field" inputMode="decimal" placeholder="3" value={packAmount} onChange={e => setPackAmount(e.target.value)} />
            <select className="field" aria-label="Package unit" value={packUnit} onChange={e => setPackUnit(asChoice(e.target.value))}>
              {packUnits(packUnit).map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </FormField>

        <SaveBar save={save} dirty={dirty} disabled={!valid} label={goal ? 'Save' : 'Add to stock up'} onSave={persist} />

        {goal && (
          <>
            <button type="button" className="link-button danger-link" disabled={removing.phase === 'saving'} onClick={remove}>Stop stocking up on this</button>
            <SaveNote save={removing} saving="Taking it off…" />
          </>
        )}
      </div>
    </>
  );
}
