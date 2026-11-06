import type { AvoidedMeal } from '../../../domain/avoided-meal.ts';
import type { AvoidedMealRepository } from '../../application/ports/avoided-meals.ts';
import type { DB } from './connection.ts';

export function sqliteAvoidedMealRepository(db: DB): AvoidedMealRepository {
  return {
    list: () => db.prepare('SELECT id, title, reason FROM avoided_meals ORDER BY created_at DESC, id DESC').all() as AvoidedMeal[],
    add: (title, reason) => void db.prepare('INSERT INTO avoided_meals (title, reason) VALUES (?, ?)').run(title, reason),
    remove: id => void db.prepare('DELETE FROM avoided_meals WHERE id = ?').run(id),
  };
}
