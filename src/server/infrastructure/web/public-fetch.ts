// Follows a link across the public internet by hand, so every redirect gets the same check as the
// first URL. The transport does the talking, which keeps the policy here testable.
import net from 'node:net';
import { UserError } from '../../application/user-error.ts';
import { bareHost, isPublicAddress, PRIVATE_LINK, urlProblem } from './public-address.ts';

export type HttpReply = {
  status: number;
  header(name: string): string | null;
  /** The body after decompression, stopping once `maxBytes` have arrived. */
  read(maxBytes: number): Promise<Buffer>;
  discard(): void;
};

export type WebTransport = {
  open(url: URL, signal: AbortSignal): Promise<HttpReply>;
  resolve(hostname: string): Promise<string[]>;
  /** Behind a proxy the proxy does the real lookup, and local DNS may not work at all. */
  proxied: boolean;
};

const MAX_REDIRECTS = 5;

async function assertPublic(url: URL, transport: WebTransport): Promise<void> {
  const problem = urlProblem(url);
  if (problem) throw new UserError(problem, 422);
  const host = bareHost(url);
  if (net.isIP(host)) return;
  let addresses: string[];
  try {
    addresses = await transport.resolve(host);
  } catch {
    if (transport.proxied) return;
    throw new UserError('Couldn’t find that site. Check the link.', 422);
  }
  if (!addresses.length || !addresses.every(isPublicAddress)) throw new UserError(PRIVATE_LINK, 422);
}

export async function fetchPublic(start: URL, transport: WebTransport, signal: AbortSignal): Promise<{ url: URL; reply: HttpReply }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(url, transport);
    const reply = await transport.open(url, signal);
    const location = reply.status >= 300 && reply.status < 400 ? reply.header('location') : null;
    if (!location) return { url, reply };
    reply.discard();
    try {
      url = new URL(location, url);
    } catch {
      throw new UserError('That page redirected somewhere unreadable.', 422);
    }
  }
  throw new UserError('That link redirects too many times.', 422);
}
