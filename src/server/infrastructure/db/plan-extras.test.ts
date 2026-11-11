// Migration 19 and where extras are stored. Nothing that was there before may change by a byte.
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { blankEntry } from '../../../domain/plan.ts';
import { migrate } from './migrations.ts';
import { sqlitePlanRepository } from './plan-repository.ts';

const VERSION_18 = 18;
const DRAFTED = '{"how":"Thaw it first; “really”.","uses":[{"pantryItemId":3,"name":"beef","text":"about 1 lb","amount":1,"unit":"lb","leaves":"low"}]}';
const SUBBED = '{"2":"milk-and-lemon"}';

const MEALS = [
  ['2026-10-30', 'dinner', 'recipe', 'chili-con-carne', 1.5, null, null, null, 'made', null, 1, 1, SUBBED, 1, DRAFTED],
  ['2026-10-31', 'lunch', 'leftovers', null, 1, '2026-10-30', 'dinner', null, 'swapped', 'pb-j', 0, 1, null, 0, null],
  ['2026-11-01', 'breakfast', 'note', null, 0.5, null, null, 'Pizza night “out” — 🍕', 'skipped', null, 0, 0, null, 1, null],
  ['2999-01-01', 'dinner', 'recipe', 'stew', 2.25, null, null, null, null, null, 0, 0, null, 0, null],
];

const COLUMNS = 'date, slot, kind, recipe_slug, multiplier, leftovers_date, leftovers_slot, note, outcome, outcome_slug, pantry_settled, checkin_settled, substituted, pinned, drafted';

function atVersion18() {
  const db = new Database(':memory:');
  migrate(db, VERSION_18);
  for (const meal of MEALS) db.prepare(`INSERT INTO plan_entries (${COLUMNS}) VALUES (${meal.map(() => '?').join(', ')})`).run(...meal);
  db.prepare("INSERT INTO pantry_items (name, status, count, pack_size) VALUES ('eggs', 'low', 3.5, '{\"count\":18}')").run();
  db.prepare("INSERT INTO household_settings (key, value) VALUES ('household_profile', '{\"family\":\"us\",\"portions\":4}')").run();
  db.prepare("INSERT INTO checkins (date, meals_done_at, pantry_done_at) VALUES ('2026-10-30', '2026-10-30 19:00:00', '2026-10-30 19:01:00')").run();
  db.prepare("INSERT INTO job_runs (job, run_key, ran_at, completed_at) VALUES ('weekly-plan', '2026-10-25', '2026-10-25 08:00:00', '2026-10-25 08:01:00')").run();
  return db;
}

type DB = ReturnType<typeof atVersion18>;

/** Every old table's definition and every value in it, in a form that shows a change of type or bytes. */
function everything(db: DB) {
  const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT IN ('plan_extras', 'plan_extras_by_date', 'sqlite_sequence') ORDER BY name").all() as { name: string; sql: string | null }[];
  return tables.map(({ name, sql }) => {
    const isTable = sql?.startsWith('CREATE TABLE');
    if (!isTable) return { name, sql };
    const columns = (db.pragma(`table_info(${name})`) as { name: string }[]).map(c => c.name);
    const quoted = columns.map(c => `typeof("${c}") || ':' || quote("${c}")`).join(" || '|' || ");
    return { name, sql, rows: db.prepare(`SELECT ${quoted} AS row FROM "${name}" ORDER BY rowid`).all() };
  });
}

describe('migration 19', () => {
  it('moves to version 19', () => {
    const db = atVersion18();
    migrate(db, 19);
    expect(db.pragma('user_version', { simple: true })).toBe(19);
  });

  it('leaves every old table and value exactly as it was', () => {
    const db = atVersion18();
    const before = everything(db);
    expect(before.find(t => t.name === 'plan_entries')?.rows).toHaveLength(MEALS.length);
    migrate(db, 19);
    expect(everything(db)).toEqual(before);
  });

  it('only adds the table, its index and SQLite’s own counter for AUTOINCREMENT', () => {
    const db = atVersion18();
    const names = () => (db.prepare('SELECT name FROM sqlite_master').all() as { name: string }[]).map(r => r.name);
    const old = new Set(names());
    migrate(db, 19);
    expect(names().filter(n => !old.has(n)).sort()).toEqual(['plan_extras', 'plan_extras_by_date', 'sqlite_sequence']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM plan_extras').get()).toEqual({ n: 0 });
  });

  it('reads the old meals the same way afterwards', () => {
    const db = atVersion18();
    const plan = sqlitePlanRepository(db);
    migrate(db, 19);
    expect(plan.get('2026-10-30', 'dinner')).toMatchObject({
      recipeSlug: 'chili-con-carne', multiplier: 1.5, outcome: 'made', pantrySettled: true, checkinSettled: true, pinned: true,
      substituted: JSON.parse(SUBBED), drafted: JSON.parse(DRAFTED),
    });
    expect(plan.get('2026-10-31', 'lunch')).toMatchObject({ kind: 'leftovers', leftoversOf: { date: '2026-10-30', slot: 'dinner' }, outcomeSlug: 'pb-j' });
    expect(plan.get('2026-11-01', 'breakfast')).toMatchObject({ note: 'Pizza night “out” — 🍕', multiplier: 0.5 });
    expect(plan.range('0000-01-01', '9999-12-31')).toHaveLength(MEALS.length);
  });

  it('runs on a database that’s already there, and not twice', () => {
    const db = atVersion18();
    migrate(db, 19);
    migrate(db, 19);
    expect(db.pragma('user_version', { simple: true })).toBe(19);
  });
});

describe('extras in the plan', () => {
  function plan() {
    const db = new Database(':memory:');
    migrate(db);
    return sqlitePlanRepository(db);
  }
  const extra = (date: string, recipeSlug: string) => {
    const { slot: _slot, ...entry } = { ...blankEntry(date, 'extra-1'), kind: 'recipe' as const, recipeSlug, multiplier: 2, pinned: true };
    return entry;
  };

  it('holds any number on a day, after its meals, in the order they were added', () => {
    const repo = plan();
    const first = repo.addExtra(extra('2026-11-14', 'cake'));
    repo.upsert({ ...blankEntry('2026-11-14', 'dinner'), kind: 'note', note: 'Out' });
    const second = repo.addExtra(extra('2026-11-14', 'rolls'));
    repo.upsert({ ...blankEntry('2026-11-14', 'breakfast'), kind: 'note', note: 'Toast' });
    repo.addExtra(extra('2026-11-15', 'pie'));
    expect(repo.range('2026-11-14', '2026-11-14').map(e => e.slot)).toEqual(['breakfast', 'dinner', first, second]);
    expect(repo.range('2026-11-14', '2026-11-15').map(e => e.date)).toEqual(['2026-11-14', '2026-11-14', '2026-11-14', '2026-11-14', '2026-11-15']);
  });

  it('keeps what happened to one, round trip, and it always counts as a person’s choice', () => {
    const repo = plan();
    const slot = repo.addExtra(extra('2026-11-14', 'cake'));
    const stored = repo.get('2026-11-14', slot)!;
    expect(stored).toMatchObject({ pinned: true, leftoversOf: null, drafted: null, multiplier: 2 });
    repo.upsert({ ...stored, outcome: 'swapped', outcomeSlug: 'pie', pantrySettled: true, checkinSettled: true, substituted: { 1: 'x' } });
    expect(repo.get('2026-11-14', slot)).toMatchObject({ outcome: 'swapped', outcomeSlug: 'pie', pantrySettled: true, checkinSettled: true, substituted: { 1: 'x' } });
  });

  it('only answers for the day it’s on', () => {
    const repo = plan();
    const slot = repo.addExtra(extra('2026-11-14', 'cake'));
    expect(repo.get('2026-11-15', slot)).toBeNull();
    repo.remove('2026-11-15', slot);
    expect(repo.get('2026-11-14', slot)).not.toBeNull();
  });

  it('never fills an extra through the planner’s door', () => {
    const repo = plan();
    expect(repo.fillIfOpen({ ...blankEntry('2026-11-14', 'extra-5'), kind: 'recipe', recipeSlug: 'cake' })).toBe(false);
    expect(repo.range('2026-11-14', '2026-11-14')).toEqual([]);
  });

  it('never gives a slot out twice, so an old screen can’t reach a later extra', () => {
    const repo = plan();
    const first = repo.addExtra(extra('2026-11-14', 'cake'));
    repo.remove('2026-11-14', first);
    expect(repo.addExtra(extra('2026-11-14', 'pie'))).not.toBe(first);
  });

  it('leaves the meal slots alone when one comes off', () => {
    const repo = plan();
    repo.upsert({ ...blankEntry('2026-11-14', 'dinner'), kind: 'note', note: 'Out' });
    repo.remove('2026-11-14', repo.addExtra(extra('2026-11-14', 'cake')));
    expect(repo.range('2026-11-14', '2026-11-14').map(e => e.slot)).toEqual(['dinner']);
  });
});
