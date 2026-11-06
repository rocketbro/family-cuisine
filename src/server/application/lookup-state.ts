// What the outbound lookups are doing right now. The container makes one of these per server.
export type LookupState = {
  /** The Aldi price lookup under way, if any: one at a time, across requests. */
  aldi: Promise<number> | null;
  /** A sweep of Walmart package sizes is under way. */
  walmartSweeping: boolean;
  /** When Walmart last stopped answering (ms since the epoch), so the next sweep can wait. */
  walmartFailedAt: number;
};

export const newLookupState = (): LookupState => ({ aldi: null, walmartSweeping: false, walmartFailedAt: 0 });

export function lookupRunning(state: LookupState): boolean {
  return state.aldi !== null;
}

export function runOnce(state: LookupState, work: () => Promise<number>): Promise<number> {
  state.aldi ??= work().finally(() => { state.aldi = null; });
  return state.aldi;
}
