// Append-only list of schema steps; `user_version` records how many have run.
import type Database from 'better-sqlite3';

const STEPS: string[] = [
  `CREATE TABLE pantry_items (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL UNIQUE COLLATE NOCASE,
     category TEXT NOT NULL DEFAULT 'Other',
     status TEXT NOT NULL DEFAULT 'have' CHECK (status IN ('have','low','out')),
     count REAL,
     staple INTEGER NOT NULL DEFAULT 0,
     store TEXT NOT NULL DEFAULT 'any' CHECK (store IN ('any','aldi','walmart')),
     walmart_item_id TEXT,
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   );
   CREATE TABLE plan_entries (
     date TEXT NOT NULL,
     slot TEXT NOT NULL CHECK (slot IN ('breakfast','lunch','dinner')),
     kind TEXT NOT NULL CHECK (kind IN ('recipe','leftovers','note')),
     recipe_slug TEXT,
     multiplier REAL NOT NULL DEFAULT 1,
     leftovers_date TEXT,
     leftovers_slot TEXT,
     note TEXT,
     outcome TEXT CHECK (outcome IN ('made','swapped','skipped')),
     outcome_slug TEXT,
     PRIMARY KEY (date, slot)
   );
   CREATE TABLE week_stores (shop_date TEXT PRIMARY KEY, store TEXT NOT NULL CHECK (store IN ('aldi','walmart')));
   CREATE TABLE checkins (date TEXT PRIMARY KEY, meals_done_at TEXT, pantry_done_at TEXT);
   CREATE TABLE push_subscriptions (endpoint TEXT PRIMARY KEY, person TEXT NOT NULL, keys TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
   CREATE TABLE job_runs (job TEXT NOT NULL, run_key TEXT NOT NULL, ran_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (job, run_key));`,
  `ALTER TABLE plan_entries ADD COLUMN pantry_settled INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE plan_entries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
   CREATE TABLE day_lines (date TEXT PRIMARY KEY, signature TEXT NOT NULL, line TEXT NOT NULL);`,
  `CREATE TABLE household_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE trip_moves (regular TEXT PRIMARY KEY, actual TEXT NOT NULL);
   CREATE TABLE item_prices (
     pantry_item_id INTEGER NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
     store TEXT NOT NULL CHECK (store IN ('aldi','walmart')),
     cents INTEGER NOT NULL,
     estimated INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (pantry_item_id, store));`,
  `DELETE FROM item_prices WHERE estimated = 1;
   ALTER TABLE item_prices ADD COLUMN source TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','lookup'));
   ALTER TABLE item_prices ADD COLUMN product TEXT;`,
  `ALTER TABLE pantry_items ADD COLUMN walmart_quantity INTEGER NOT NULL DEFAULT 1;
   ALTER TABLE pantry_items ADD COLUMN occasional INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE pantry_items ADD COLUMN use_by TEXT;
   ALTER TABLE pantry_items ADD COLUMN use_by_estimated INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE pantry_items ADD COLUMN lasts_days INTEGER;`,
  `CREATE TABLE pantry_portions (
     pantry_item_id INTEGER NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
     storage TEXT NOT NULL CHECK (storage IN ('fresh','frozen')),
     amount REAL,
     unit TEXT,
     use_by TEXT,
     use_by_estimated INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (pantry_item_id, storage));`,
  `CREATE TABLE pantry_portions_next (
     pantry_item_id INTEGER NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
     storage TEXT NOT NULL CHECK (storage IN ('fresh','frozen','canned','dried')),
     amount REAL,
     unit TEXT,
     can_oz REAL,
     use_by TEXT,
     use_by_estimated INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (pantry_item_id, storage));
   INSERT INTO pantry_portions_next (pantry_item_id, storage, amount, unit, use_by, use_by_estimated)
     SELECT pantry_item_id, storage, amount, unit, use_by, use_by_estimated FROM pantry_portions;
   DROP TABLE pantry_portions;
   ALTER TABLE pantry_portions_next RENAME TO pantry_portions;`,
  `CREATE TABLE trip_lists (
     shop_date TEXT PRIMARY KEY,
     lines TEXT NOT NULL,
     saved_at TEXT NOT NULL DEFAULT (datetime('now')));
   CREATE TABLE receipts (
     id INTEGER PRIMARY KEY,
     shop_date TEXT NOT NULL,
     store TEXT NOT NULL CHECK (store IN ('aldi','walmart','other')),
     purchased_on TEXT,
     total_cents INTEGER,
     status TEXT NOT NULL CHECK (status IN ('reading','failed','ready','applied')),
     error TEXT,
     files TEXT NOT NULL,
     lines TEXT NOT NULL DEFAULT '[]',
     created_at TEXT NOT NULL DEFAULT (datetime('now')));`,
  `ALTER TABLE plan_entries ADD COLUMN drafted TEXT;`,
  `ALTER TABLE pantry_items ADD COLUMN also_called TEXT NOT NULL DEFAULT '[]';
   CREATE TABLE avoided_meals (
     id INTEGER PRIMARY KEY,
     title TEXT NOT NULL,
     reason TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')));`,
  `DROP TABLE day_lines;`,
  `ALTER TABLE pantry_items ADD COLUMN walmart_pack TEXT;`,
  `ALTER TABLE pantry_items ADD COLUMN stock_up TEXT;
   UPDATE household_settings SET key = 'trip_budget_cents' WHERE key = 'aldi_budget_cents';
   CREATE TABLE item_prices_new (
     pantry_item_id INTEGER NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
     store TEXT NOT NULL CHECK (store IN ('aldi','walmart')),
     cents INTEGER NOT NULL,
     source TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed','lookup','receipt')),
     product TEXT,
     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
     PRIMARY KEY (pantry_item_id, store));
   INSERT INTO item_prices_new (pantry_item_id, store, cents, source, product, updated_at) SELECT pantry_item_id, store, cents, source, product, updated_at FROM item_prices;
   DROP TABLE item_prices;
   ALTER TABLE item_prices_new RENAME TO item_prices;`,
  `ALTER TABLE job_runs ADD COLUMN completed_at TEXT;
   ALTER TABLE job_runs ADD COLUMN lease_until TEXT;
   UPDATE job_runs SET completed_at = ran_at;
   INSERT INTO job_runs (job, run_key, ran_at, completed_at) SELECT 'weekly-notice', run_key, ran_at, ran_at FROM job_runs WHERE job = 'weekly-plan';`,
  // Nothing recorded before this can be told apart from a meal a check-in already took off, so
  // only today's meals with the check-in still open are left for one: a deploy never takes off old meals.
  `ALTER TABLE plan_entries ADD COLUMN substituted TEXT;
   ALTER TABLE plan_entries ADD COLUMN checkin_settled INTEGER NOT NULL DEFAULT 0;
   UPDATE plan_entries SET checkin_settled = 1
     WHERE outcome IN ('made','swapped')
       AND (date < date('now','localtime') OR date IN (SELECT date FROM checkins WHERE pantry_done_at IS NOT NULL));`,
  // Both apply at either store. Only the names change; every value stays as it is.
  `ALTER TABLE pantry_items RENAME COLUMN walmart_pack TO pack_size;
   ALTER TABLE pantry_items RENAME COLUMN walmart_quantity TO min_packages;`,
  // A day holds any number of extras, so they can't share `plan_entries`' key (date, slot) and its
  // check on slot. A table of their own leaves every existing row alone. Only a person adds one, and
  // they don't make leftovers, so there's nothing for `pinned`, the leftovers columns or `drafted`.
  // AUTOINCREMENT means a slot is never reused, so an old screen can't reach a later extra.
  `CREATE TABLE plan_extras (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     date TEXT NOT NULL,
     kind TEXT NOT NULL CHECK (kind IN ('recipe','note')),
     recipe_slug TEXT,
     multiplier REAL NOT NULL DEFAULT 1,
     note TEXT,
     outcome TEXT CHECK (outcome IN ('made','swapped','skipped')),
     outcome_slug TEXT,
     pantry_settled INTEGER NOT NULL DEFAULT 0,
     checkin_settled INTEGER NOT NULL DEFAULT 0,
     substituted TEXT
   );
   CREATE INDEX plan_extras_by_date ON plan_extras (date);`,
  // Trips become dates chosen one at a time. Past regular trips go on record so history keeps its shape.
  // What was kept under a moved trip's regular date moves to the day it's really on.
  `CREATE TABLE shop_trips (date TEXT PRIMARY KEY);
   WITH RECURSIVE
     usual(weekday) AS (SELECT CAST(value AS INTEGER) FROM household_settings WHERE key = 'shop_weekday'),
     earliest(day) AS (SELECT date(COALESCE(MIN(date), date('now', 'localtime')), '-7 days') FROM plan_entries),
     days(day) AS (
       SELECT date(earliest.day, '+' || ((usual.weekday - CAST(strftime('%w', earliest.day) AS INTEGER) + 7) % 7) || ' days') FROM earliest, usual
       UNION ALL SELECT date(day, '+7 days') FROM days WHERE date(day, '+7 days') <= date('now', 'localtime')
     )
   INSERT OR IGNORE INTO shop_trips (date)
     SELECT day FROM days WHERE day <= date('now', 'localtime') AND day NOT IN (SELECT regular FROM trip_moves)
     UNION SELECT actual FROM trip_moves;
   UPDATE OR REPLACE household_settings
     SET value = json_set(value, '$.trip', (SELECT actual FROM trip_moves WHERE 'trip_plan:' || regular = key)),
         key = 'trip_plan:' || (SELECT actual FROM trip_moves WHERE 'trip_plan:' || regular = key)
     WHERE key IN (SELECT 'trip_plan:' || regular FROM trip_moves);
   UPDATE household_settings
     SET value = json_set(value, '$.shopDate', (SELECT actual FROM trip_moves WHERE regular = json_extract(value, '$.shopDate')))
     WHERE key = 'walmart_cart_sent' AND json_extract(value, '$.shopDate') IN (SELECT regular FROM trip_moves);
   DELETE FROM household_settings WHERE key = 'shop_weekday';
   DROP TABLE trip_moves;`,
];

/** `through` stops early, so a test can set up data as an older version would have left it. */
export function migrate(db: Database.Database, through = STEPS.length): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let i = current; i < through; i++) {
    db.transaction(() => {
      db.exec(STEPS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
