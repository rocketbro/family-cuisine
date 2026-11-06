// Tells the server what went to the Walmart cart, and holds onto it until the server has it
// (cart-outbox.ts). A failure shows on the screen with Try again; it's also tried again on the
// next tap and the next time the screen opens.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import { addSent, type CartLine, type SentToCart } from '../../../domain/walmart.ts';
import { api } from '../../api.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { afterRecording, outboxFor, outboxLines, savedOutbox } from './cart-outbox.ts';

export function useCartRecord(shopDate: ISODate, onRecorded: () => void | Promise<void>) {
  const [unrecorded, setUnrecorded] = useState<SentToCart>(() => outboxFor(savedOutbox.load(), shopDate));
  const held = useRef(unrecorded);
  const sending = useRef(false);
  const recording = useWrite();
  const forgetting = useWrite();
  const recorded = useRef(onRecorded);
  useEffect(() => { recorded.current = onRecorded; });
  const { run } = recording;

  const hold = useCallback((items: SentToCart) => {
    held.current = items;
    savedOutbox.save(shopDate, items);
  }, [shopDate]);

  const flush = useCallback(() => run(async () => {
    if (sending.current || !Object.keys(held.current).length) return;
    sending.current = true;
    try {
      while (Object.keys(held.current).length) {
        const batch = held.current;
        await api.noteSentToCart(outboxLines(batch));
        hold(afterRecording(held.current, batch));
      }
    } finally {
      sending.current = false;
    }
    // The screen keeps leaving these out until the list it has knows they went.
    await recorded.current();
    setUnrecorded(held.current);
  }), [run, hold]);

  useEffect(() => { void flush(); }, [flush]);

  /**
   * Called from the link's click. The state change waits for a moment, because it changes the
   * link, and the browser follows the link only after the click's handlers have run.
   */
  const sent = (lines: CartLine[]) => {
    hold(addSent(held.current, lines));
    setTimeout(() => {
      setUnrecorded(held.current);
      void flush();
    });
  };

  const startOver = () => forgetting.run(async () => {
    await api.forgetSentToCart();
    hold({});
    setUnrecorded({});
    await recorded.current();
  });

  return {
    unrecorded,
    sent,
    startOver,
    recordProblem: recording.problem,
    retryRecord: recording.retry,
    forgetProblem: forgetting.problem,
    retryForget: forgetting.retry,
  };
}
