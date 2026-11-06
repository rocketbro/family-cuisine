import { describe, expect, it } from 'vitest';
import { isPrivateName, isPublicAddress, PRIVATE_LINK, urlProblem } from './public-address.ts';

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '151.101.1.69', '100.63.255.255', '100.128.0.0', '172.32.0.1', '2606:4700:4700::1111', '2a00:1450:4001:81b::200e'])('allows %s', address => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ['loopback', '127.0.0.1'], ['loopback range', '127.8.8.8'], ['this host', '0.0.0.0'],
    ['RFC1918', '10.0.0.1'], ['RFC1918', '172.16.0.1'], ['RFC1918', '172.31.255.255'], ['RFC1918', '192.168.1.1'],
    ['link-local and cloud metadata', '169.254.169.254'], ['tailnet', '100.64.0.1'], ['tailnet', '100.100.100.100'], ['tailnet', '100.127.255.255'],
    ['test net', '192.0.2.1'], ['benchmark', '198.18.0.1'], ['multicast', '224.0.0.1'], ['reserved', '240.0.0.1'], ['broadcast', '255.255.255.255'],
    ['v6 loopback', '::1'], ['v6 unspecified', '::'], ['v6 link-local', 'fe80::1'], ['v6 link-local with zone', 'fe80::1%en0'],
    ['v6 unique local', 'fc00::1'], ['tailnet v6', 'fd7a:115c:a1e0::1'], ['v6 multicast', 'ff02::1'],
    ['mapped loopback', '::ffff:127.0.0.1'], ['mapped loopback in hex', '::ffff:7f00:1'], ['mapped RFC1918', '::ffff:10.0.0.1'], ['mapped metadata', '::ffff:a9fe:a9fe'],
    ['v4-compatible', '::127.0.0.1'], ['NAT64', '64:ff9b::7f00:1'], ['6to4 of private', '2002:7f00:1::'], ['Teredo', '2001:0:4136:e378::1'], ['documentation', '2001:db8::1'],
    ['bracketed', '[::1]'],
    ['not an address', 'example.com'], ['empty', ''],
  ])('refuses %s (%s)', (_kind, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe('isPrivateName', () => {
  it.each(['localhost', 'foo.localhost', 'printer', 'nas.local', 'metadata.google.internal', 'kitchen.tail1234.ts.net', 'router.lan', 'LOCALHOST.', 'x.home.arpa'])('refuses %s', name => {
    expect(isPrivateName(name)).toBe(true);
  });
  it.each(['www.seriouseats.com', 'allrecipes.com', 'local.example.com'])('allows %s', name => {
    expect(isPrivateName(name)).toBe(false);
  });
});

describe('urlProblem', () => {
  const problem = (url: string) => urlProblem(new URL(url));

  it('passes ordinary links to a lookup', () => {
    expect(problem('https://www.seriouseats.com/x')).toBeNull();
    expect(problem('http://8.8.8.8:8080/')).toBeNull();
  });

  it('refuses other schemes and embedded passwords', () => {
    expect(problem('file:///etc/passwd')).toContain('web links');
    expect(problem('ftp://example.com/')).toContain('web links');
    expect(problem('https://user:pw@example.com/')).toContain('password');
  });

  // These all parse to private addresses, however they were spelled.
  it.each(['http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'http://0177.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]:2847/', 'http://localhost:2847/', 'http://169.254.169.254/latest/meta-data/', 'http://100.100.100.100/', 'http://[fd7a:115c:a1e0::1]/'])('refuses %s', url => {
    expect(problem(url)).toBe(PRIVATE_LINK);
  });
});
