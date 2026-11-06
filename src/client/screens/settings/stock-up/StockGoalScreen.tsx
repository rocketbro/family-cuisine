// One item's stock-up goal, new or existing. The item comes from the address, so a goal can only
// ever be for something in the pantry.
import { useParams } from 'react-router';
import { api } from '../../../api.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { Loading, Problem } from '../../../ui/Common.tsx';
import { SettingsPage } from '../SettingsPage.tsx';
import { StockGoalForm } from './StockGoalForm.tsx';

export function StockGoalScreen() {
  const id = Number(useParams().itemId);
  const { data: pantry, error, reload } = useLoad('pantry', () => api.pantry());
  const { reload: reloadList } = useLoad('stock-up', () => api.stockUp());
  const item = pantry?.find(p => p.id === id);
  // Both, so the list underneath opens already showing the change.
  const reloadAll = () => Promise.all([reload(), reloadList()]).then(() => undefined);

  if (error) return <SettingsPage title="Stock up"><Problem message={error} onRetry={reload} /></SettingsPage>;
  if (!pantry) return <SettingsPage title="Stock up"><Loading /></SettingsPage>;
  if (!item) return <SettingsPage title="Stock up"><p className="muted">That item isn’t in your Pantry anymore.</p></SettingsPage>;
  return <SettingsPage title={item.name}><StockGoalForm key={item.id} item={item} onSaved={reloadAll} /></SettingsPage>;
}
