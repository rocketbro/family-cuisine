import type { ISODate } from '../../../domain/dates.ts';
import type { PackSize } from '../../../domain/pack-size.ts';
import type { PantryItem, StockStatus, StorePreference } from '../../../domain/pantry.ts';
import type { Portion } from '../../../domain/portions.ts';
import type { StockGoal } from '../../../domain/stock-up.ts';

export type PantryInput = {
  name: string;
  category?: string;
  status?: StockStatus;
  count?: number | null;
  staple?: boolean;
  store?: StorePreference;
  walmartItemId?: string | null;
  packSize?: PackSize | null;
  stockUp?: StockGoal | null;
  minPackages?: number;
  occasional?: boolean;
  useBy?: ISODate | null;
  useByEstimated?: boolean;
  lastsDays?: number | null;
  alsoCalled?: string[];
};

export type PantryRepository = {
  list(): PantryItem[];
  get(id: number): PantryItem | null;
  findByName(name: string): PantryItem | null;
  create(input: PantryInput): PantryItem;
  update(id: number, patch: Partial<PantryInput>): PantryItem | null;
  setPortions(id: number, portions: Portion[]): void;
  remove(id: number): void;
};
