// When the next shopping trip is, where prices come from, and what receipts leave out.
import { api } from '../../../api.ts';
import { useLoad } from '../../../hooks/useLoad.ts';
import { useSaveState } from '../../../hooks/useSaveState.ts';
import { Loading } from '../../../ui/Common.tsx';
import { SettingsPage } from '../SettingsPage.tsx';
import { NeverAddList } from './NeverAddList.tsx';
import { NextTrip } from './NextTrip.tsx';
import { StoreZip } from './StoreZip.tsx';

export function ShoppingScreen() {
  const { data: status, reload } = useLoad('status', () => api.status());
  const { data: household } = useLoad('household', () => api.household());
  const zipSave = useSaveState();

  return (
    <SettingsPage title="Shopping">
      {!status || !household ? <Loading /> : (
        <>
          <NextTrip schedule={status.shopping} />
          <StoreZip key={status.storeZip?.zip ?? ''} current={status.storeZip} aldiLookup={household.lookups.aldi} save={zipSave} onSaved={reload} />
          <NeverAddList />
        </>
      )}
    </SettingsPage>
  );
}
