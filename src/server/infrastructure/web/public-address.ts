// Which addresses a fetch on behalf of a link may reach. Only the public internet: never this
// machine, the home network, the tailnet or cloud metadata. Anything not understood is refused.
import net from 'node:net';

export const PRIVATE_LINK = 'That link points inside a private network, so it can’t be imported.';

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
];
// IPv6 is refused outside global unicast, which covers loopback, unique-local (the tailnet too),
// link-local, multicast, IPv4-mapped and NAT64. These are the exceptions inside it: IETF
// special-purpose including Teredo, documentation, and 6to4, which can wrap a private IPv4.
const PRIVATE_V6: [string, number][] = [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]];

const privateAddresses = new net.BlockList();
for (const [address, prefix] of PRIVATE_V4) privateAddresses.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of PRIVATE_V6) privateAddresses.addSubnet(address, prefix, 'ipv6');
const globalUnicast = new net.BlockList();
globalUnicast.addSubnet('2000::', 3, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const family = net.isIP(bare);
  if (family === 4) return !privateAddresses.check(bare, 'ipv4');
  if (family === 6) return globalUnicast.check(bare, 'ipv6') && !privateAddresses.check(bare, 'ipv6');
  return false;
}

/** Names that only mean something inside a network, checked first since a proxy may resolve them. */
export function isPrivateName(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/\.$/, '');
  return !name.includes('.') || /\.(localhost|local|localdomain|internal|intranet|lan|home|corp|home\.arpa|ts\.net)$/.test(name);
}

/** The host of a URL without IPv6 brackets. WHATWG URL has already normalized odd IPv4 forms. */
export const bareHost = (url: URL) => url.hostname.replace(/^\[|\]$/g, '');

/** Why this URL can't be fetched, as far as can be told before looking anything up. */
export function urlProblem(url: URL): string | null {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Only web links can be imported.';
  if (url.username || url.password) return 'Links with a password in them can’t be imported.';
  const host = bareHost(url);
  return (net.isIP(host) ? !isPublicAddress(host) : isPrivateName(host)) ? PRIVATE_LINK : null;
}
