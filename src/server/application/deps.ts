import type { ClockTime, JobSchedule } from '../../domain/job-run.ts';
import type { LookupState } from './lookup-state.ts';
import type { AiPort } from './ports/ai.ts';
import type { AvoidedMealRepository } from './ports/avoided-meals.ts';
import type { HouseholdRepository } from './ports/household.ts';
import type { ImageSearchPort, PhotoStorePort } from './ports/images.ts';
import type { NotifierPort, PushRepository } from './ports/notifications.ts';
import type { PageFetcherPort } from './ports/pages.ts';
import type { PantryRepository } from './ports/pantry.ts';
import type { PlanRepository } from './ports/plan.ts';
import type { PriceRepository, StorePricePort, WalmartProductPort, ZipLookupPort } from './ports/prices.ts';
import type { ReceiptFilePort, ReceiptRepository } from './ports/receipts.ts';
import type { RecipeRepository } from './ports/recipes.ts';
import type { RecordingStorePort } from './ports/recordings.ts';
import type { TranscriberPort } from './ports/transcription.ts';
import type { UnitOfWork } from './ports/unit-of-work.ts';

/**
 * Everything a use case may touch, assembled once in the composition root. The ports are what the
 * use cases need from the outside world: infrastructure implements them, and the use cases never
 * import SQLite, the file system, or a vendor SDK directly.
 */
export type Deps = {
  unitOfWork: UnitOfWork;
  recipes: RecipeRepository;
  pantry: PantryRepository;
  plan: PlanRepository;
  household: HouseholdRepository;
  avoided: AvoidedMealRepository;
  prices: PriceRepository;
  receipts: ReceiptRepository;
  receiptFiles: ReceiptFilePort;
  /** Null unless ALDI_PRICE_LOOKUP is on. Off means no call to Aldi at all. */
  storePrices: StorePricePort | null;
  /** Null unless WALMART_PRODUCT_LOOKUP is on. Off means no call to Walmart at all. */
  walmartProducts: WalmartProductPort | null;
  lookups: LookupState;
  recordings: RecordingStorePort;
  zips: ZipLookupPort;
  subscriptions: PushRepository;
  ai: AiPort;
  images: ImageSearchPort;
  photos: PhotoStorePort;
  pages: PageFetcherPort;
  /** For a site that turned `pages` away, when the person says to try: Anthropic's own fetcher. */
  claudePages: PageFetcherPort;
  transcriber: TranscriberPort;
  notifier: NotifierPort;
  settings: { shopWeekday: number; historyDays: number; dinnerTime: string; nightBeforeTime: ClockTime; schedule: JobSchedule };
  log: (message: string) => void;
};
