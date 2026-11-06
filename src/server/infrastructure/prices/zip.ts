// ZIP code → coordinates and place name, from Zippopotam.us (free, no key).
import type { ZipLookupPort } from '../../application/ports/prices.ts';
import { UserError } from '../../application/user-error.ts';

export function zippopotam(): ZipLookupPort {
  return {
    async locate(zip) {
      const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, { signal: AbortSignal.timeout(10_000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new UserError(`Couldn’t look up that ZIP code (HTTP ${response.status}).`, 502);
      const data = await response.json() as { places?: { 'place name': string; 'state abbreviation': string; latitude: string; longitude: string }[] };
      const place = data.places?.[0];
      return place ? { latitude: Number(place.latitude), longitude: Number(place.longitude), place: `${place['place name']}, ${place['state abbreviation']}` } : null;
    },
  };
}
