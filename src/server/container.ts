// Composition root: the only file that knows which adapter backs which port.
import path from 'node:path';
import type { Deps } from './application/deps.ts';
import { kitchenNotes } from './application/kitchen-notes.ts';
import { newLookupState } from './application/lookup-state.ts';
import type { Config } from './config.ts';
import { vapidSubject } from './config-rules.ts';
import { claudeAi } from './infrastructure/ai/claude.ts';
import { claudePageFetcher } from './infrastructure/ai/claude-page-fetcher.ts';
import { openDatabase } from './infrastructure/db/connection.ts';
import { householdProfile } from './application/household-profile.ts';
import { fileRecordingStore } from './infrastructure/recordings/file-recording-store.ts';
import { aldiPrices } from './infrastructure/prices/aldi.ts';
import { walmartProductPage } from './infrastructure/prices/walmart-product.ts';
import { zippopotam } from './infrastructure/prices/zip.ts';
import { sqlitePriceRepository } from './infrastructure/db/price-repository.ts';
import { sqliteReceiptRepository } from './infrastructure/db/receipt-repository.ts';
import { fileReceiptStore } from './infrastructure/receipts/file-receipt-store.ts';
import { sqliteAvoidedMealRepository } from './infrastructure/db/avoided-meal-repository.ts';
import { sqliteHouseholdRepository, sqlitePushRepository } from './infrastructure/db/household-repository.ts';
import { sqlitePantryRepository } from './infrastructure/db/pantry-repository.ts';
import { sqlitePlanRepository } from './infrastructure/db/plan-repository.ts';
import { sqliteUnitOfWork } from './infrastructure/db/unit-of-work.ts';
import { filePhotoStore } from './infrastructure/images/photo-store.ts';
import { unsplashImages } from './infrastructure/images/unsplash.ts';
import { webPushNotifier } from './infrastructure/push/web-push-notifier.ts';
import { fileRecipeRepository } from './infrastructure/recipes/file-recipe-repository.ts';
import { fluidvoiceEngine } from './infrastructure/transcription/fluidvoice.ts';
import { parakeetEngine } from './infrastructure/transcription/parakeet.ts';
import { ladderTranscriber } from './infrastructure/transcription/transcriber.ts';
import { webPageFetcher } from './infrastructure/web/page-fetcher.ts';

export function buildDeps(config: Config, log: (m: string) => void = console.log): Deps {
  const db = openDatabase(config.dbPath);
  const subscriptions = sqlitePushRepository(db);
  const household = sqliteHouseholdRepository(db);
  const recordings = fileRecordingStore(path.join(config.dataDir, 'recordings'));
  // A fresh install has keys from `npm run setup` before it has an HTTPS address. That's not a reason to fail to start.
  const settings = {
    shopWeekday: config.shopWeekday, historyDays: config.historyDays, dinnerTime: config.dinnerTime, nightBeforeTime: config.nightBeforeTime,
    schedule: { planTime: config.planTime, checkinTime: config.checkinTime },
  };
  return {
    unitOfWork: sqliteUnitOfWork(db),
    recipes: fileRecipeRepository(config.recipesDir, log),
    pantry: sqlitePantryRepository(db),
    plan: sqlitePlanRepository(db),
    household,
    avoided: sqliteAvoidedMealRepository(db),
    prices: sqlitePriceRepository(db),
    receipts: sqliteReceiptRepository(db),
    receiptFiles: fileReceiptStore(path.join(config.dataDir, 'receipts')),
    storePrices: config.aldiPriceLookup ? aldiPrices(log) : null,
    walmartProducts: config.walmartProductLookup ? walmartProductPage() : null,
    lookups: newLookupState(),
    recordings,
    zips: zippopotam(),
    subscriptions,
    ai: claudeAi({ apiKey: config.anthropicApiKey, model: config.model, fastModel: config.fastModel, kitchenNotes: () => kitchenNotes({ household }), household: () => householdProfile({ household, settings }) }),
    images: unsplashImages(config.unsplashAccessKey),
    photos: filePhotoStore(config.imagesDir),
    pages: webPageFetcher(),
    claudePages: claudePageFetcher({ apiKey: config.anthropicApiKey, model: config.fastModel }),
    transcriber: ladderTranscriber({
      audioFile: recordings.audioFile,
      ffmpeg: config.ffmpeg,
      tmpDir: config.tmpDir,
      segmentSeconds: config.fluidvoiceMaxSeconds,
      engines: [fluidvoiceEngine(config.fluidvoiceUrl), parakeetEngine(config.parakeetDir)],
    }),
    notifier: webPushNotifier({
      publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey,
      subject: vapidSubject({ subject: config.vapidSubject, publicUrl: config.publicUrl }), subscriptions, log,
    }),
    settings,
    log,
  };
}
