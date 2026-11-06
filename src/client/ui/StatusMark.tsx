// The green / amber / red answer to "can we make this right now?"
import type { Availability } from '../../domain/availability.ts';
import { describe } from './availability-words.ts';

export function StatusMark({ availability, detailed = false }: { availability: Availability; detailed?: boolean }) {
  return (
    <span className="status">
      <span className={`dot ${availability.level}`} aria-hidden="true" />
      {detailed ? describe(availability) : SHORT[availability.level]}
    </span>
  );
}

const SHORT = { ready: 'Ready to cook', most: 'Almost there', missing: 'Needs shopping' } as const;
