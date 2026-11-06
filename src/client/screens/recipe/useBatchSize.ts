// The batch size on the recipe screen, saved to the plan when the recipe is opened from one.
import { useState } from 'react';
import type { ISODate } from '../../../domain/dates.ts';
import type { PlanSlot } from '../../../domain/plan-slot.ts';
import { api } from '../../api.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { batchSizeChanger } from './batch-size.ts';

export function useBatchSize(start: number, planned: { date: ISODate; slot: PlanSlot } | null) {
  const [factor, setFactor] = useState(start);
  const { run, problem, retry } = useWrite();
  const [changer] = useState(() => batchSizeChanger(start, setFactor, run));
  const change = (size: number) => changer(size, planned ? () => api.setMultiplier(planned.date, planned.slot, size) : null);
  return { factor, change, problem, retry };
}
