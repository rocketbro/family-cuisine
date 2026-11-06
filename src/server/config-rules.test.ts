import { describe, expect, it } from 'vitest';
import { allowedHostnames, isLoopbackHost, parseHost, startupProblem, vapidSubject } from './config-rules.ts';

const TOKEN = 'a-long-enough-shared-token';

describe('allowed hosts', () => {
  it('defaults to loopback plus PUBLIC_URL’s host, whatever its port', () => {
    const names = allowedHostnames({ publicUrl: 'https://kitchen.tail1234.ts.net:8490', allowedHosts: null, bindHost: '127.0.0.1' });
    expect(names).toEqual(['localhost', '127.0.0.1', '::1', 'kitchen.tail1234.ts.net']);
  });

  it('adds ALLOWED_HOSTS, in whatever form someone writes them', () => {
    const names = allowedHostnames({ publicUrl: null, allowedHosts: 'Cuisine.example.com:8443, https://other.example/,  [fd7a::1]', bindHost: '127.0.0.1' });
    expect(names).toEqual(expect.arrayContaining(['cuisine.example.com', 'other.example', 'fd7a::1']));
  });

  it('includes a specific bind address, not a wildcard', () => {
    expect(allowedHostnames({ publicUrl: null, allowedHosts: null, bindHost: '192.168.1.5' })).toContain('192.168.1.5');
    expect(allowedHostnames({ publicUrl: null, allowedHosts: null, bindHost: '0.0.0.0' })).not.toContain('0.0.0.0');
    expect(allowedHostnames({ publicUrl: null, allowedHosts: null, bindHost: '::' })).not.toContain('::');
  });

  it('parses host headers strictly', () => {
    expect(parseHost('KITCHEN.ts.net.:8490')).toEqual({ hostname: 'kitchen.ts.net', port: '8490' });
    expect(parseHost('[::1]:2847')).toEqual({ hostname: '::1', port: '2847' });
    expect(parseHost('127.0.0.1@evil.example')).toBeNull();
    expect(parseHost('127.0.0.1/evil')).toBeNull();
  });
});

describe('starting on the network', () => {
  it('knows loopback', () => {
    for (const host of ['127.0.0.1', '127.1.2.3', 'localhost', '::1', '[::1]']) expect(isLoopbackHost(host)).toBe(true);
    for (const host of ['0.0.0.0', '::', '192.168.1.5', '100.64.0.1', 'kitchen.ts.net']) expect(isLoopbackHost(host)).toBe(false);
  });

  it('is fine on loopback with no token, which is how a tailnet install runs', () => {
    expect(startupProblem({ host: '127.0.0.1', accessToken: null, allowOpenNetwork: false })).toBeNull();
  });

  it('refuses a network address with no token', () => {
    expect(startupProblem({ host: '0.0.0.0', accessToken: null, allowOpenNetwork: false })).toContain('ACCESS_TOKEN');
    expect(startupProblem({ host: '192.168.1.5', accessToken: null, allowOpenNetwork: false })).toContain('ALLOW_OPEN_NETWORK');
  });

  it('allows it with a token or the explicit override', () => {
    expect(startupProblem({ host: '0.0.0.0', accessToken: TOKEN, allowOpenNetwork: false })).toBeNull();
    expect(startupProblem({ host: '0.0.0.0', accessToken: null, allowOpenNetwork: true })).toBeNull();
  });

  it('refuses a token too short to protect anything, even on loopback', () => {
    expect(startupProblem({ host: '127.0.0.1', accessToken: 'hunter2', allowOpenNetwork: false })).toContain('too short');
  });
});

describe('the web push contact', () => {
  it('keeps using an https PUBLIC_URL when nothing else is set, as a tailnet install does', () => {
    expect(vapidSubject({ subject: null, publicUrl: 'https://kitchen.tail1234.ts.net:8490' })).toBe('https://kitchen.tail1234.ts.net:8490');
  });

  it('prefers VAPID_SUBJECT', () => {
    expect(vapidSubject({ subject: 'mailto:me@example.com', publicUrl: 'https://kitchen.example' })).toBe('mailto:me@example.com');
    expect(vapidSubject({ subject: 'mailto:me@example.com', publicUrl: 'http://127.0.0.1:2847' })).toBe('mailto:me@example.com');
  });

  it('has nothing usable from a plain-http address or a bad subject', () => {
    expect(vapidSubject({ subject: null, publicUrl: 'http://127.0.0.1:2847' })).toBeNull();
    expect(vapidSubject({ subject: 'me@example.com', publicUrl: 'https://kitchen.example' })).toBeNull();
    expect(vapidSubject({ subject: null, publicUrl: null })).toBeNull();
  });
});
