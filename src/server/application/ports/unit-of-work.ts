/**
 * Several writes that happen together or not at all. It's synchronous, like the database under
 * it, so `work` can't await anything. It nests. It only covers the database: recipe and receipt
 * files can't be rolled back, so change those after it returns.
 */
export type UnitOfWork = {
  run<T>(work: () => T): T;
};
