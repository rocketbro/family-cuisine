import type { UnitOfWork } from '../../application/ports/unit-of-work.ts';
import type { DB } from './connection.ts';

/** Every repository shares this connection, so a transaction here covers them all. Nested runs become savepoints. */
export function sqliteUnitOfWork(db: DB): UnitOfWork {
  return { run: work => db.transaction(work)() };
}
