// Sends a receipt's pages off and opens it to be read over.
import { useState } from 'react';
import { api } from '../../api.ts';
import { useOpen } from '../../navigation/useTabNav.ts';

export function useReceiptUpload() {
  const open = useOpen();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.addReceipt(files);
      open(`/shop/receipts/${id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, upload };
}
