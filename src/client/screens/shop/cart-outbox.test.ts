import { describe, expect, it } from 'vitest';
import { addSent, walmartCartUrl } from '../../../domain/walmart.ts';
import { afterRecording, linesToSend, outboxFor, outboxLines } from './cart-outbox.ts';

const eggs = { itemId: '111', quantity: 1 };
const milk = { itemId: '222', quantity: 2 };

describe('a record that failed', () => {
  it('doesn’t send the same items on the next tap, though the server still says they’re unsent', () => {
    const unrecorded = addSent({}, [eggs, milk]);
    expect(linesToSend([eggs, milk], unrecorded)).toEqual([]);
    expect(walmartCartUrl(linesToSend([eggs, milk], unrecorded))).toBeNull();
  });

  it('still sends what’s new since', () => {
    const butter = { itemId: '333', quantity: 1 };
    expect(linesToSend([eggs, milk, butter], addSent({}, [eggs, milk]))).toEqual([butter]);
  });

  it('sends only the difference when a quantity went up', () => {
    expect(linesToSend([{ itemId: '222', quantity: 3 }], addSent({}, [milk]))).toEqual([{ itemId: '222', quantity: 1 }]);
  });

  it('changes nothing about the link when nothing failed', () => {
    expect(linesToSend([eggs, milk], {})).toEqual([eggs, milk]);
  });

  it('is told to the server as the same lines that went to the cart', () => {
    expect(outboxLines(addSent(addSent({}, [eggs]), [milk]))).toEqual([eggs, milk]);
  });
});

describe('afterRecording', () => {
  it('empties once the server has it all', () => {
    expect(afterRecording({ 111: 1, 222: 2 }, { 111: 1, 222: 2 })).toEqual({});
  });

  it('keeps what was sent while the record was on its way', () => {
    expect(afterRecording({ 111: 2, 333: 1 }, { 111: 1 })).toEqual({ 111: 1, 333: 1 });
  });
});

describe('outboxFor', () => {
  it('keeps this trip’s and forgets another trip’s', () => {
    const saved = { shopDate: '2026-11-07', items: { 111: 1 } };
    expect(outboxFor(saved, '2026-11-07')).toEqual({ 111: 1 });
    expect(outboxFor(saved, '2026-11-14')).toEqual({});
    expect(outboxFor(null, '2026-11-07')).toEqual({});
  });
});
