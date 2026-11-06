import { describe, expect, it } from 'vitest';
import { isTrustedImageUrl } from './image-source.ts';

describe('isTrustedImageUrl', () => {
  it('takes the family’s photos and Unsplash', () => {
    expect(isTrustedImageUrl('/media/soup-1.webp')).toBe(true);
    expect(isTrustedImageUrl('https://images.unsplash.com/photo-1?w=100')).toBe(true);
  });

  it.each(['https://evil.example/x.png?d=eggs', 'http://images.unsplash.com/x', 'https://images.unsplash.com.evil.example/x', 'https://plus.unsplash.com/x', '//evil.example/x', 'data:image/png;base64,AA', 'javascript:alert(1)', 'x.png', '', undefined])('refuses %s', src => {
    expect(isTrustedImageUrl(src)).toBe(false);
  });
});
