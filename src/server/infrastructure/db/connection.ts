// One SQLite file holds the household state: pantry, plan, check-ins, push subscriptions.
// Recipes live as markdown files beside it so they stay readable and hand-editable.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrations.ts';

export type DB = Database.Database;

export function openDatabase(file: string): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
