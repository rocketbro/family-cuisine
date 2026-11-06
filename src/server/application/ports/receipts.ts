import type { ISODate } from '../../../domain/dates.ts';
import type { Receipt, TripLine } from '../../../domain/receipts.ts';
import type { ModelFile } from './ai.ts';

export type ReceiptFile = { file: string; type: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp' };

export type ReceiptUpload = { name: string; data: Buffer };

export type ReceiptFilePort = {
  /** Keeps the file as it came; throws if it isn't a photo or a PDF. */
  save(data: Buffer): ReceiptFile;
  read(file: ReceiptFile): Buffer;
  remove(file: ReceiptFile): void;
  forModel(file: ReceiptFile): Promise<ModelFile[]>;
};

export type ReceiptRecord = Receipt & { files: ReceiptFile[]; createdAt: string };

export type ReceiptRepository = {
  list(): ReceiptRecord[];
  get(id: number): ReceiptRecord | null;
  create(shopDate: ISODate, files: ReceiptFile[]): number;
  update(id: number, patch: Partial<Omit<ReceiptRecord, 'id' | 'files'>>): void;
  remove(id: number): void;
  /** The list as it stood for a trip. */
  tripList(shopDate: ISODate): TripLine[] | null;
  tripDates(): ISODate[];
  saveTripList(shopDate: ISODate, lines: TripLine[]): void;
};
