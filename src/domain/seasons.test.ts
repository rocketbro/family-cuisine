import { describe, expect, it } from 'vitest';
import { inSeason, normalSeasons, seasonOf, SEASONS } from './seasons.ts';

describe('seasons', () => {
  it('goes by the month', () => {
    expect(['2026-12-01', '2027-02-28', '2027-03-01', '2027-06-01', '2027-08-31', '2027-09-01'].map(seasonOf)).toEqual(['winter', 'winter', 'spring', 'summer', 'summer', 'fall']);
  });
  it('treats no seasons as all year', () => {
    expect(inSeason({ seasons: [] }, '2027-07-01')).toBe(true);
    expect(inSeason({ seasons: ['summer'] }, '2027-07-01')).toBe(true);
    expect(inSeason({ seasons: ['summer'] }, '2027-01-01')).toBe(false);
  });
  it('stores all four as none, and drops anything unknown', () => {
    expect(normalSeasons(['winter', 'fall', 'monsoon'])).toEqual(['fall', 'winter']);
    expect(normalSeasons(SEASONS)).toEqual([]);
  });
});
