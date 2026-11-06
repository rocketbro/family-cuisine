// The screen opened during an Aldi lookup it didn't start, so nothing will tell it when the prices
// are in. It asks now and then, with plain reads only: a full load also tells the server the list was
// opened, which should happen once, when there's something new to show. A lookup takes about a second
// per item, so the limit is well past any real one. Past it, the next load picks the prices up.
import type { ShoppingWeek } from '../../../shared/api-types.ts';

const POLL_EVERY_MS = 5000;
const MOST_POLLS = 60;

type ReadList = () => Promise<Pick<ShoppingWeek, 'aldiLookup'>>;

/** Calls `finished` once a read says the lookup isn't running. Returns what stops the polling. */
export function whenLookupFinishes(read: ReadList, finished: () => void): () => void {
  let polls = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const poll = async () => {
    polls += 1;
    // A failed read says nothing about the lookup, so it just uses up a try.
    const running = await read().then(week => week.aldiLookup === 'running', () => true);
    if (stopped) return;
    if (!running) finished();
    else if (polls < MOST_POLLS) timer = setTimeout(() => void poll(), POLL_EVERY_MS);
  };

  timer = setTimeout(() => void poll(), POLL_EVERY_MS);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
