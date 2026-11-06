// Upgrading a database as an older version left it, and the new columns round trip.
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { blankEntry } from '../../../domain/plan.ts';
import { migrate } from './migrations.ts';
import { sqlitePantryRepository } from './pantry-repository.ts';
import { sqlitePlanRepository } from './plan-repository.ts';
import { sqliteReceiptRepository } from './receipt-repository.ts';

const BEFORE_SETTLING = 16;
const PAST = '2020-01-01';
const CHECKED_IN = '2999-01-01';
const STILL_OPEN = '2999-01-02';

function atVersion16() {
  const db = new Database(':memory:');
  migrate(db, BEFORE_SETTLING);
  const meal = db.prepare("INSERT INTO plan_entries (date, slot, kind, recipe_slug, outcome, pantry_settled) VALUES (?, ?, 'recipe', 'stew', ?, ?)");
  meal.run(PAST, 'dinner', 'made', 0);
  meal.run(PAST, 'lunch', 'skipped', 0);
  meal.run(PAST, 'breakfast', null, 0);
  meal.run(CHECKED_IN, 'dinner', 'swapped', 0);
  meal.run(CHECKED_IN, 'lunch', null, 0);
  meal.run(STILL_OPEN, 'dinner', 'made', 0);
  meal.run(STILL_OPEN, 'lunch', 'made', 1);
  db.prepare("INSERT INTO checkins (date, pantry_done_at) VALUES (?, datetime('now'))").run(CHECKED_IN);
  db.prepare("INSERT INTO checkins (date, meals_done_at) VALUES (?, datetime('now'))").run(STILL_OPEN);
  return db;
}

describe('settling meals: migrating an older database', () => {
  it('moves to the new version and keeps every meal', () => {
    const db = atVersion16();
    expect(db.pragma('user_version', { simple: true })).toBe(BEFORE_SETTLING);
    migrate(db, BEFORE_SETTLING + 1);
    expect(db.pragma('user_version', { simple: true })).toBe(BEFORE_SETTLING + 1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM plan_entries').get()).toEqual({ n: 7 });
  });

  it('counts everything recorded earlier as settled, so a deploy takes nothing off', () => {
    const db = atVersion16();
    migrate(db);
    const plan = sqlitePlanRepository(db);
    expect(plan.get(PAST, 'dinner')?.checkinSettled).toBe(true);
    expect(plan.get(CHECKED_IN, 'dinner')?.checkinSettled).toBe(true);
  });

  it('leaves a day with its check-in still open for that check-in, and meals nobody recorded', () => {
    const db = atVersion16();
    migrate(db);
    const plan = sqlitePlanRepository(db);
    expect(plan.get(STILL_OPEN, 'dinner')?.checkinSettled).toBe(false);
    expect(plan.get(STILL_OPEN, 'lunch')).toMatchObject({ checkinSettled: false, pantrySettled: true });
    expect(plan.get(CHECKED_IN, 'lunch')?.checkinSettled).toBe(false);
    expect(plan.get(PAST, 'breakfast')?.checkinSettled).toBe(false);
    expect(plan.get(PAST, 'lunch')?.checkinSettled).toBe(false);
  });

  it('changes nothing when run again', () => {
    const db = atVersion16();
    migrate(db);
    const plan = sqlitePlanRepository(db);
    plan.upsert({ ...plan.get(STILL_OPEN, 'dinner')!, checkinSettled: false });
    migrate(db);
    expect(plan.get(STILL_OPEN, 'dinner')?.checkinSettled).toBe(false);
  });
});

describe('the new columns', () => {
  it('round trip through the plan repository', () => {
    const db = new Database(':memory:');
    migrate(db);
    const plan = sqlitePlanRepository(db);
    const entry = { ...blankEntry('2026-11-04', 'dinner'), kind: 'recipe' as const, recipeSlug: 'cake', outcome: 'made' as const, checkinSettled: true, substituted: { 0: 'flax-egg' } };
    plan.upsert(entry);
    expect(plan.get('2026-11-04', 'dinner')).toEqual(entry);
    plan.upsert({ ...entry, substituted: null, checkinSettled: false });
    expect(plan.get('2026-11-04', 'dinner')).toMatchObject({ substituted: null, checkinSettled: false });
    expect(plan.fillIfOpen(blankEntry('2026-11-05', 'dinner'))).toBe(true);
  });
});

describe('migration 18: naming the package columns for either store', () => {
  const BEFORE_RENAME = 17;
  const THREE_POUNDS = { count: null, measure: { amount: 3, unit: 'lb' } };
  const READ_AND_FOUND_NOTHING = { count: null, measure: null };

  function atVersion17() {
    const db = new Database(':memory:');
    migrate(db, BEFORE_RENAME);
    const item = db.prepare('INSERT INTO pantry_items (name, walmart_item_id, walmart_pack, walmart_quantity) VALUES (?, ?, ?, ?)');
    item.run('ground beef', '111', JSON.stringify(THREE_POUNDS), 2);
    item.run('bananas', '222', JSON.stringify(READ_AND_FOUND_NOTHING), 5);
    item.run('flour', null, null, 1);
    return db;
  }

  it('keeps every stored value under its new name', () => {
    const db = atVersion17();
    const before = db.prepare('SELECT * FROM pantry_items ORDER BY id').all() as Record<string, unknown>[];
    migrate(db, BEFORE_RENAME + 1);
    expect(db.pragma('user_version', { simple: true })).toBe(BEFORE_RENAME + 1);
    const after = db.prepare('SELECT * FROM pantry_items ORDER BY id').all();
    expect(after).toEqual(before.map(({ walmart_pack, walmart_quantity, ...rest }) => ({ ...rest, pack_size: walmart_pack, min_packages: walmart_quantity })));
  });

  it('reads and writes through the pantry repository', () => {
    const db = atVersion17();
    migrate(db);
    const pantry = sqlitePantryRepository(db);
    expect(pantry.findByName('ground beef')).toMatchObject({ packSize: THREE_POUNDS, minPackages: 2, walmartItemId: '111' });
    expect(pantry.findByName('bananas')).toMatchObject({ packSize: READ_AND_FOUND_NOTHING, minPackages: 5 });
    expect(pantry.findByName('flour')).toMatchObject({ packSize: null, minPackages: 1, walmartItemId: null });
    const { id } = pantry.findByName('flour')!;
    expect(pantry.update(id, { packSize: { count: 2, measure: null }, minPackages: 3 })).toMatchObject({ packSize: { count: 2, measure: null }, minPackages: 3 });
    expect(pantry.create({ name: 'salt' })).toMatchObject({ packSize: null, minPackages: 1 });
  });

  it('leaves no old column behind', () => {
    const db = atVersion17();
    migrate(db);
    const columns = (db.pragma('table_info(pantry_items)') as { name: string }[]).map(column => column.name);
    expect(columns).toEqual(expect.arrayContaining(['pack_size', 'min_packages']));
    expect(columns.filter(name => name === 'walmart_pack' || name === 'walmart_quantity')).toEqual([]);
  });

  it('leaves saved trip lists alone: a TripLine has never held either name', () => {
    const db = atVersion17();
    const line = { key: 'p1', name: 'ground beef', pantryItemId: 1, store: 'walmart', reason: 'needed', neededFor: ['Stew'], checkedOff: true, addedCount: 2, countAfter: 2 };
    db.prepare('INSERT INTO trip_lists (shop_date, lines) VALUES (?, ?)').run('2026-11-04', JSON.stringify([line]));
    migrate(db);
    expect(sqliteReceiptRepository(db).tripList('2026-11-04')).toEqual([line]);
  });

  it('changes nothing when run again', () => {
    const db = atVersion17();
    migrate(db);
    const once = db.prepare('SELECT * FROM pantry_items').all();
    migrate(db);
    expect(db.prepare('SELECT * FROM pantry_items').all()).toEqual(once);
  });
});
