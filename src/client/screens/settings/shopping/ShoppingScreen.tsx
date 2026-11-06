// When the shopping happens and where prices come from. The usual day and the next trip are kept
// apart on purpose: a moved trip doesn't change the usual day.
import { api } from '../../../api.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { Loading } from '../../../ui/Common.tsx';
import { SettingsPage } from '../SettingsPage.tsx';
import { NextTrip } from './NextTrip.tsx';
import { StoreZip } from './StoreZip.tsx';
import { UsualShoppingDay } from './UsualShoppingDay.tsx';

export function ShoppingScreen() {
  const { data: status, reload } = useLoad('status', () => api.status());
  const { data: household } = useLoad('household', () => api.household());
  const zipSave = useSaveState();

  return (
    <SettingsPage title="Shopping">
      {!status || !household ? <Loading /> : (
        <>
          <NextTrip schedule={status.shopping} />
          <UsualShoppingDay schedule={status.shopping} />
          <StoreZip key={status.storeZip?.zip ?? ''} current={status.storeZip} aldiLookup={household.lookups.aldi} save={zipSave} onSaved={reload} />
        </>
      )}
    </SettingsPage>
  );
}
