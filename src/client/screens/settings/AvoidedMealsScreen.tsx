// What Claude has been asked not to suggest, and a way to change your mind.
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useLoad } from '../../hooks/useLoad.ts';
import { useSaveState } from '../../hooks/useSaveState.ts';
import { Loading } from '../../ui/Common.tsx';
import { SaveNote } from '../../ui/SaveNote.tsx';
import { SettingsPage } from './SettingsPage.tsx';

export function AvoidedMealsScreen() {
  const { data, reload } = useLoad('avoided-meals', () => api.avoidedMeals());
  const save = useSaveState();

  const allow = (id: number) => save.run(async () => {
    await api.forgetAvoidedMeal(id);
    announceChange();
    await reload();
  });

  return (
    <SettingsPage title="Claude won’t suggest" intro="Meals you’ve asked Claude to leave out of plans and the dice.">
      {!data && <Loading />}
      {data?.length === 0 && <p className="muted">Nothing for now. Saying no to a meal when you swap it puts it here.</p>}
      {data && data.length > 0 && (
        <div className="list">
          {data.map(meal => (
            <div key={meal.id} className="list-row">
              <span className="grow">{meal.title}{meal.reason && <div className="faint small">{meal.reason}</div>}</span>
              <button className="button small quiet" aria-label={`Allow ${meal.title} again`} disabled={save.phase === 'saving'} onClick={() => allow(meal.id)}>Allow again</button>
            </div>
          ))}
        </div>
      )}
      <SaveNote save={save} saved="Claude can suggest it again" />
    </SettingsPage>
  );
}
