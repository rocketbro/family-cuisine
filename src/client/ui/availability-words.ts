// "Can we make this?" in a sentence, for anywhere that has room for more than the status mark.
import type { Availability } from '../../domain/availability.ts';

export function describe({ level, missing, short, low }: Availability): string {
  if (level === 'ready') return low.length ? `Ready to cook · running low on ${list(low)}` : 'You have everything';
  const notEnough = short.length ? [`not enough ${list(short)}`] : [];
  if (level === 'most') return `Almost there · ${[...(missing.length ? [`missing ${list(missing)}`] : []), ...notEnough].join(', ')}`;
  const gone = missing.length === 1 ? ['missing 1 thing'] : missing.length ? [`missing ${missing.length} things`] : [];
  return `Needs shopping · ${[...gone, ...notEnough].join(', ')}`;
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
