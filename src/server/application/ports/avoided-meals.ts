import type { AvoidedMeal } from '../../../domain/avoided-meal.ts';

export type AvoidedMealRepository = {
  list(): AvoidedMeal[];
  add(title: string, reason: string | null): void;
  remove(id: number): void;
};
