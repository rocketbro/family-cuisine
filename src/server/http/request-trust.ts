// Which requests the app believes. A hostile page can make a browser on the same machine or
// network reach this server, so the Host header (DNS rebinding) and the Origin header (cross-site
// writes) both have to name us. Hono's csrf middleware doesn't fit: it skips JSON content types
// and passes on either of its two signals, and every write here should be checked.
import { parseHost } from '../config-rules.ts';

export type TrustPolicy = { hostnames: ReadonlySet<string>; publicOrigin: string | null };
export type RequestFacts = { method: string; path: string; host?: string; origin?: string; secFetchSite?: string };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const OTHER_SITE = 'Requests from other sites aren’t allowed.';

/** The same host and port the request was addressed to, or exactly the configured public address. */
function originTrusted(policy: TrustPolicy, origin: string, host: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // includes the "null" origin of sandboxes and data: pages
  }
  if (url.origin === policy.publicOrigin) return true;
  const target = parseHost(host);
  const from = parseHost(url.host);
  if (!target || !from) return false;
  const defaultPort = url.protocol === 'https:' ? '443' : '80';
  return target.hostname === from.hostname && (target.port || defaultPort) === (from.port || defaultPort);
}

/** Why this request must be refused, or null if it may go ahead. */
export function trustProblem(policy: TrustPolicy, request: RequestFacts): string | null {
  const host = request.host ? parseHost(request.host) : null;
  if (!request.host || !host || !policy.hostnames.has(host.hostname)) {
    return `This server doesn't answer to "${request.host ?? ''}". If that's your address for it, add it to ALLOWED_HOSTS.`;
  }
  const crossSite = request.secFetchSite === 'cross-site';
  if (SAFE_METHODS.has(request.method)) {
    // Some reads do a little work (the shopping list records itself), so no drive-by images.
    return crossSite && /^\/api(\/|$)/.test(request.path) ? OTHER_SITE : null;
  }
  if (request.origin !== undefined) return originTrusted(policy, request.origin, request.host) ? null : OTHER_SITE;
  // Browsers send Origin on writes, so this is a script, which has no browser's place on the
  // network to borrow. Fetch metadata still catches a browser that left it out.
  return crossSite || request.secFetchSite === 'same-site' ? OTHER_SITE : null;
}
