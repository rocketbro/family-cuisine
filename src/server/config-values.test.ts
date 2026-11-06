import { describe, expect, it } from 'vitest';
import { defaultDataDir, expandHome, flagIsOn, pathSetting } from './config-values.ts';

describe('path settings', () => {
  it('expands a leading ~ so no folder named "~" lands in the checkout', () => {
    expect(expandHome('~', '/home/sam')).toBe('/home/sam');
    expect(expandHome('~/cuisine data', '/home/sam')).toBe('/home/sam/cuisine data');
  });
  it('leaves other paths alone, including another user\'s ~', () => {
    expect(expandHome('/srv/cuisine', '/home/sam')).toBe('/srv/cuisine');
    expect(expandHome('~other/cuisine', '/home/sam')).toBe('~other/cuisine');
    expect(expandHome('data/~', '/home/sam')).toBe('data/~');
  });
  it('makes relative paths absolute from the working directory', () => {
    expect(pathSetting('./data', '/home/sam', '/srv/app')).toBe('/srv/app/data');
    expect(pathSetting('~/data', '/home/sam', '/srv/app')).toBe('/home/sam/data');
  });
});

describe('the default data directory', () => {
  it('stays in Application Support on macOS, where existing installs keep their data', () => {
    expect(defaultDataDir('darwin', '/Users/sam', undefined)).toBe('/Users/sam/Library/Application Support/Cuisine');
    expect(defaultDataDir('darwin', '/Users/sam', '/ignored')).toBe('/Users/sam/Library/Application Support/Cuisine');
  });
  it('follows the XDG convention on Linux', () => {
    expect(defaultDataDir('linux', '/home/sam', undefined)).toBe('/home/sam/.local/share/cuisine');
    expect(defaultDataDir('linux', '/home/sam', '/data/xdg')).toBe('/data/xdg/cuisine');
  });
});

describe('optional lookups', () => {
  it('are off unless plainly turned on', () => {
    for (const value of [undefined, '', '0', 'off', 'false', 'no', 'onn']) expect(flagIsOn(value)).toBe(false);
    for (const value of ['on', 'ON', 'true', '1', 'yes', ' on ']) expect(flagIsOn(value)).toBe(true);
  });
});
