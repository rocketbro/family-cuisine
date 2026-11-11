import { jobClaimable } from '../../../domain/job-run.ts';
import type { Store } from '../../../domain/pantry.ts';
import type { HouseholdRepository } from '../../application/ports/household.ts';
import type { PushRepository, PushSubscriptionRecord } from '../../application/ports/notifications.ts';
import type { DB } from './connection.ts';

export function sqliteHouseholdRepository(db: DB): HouseholdRepository {
  return {
    storeFor(shopDate) {
      const row = db.prepare('SELECT store FROM week_stores WHERE shop_date = ?').get(shopDate) as { store: Store } | undefined;
      return row?.store ?? null;
    },
    setStore(shopDate, store) {
      db.prepare('INSERT INTO week_stores (shop_date, store) VALUES (?, ?) ON CONFLICT (shop_date) DO UPDATE SET store = excluded.store').run(shopDate, store);
    },
    checkin(date) {
      const row = db.prepare('SELECT meals_done_at, pantry_done_at FROM checkins WHERE date = ?').get(date) as { meals_done_at: string | null; pantry_done_at: string | null } | undefined;
      return { mealsDone: Boolean(row?.meals_done_at), pantryDone: Boolean(row?.pantry_done_at) };
    },
    firstCheckin() {
      return (db.prepare('SELECT MIN(date) AS first FROM checkins').get() as { first: string | null }).first;
    },
    markCheckin(date, step) {
      const column = step === 'meals' ? 'meals_done_at' : 'pantry_done_at';
      db.prepare(`INSERT INTO checkins (date, ${column}) VALUES (?, datetime('now')) ON CONFLICT (date) DO UPDATE SET ${column} = datetime('now')`).run(date);
    },
    setting(key) {
      return (db.prepare('SELECT value FROM household_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null;
    },
    saveSetting(key, value) {
      if (value === null) db.prepare('DELETE FROM household_settings WHERE key = ?').run(key);
      else db.prepare('INSERT INTO household_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
    },
    shopTrips() {
      return (db.prepare('SELECT date FROM shop_trips ORDER BY date').all() as { date: string }[]).map(row => row.date);
    },
    saveShopTrips: dates => db.transaction(() => {
      db.prepare('DELETE FROM shop_trips').run();
      const insert = db.prepare('INSERT INTO shop_trips (date) VALUES (?)');
      for (const date of dates) insert.run(date);
    })(),
    claimJob: (job, runKey, now, leaseUntil) => db.transaction(() => {
      const row = db.prepare('SELECT completed_at, lease_until FROM job_runs WHERE job = ? AND run_key = ?')
        .get(job, runKey) as { completed_at: string | null; lease_until: string | null } | undefined;
      if (!jobClaimable(row ? { completedAt: row.completed_at, leaseUntil: row.lease_until } : null, now)) return false;
      db.prepare('INSERT INTO job_runs (job, run_key, lease_until) VALUES (?, ?, ?) ON CONFLICT (job, run_key) DO UPDATE SET lease_until = excluded.lease_until')
        .run(job, runKey, leaseUntil);
      return true;
    })(),
    jobCompleted(job, runKey) {
      return db.prepare('SELECT 1 FROM job_runs WHERE job = ? AND run_key = ? AND completed_at IS NOT NULL').get(job, runKey) !== undefined;
    },
    completeJob(job, runKey) {
      db.prepare("UPDATE job_runs SET completed_at = datetime('now'), lease_until = NULL WHERE job = ? AND run_key = ?").run(job, runKey);
    },
    releaseJob(job, runKey, retryAt) {
      db.prepare('UPDATE job_runs SET lease_until = ? WHERE job = ? AND run_key = ?').run(retryAt, job, runKey);
    },
  };
}

export function sqlitePushRepository(db: DB): PushRepository {
  return {
    list: () =>
      (db.prepare('SELECT endpoint, person, keys FROM push_subscriptions').all() as { endpoint: string; person: string; keys: string }[]).map(row => ({
        endpoint: row.endpoint, person: row.person, keys: JSON.parse(row.keys) as PushSubscriptionRecord['keys'],
      })),
    save(record) {
      db.prepare('INSERT INTO push_subscriptions (endpoint, person, keys) VALUES (?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET person = excluded.person, keys = excluded.keys')
        .run(record.endpoint, record.person, JSON.stringify(record.keys));
    },
    remove: endpoint => void db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint),
  };
}
