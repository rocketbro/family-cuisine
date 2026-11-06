import type { ISODate } from './dates.ts';
import type { StockStatus } from './pantry.ts';
import type { PortionChange } from './portions.ts';

/** A change to one pantry item, as someone said it. */
export type PantryChange = {
  name: string;
  status: StockStatus;
  count: number | null;
  isNew: boolean;
  category: string;
  /** A date they said or read off the package. */
  useBy: ISODate | null;
  /** The model's guess at how long it keeps, when there's no date. */
  lastsDays: number | null;
  /** True or false only when they said so; null leaves it as it is. */
  keepStocked: boolean | null;
  /** Fresh and frozen amounts they mentioned; others stay as they are. */
  portions: PortionChange[] | null;
  /** Other names a recipe might use for it. Null when there's nothing to add. */
  alsoCalled: string[] | null;
};
