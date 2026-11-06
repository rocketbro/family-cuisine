import { describe, expect, it } from 'vitest';
import { trustProblem, type TrustPolicy } from './request-trust.ts';

const PUBLIC = 'https://kitchen.tail1234.ts.net:8490';
const policy: TrustPolicy = { hostnames: new Set(['localhost', '127.0.0.1', '::1', 'kitchen.tail1234.ts.net']), publicOrigin: PUBLIC };
const PHONE = 'kitchen.tail1234.ts.net:8490';
const post = (host: string, origin?: string, secFetchSite?: string) => trustProblem(policy, { method: 'POST', path: '/api/plan/fill', host, origin, secFetchSite });
const get = (host: string | undefined, path = '/', secFetchSite?: string) => trustProblem(policy, { method: 'GET', path, host, secFetchSite });

describe('the Host header', () => {
  it('accepts the names the app answers to, on any port', () => {
    for (const host of [PHONE, 'kitchen.tail1234.ts.net', '127.0.0.1:2847', 'localhost:5173', '[::1]:2847']) expect(get(host)).toBeNull();
  });

  it('refuses everything else, which is what stops DNS rebinding', () => {
    for (const host of ['evil.example', 'evil.example:2847', 'kitchen.tail1234.ts.net.evil.example', '127.0.0.1@evil.example']) expect(get(host)).toContain('ALLOWED_HOSTS');
    expect(get(undefined)).toContain('ALLOWED_HOSTS');
  });
});

describe('writes', () => {
  it('accept the installed app, whose Origin is its own address', () => {
    expect(post(PHONE, PUBLIC)).toBeNull();
    expect(post('127.0.0.1:2905', 'http://127.0.0.1:2905')).toBeNull();
    expect(post('localhost:5173', 'http://localhost:5173')).toBeNull();
  });

  it('accept the public address when a proxy rewrites Host to loopback', () => {
    expect(post('127.0.0.1:2847', PUBLIC)).toBeNull();
  });

  it('treat a default port the same as none', () => {
    const open: TrustPolicy = { hostnames: new Set(['cuisine.example']), publicOrigin: null };
    expect(trustProblem(open, { method: 'POST', path: '/', host: 'cuisine.example', origin: 'https://cuisine.example' })).toBeNull();
    expect(trustProblem(open, { method: 'POST', path: '/', host: 'cuisine.example:443', origin: 'https://cuisine.example' })).toBeNull();
  });

  it('refuse other sites, including other ports on the same machine', () => {
    expect(post(PHONE, 'https://evil.example')).not.toBeNull();
    expect(post('127.0.0.1:2847', 'http://127.0.0.1:9999')).not.toBeNull();
    expect(post('127.0.0.1:2847', 'http://localhost:2847')).not.toBeNull();
    expect(post(PHONE, 'https://kitchen.tail1234.ts.net:9443')).not.toBeNull();
    expect(post(PHONE, 'null')).not.toBeNull();
    expect(post(PHONE, 'not a url')).not.toBeNull();
  });

  it('let scripts through with no Origin, unless fetch metadata says it’s a browser on another site', () => {
    expect(post('127.0.0.1:2847')).toBeNull();
    expect(post(PHONE, undefined, 'same-origin')).toBeNull();
    expect(post(PHONE, undefined, 'cross-site')).not.toBeNull();
    expect(post(PHONE, undefined, 'same-site')).not.toBeNull();
  });

  it('cover every method that changes something', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      expect(trustProblem(policy, { method, path: '/api/x', host: PHONE, origin: 'https://evil.example' })).not.toBeNull();
    }
  });
});

describe('reads', () => {
  it('need no Origin, since same-origin GETs from the app send none', () => {
    expect(get(PHONE, '/api/status')).toBeNull();
    expect(get(PHONE, '/api/status', 'same-origin')).toBeNull();
    expect(get(PHONE, '/', 'none')).toBeNull();
  });

  it('refuse a cross-site request to the API, but not a link to the app', () => {
    expect(get(PHONE, '/api/shopping', 'cross-site')).not.toBeNull();
    expect(get(PHONE, '/week', 'cross-site')).toBeNull();
  });
});
