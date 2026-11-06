// A row someone has open stays put. Without this, freezing something from the Use soon list would
// take its row off that list and close it, along with the words saying what just happened.

/** The list with the open item at the spot it was opened in, whether or not it still belongs there. */
export function keepOpenRow<T extends { id: number }>(list: readonly T[], open: T | null, spot: number): T[] {
  if (!open) return [...list];
  const others = list.filter(item => item.id !== open.id);
  return [...others.slice(0, spot), open, ...others.slice(spot)];
}
