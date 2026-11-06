import { describe, expect, it } from 'vitest';
import { isSettings, parentOf } from './tabs.ts';

describe('where back goes with nothing to say otherwise', () => {
  it('steps up through settings, one screen at a time', () => {
    expect(parentOf('/settings/stock-up/12', 'today')).toBe('/settings/stock-up');
    expect(parentOf('/settings/stock-up/add', 'today')).toBe('/settings/stock-up');
    expect(parentOf('/settings/stock-up', 'today')).toBe('/settings');
    expect(parentOf('/settings/shopping/move', 'today')).toBe('/settings/shopping');
    expect(parentOf('/settings/shopping', 'today')).toBe('/settings');
    expect(parentOf('/settings/notifications', 'today')).toBe('/settings');
  });
  it('leaves settings for the tab it was opened in', () => {
    expect(parentOf('/settings', 'today')).toBe('/');
    expect(parentOf('/settings', 'shop')).toBe('/shop');
  });
});

describe('telling settings apart', () => {
  it('covers its screens and nothing with a similar name', () => {
    expect(isSettings('/settings')).toBe(true);
    expect(isSettings('/settings/stock-up/3')).toBe(true);
    expect(isSettings('/settingsish')).toBe(false);
    expect(isSettings('/pantry')).toBe(false);
  });
});
