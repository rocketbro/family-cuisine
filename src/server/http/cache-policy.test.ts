import { describe, expect, it } from 'vitest';
import { cachePolicyFor } from './cache-policy.ts';

describe('cachePolicyFor', () => {
  it('never lets a phone keep a page, so going back can’t bring back an old build', () => {
    for (const page of ['/', '/recipes', '/recipes/chicken-taco-soup', '/day/2026-11-06', '/access']) {
      expect(cachePolicyFor(page)).toBe('no-store');
    }
  });

  it('rechecks the API and files with fixed names', () => {
    for (const path of ['/api/recipes', '/sw.js', '/preferences.js', '/manifest.webmanifest']) {
      expect(cachePolicyFor(path)).toBe('no-cache');
    }
  });

  it('keeps hashed assets for good and leaves photos to their route', () => {
    expect(cachePolicyFor('/assets/index-abc.js')).toContain('immutable');
    expect(cachePolicyFor('/media/soup.webp')).toBeNull();
  });
});
