// Everything the server reads from its environment, in one place. Values come from
// `.env` in the repo root (gitignored), loaded by `node --env-file-if-exists=.env`.
import os from 'node:os';
import path from 'node:path';
import { defaultDataDir, expandHome, flagIsOn, pathSetting } from './config-values.ts';

const env = process.env;
const home = os.homedir();

function number(name: string, fallback: number): number {
  const value = Number(env[name]);
  return Number.isFinite(value) && env[name] !== '' && env[name] !== undefined ? value : fallback;
}

function time(name: string, fallback: string): { hour: number; minute: number } {
  const [hour, minute] = (env[name] || fallback).split(':').map(Number);
  return { hour, minute };
}

const pathFrom = (value: string) => pathSetting(value, home, process.cwd());

const dataDir = pathFrom(env.CUISINE_DATA_DIR || defaultDataDir(process.platform, home, env.XDG_DATA_HOME));

export const config = {
  port: number('PORT', 2847),
  host: env.HOST || '127.0.0.1',
  /** The tailnet URL phones use. An allowed host, and the VAPID subject unless VAPID_SUBJECT is set. */
  publicUrl: env.PUBLIC_URL || 'http://127.0.0.1:2847',
  /** More names this server answers to, beyond loopback and PUBLIC_URL's host. */
  allowedHosts: env.ALLOWED_HOSTS || null,
  /** Required on a non-loopback HOST, unless ALLOW_OPEN_NETWORK=1. */
  accessToken: env.ACCESS_TOKEN || null,
  allowOpenNetwork: env.ALLOW_OPEN_NETWORK === '1',
  dataDir,
  dbPath: path.join(dataDir, 'cuisine.db'),
  recipesDir: path.join(dataDir, 'recipes'),
  imagesDir: path.join(dataDir, 'images'),
  tmpDir: path.join(dataDir, 'tmp'),
  seedDir: path.resolve(import.meta.dirname, '..', '..', 'seed'),
  /** Overridable so a test copy can serve its own build without touching the installed one's. */
  clientDir: env.CUISINE_CLIENT_DIR ? pathFrom(env.CUISINE_CLIENT_DIR) : path.resolve(import.meta.dirname, '..', '..', 'dist'),

  anthropicApiKey: env.ANTHROPIC_API_KEY || null,
  model: env.CUISINE_MODEL || 'claude-sonnet-5-5',
  /** Reading and transcribing work: recipe imports, night-before steps and the page fetcher. */
  fastModel: env.CUISINE_FAST_MODEL || 'claude-haiku-5-5',
  unsplashAccessKey: env.UNSPLASH_ACCESS_KEY || null,

  vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
  vapidPrivateKey: env.VAPID_PRIVATE_KEY || null,
  /** A mailto: or https: contact for push services; PUBLIC_URL serves if it's https. */
  vapidSubject: env.VAPID_SUBJECT || null,

  fluidvoiceUrl: env.FLUIDVOICE_URL || 'http://127.0.0.1:47733',
  /** FluidVoice's decoder caps one request; recordings are cut into pieces below this. */
  fluidvoiceMaxSeconds: 280,
  parakeetDir: pathFrom(env.PARAKEET_DIR || path.join(home, '.cache', 'openwhispr', 'parakeet-models', 'parakeet-tdt-0.6b-v3')),
  /** Found on PATH unless set. `scripts/serve.sh` adds the usual Homebrew folders for the service. */
  ffmpeg: env.FFMPEG ? expandHome(env.FFMPEG, home) : 'ffmpeg',

  /** Optional lookups against sites that haven't authorized them. Off unless turned on; see the README. */
  aldiPriceLookup: flagIsOn(env.ALDI_PRICE_LOOKUP),
  walmartProductLookup: flagIsOn(env.WALMART_PRODUCT_LOOKUP),

  /** 0 = Sunday. The shopping day here is only the default until someone sets one in Settings. */
  shopWeekday: number('SHOP_WEEKDAY', 3),
  planTime: time('PLAN_TIME', '08:00'),
  checkinTime: time('CHECKIN_TIME', '19:45'),
  /** Only the default: the time set in Settings → Notifications wins. */
  nightBeforeTime: time('NIGHT_BEFORE_TIME', '17:00'),
  /** Only the default: the household's own dinner time in Settings wins. */
  dinnerTime: env.DINNER_TIME || '6:30 PM',
  /** How far back the planner looks so meals don't come around too often. */
  historyDays: 14,
} as const;

export type Config = typeof config;
