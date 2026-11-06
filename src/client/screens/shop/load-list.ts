// One load of the Shop screen: the list to show, and telling the server it was opened, which keeps
// the trip's record and starts any package-size reads. The server works out the list fresh for the
// read and for the note, so neither depends on the other, and a note arriving late can't save an
// old list. The screen doesn't wait for the note: a failed one mustn't cost anyone the list, and
// the next load sends another.
import type { ShoppingWeek } from '../../../shared/api-types.ts';
import { api } from '../../api.ts';

export function loadShoppingList(): Promise<ShoppingWeek> {
  void api.listOpened().catch(() => undefined);
  return api.shopping();
}
