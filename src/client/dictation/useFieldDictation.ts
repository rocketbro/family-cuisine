// Dictation for a text field. The field is known by name while it's on screen, so words finished
// after it's gone can wait on the bar and find it when it comes back, even after a reload. `into`
// only ever gets real words. If it has work to do with them, it returns a promise, and the words
// and audio stay until that answers (field-words.ts). `ready` is false while the field isn't able
// to take them yet, as when loading its contents would write over them. Returns what the mic
// button calls.
import { useEffect, useRef } from 'react';
import type { FieldTaker } from './field-words.ts';
import { useDictation } from './useDictation.ts';

export function useFieldDictation(field: string, label: string, into: FieldTaker, ready = true): () => Promise<void> {
  const { dictate, offerField } = useDictation();
  const latest = useRef(into);
  useEffect(() => { latest.current = into; });
  useEffect(() => {
    if (!ready) return;
    return offerField(field, text => latest.current(text));
  }, [field, ready, offerField]);
  return () => dictate(field, label);
}
