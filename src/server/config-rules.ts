// Decisions about the environment, kept pure so they can be tested without loading it.

export const MIN_TOKEN_LENGTH = 16;

/** Parses a Host header value or host:port. Null for anything that isn't plainly one. */
export function parseHost(value: string): { hostname: string; port: string } | null {
  if (!/^[a-z0-9._\-[\]:]+$/i.test(value)) return null;
  try {
    const url = new URL(`http://${value}`);
    return { hostname: url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase(), port: url.port };
  } catch {
    return null;
  }
}

/** A bind address may be a bare IPv6 one, which needs its brackets before it can be parsed. */
const bindName = (host: string) => parseHost(host.includes(':') && !host.startsWith('[') ? `[${host}]` : host)?.hostname ?? null;

export function isLoopbackHost(host: string): boolean {
  const name = bindName(host);
  if (!name) return false;
  return name === 'localhost' || name.endsWith('.localhost') || name === '::1' || /^127\./.test(name);
}

function hostOfUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return parseHost(new URL(value).host)?.hostname ?? null;
  } catch {
    return null;
  }
}

/**
 * Which names the app answers to: loopback, PUBLIC_URL's host, ALLOWED_HOSTS, and the address it
 * binds to if that's a specific one. Ports don't count: DNS rebinding needs a hostile name.
 */
export function allowedHostnames(opts: { publicUrl: string | null; allowedHosts: string | null; bindHost: string }): string[] {
  const listed = (opts.allowedHosts ?? '').split(/[\s,]+/).filter(Boolean)
    .map(entry => parseHost(entry.replace(/^https?:\/\//i, '').replace(/\/.*$/, ''))?.hostname);
  const bound = bindName(opts.bindHost);
  const wildcard = bound === '0.0.0.0' || bound === '::';
  const names = ['localhost', '127.0.0.1', '::1', hostOfUrl(opts.publicUrl), ...listed, wildcard ? null : bound];
  return [...new Set(names.filter((name): name is string => Boolean(name)))];
}

/** Why the server must not start with these settings, or null if it may. */
export function startupProblem(opts: { host: string; accessToken: string | null; allowOpenNetwork: boolean }): string | null {
  if (opts.accessToken && opts.accessToken.length < MIN_TOKEN_LENGTH) {
    return `ACCESS_TOKEN is too short to protect anything. Use at least ${MIN_TOKEN_LENGTH} characters (openssl rand -hex 24).`;
  }
  if (isLoopbackHost(opts.host) || opts.accessToken || opts.allowOpenNetwork) return null;
  return `HOST=${opts.host} would put your household's data on the network with no password. `
    + 'Set ACCESS_TOKEN, or keep HOST on 127.0.0.1 behind `tailscale serve`, or set ALLOW_OPEN_NETWORK=1 if the network itself is the protection.';
}

/**
 * Web push needs an https: or mailto: contact. VAPID_SUBJECT wins; otherwise PUBLIC_URL serves if
 * it's https. Null means nothing usable is set.
 */
export function vapidSubject(opts: { subject: string | null; publicUrl: string | null }): string | null {
  const usable = (value: string | null) => {
    if (!value) return false;
    try {
      return ['https:', 'mailto:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  };
  if (opts.subject) return usable(opts.subject) ? opts.subject : null;
  return usable(opts.publicUrl) ? opts.publicUrl : null;
}
