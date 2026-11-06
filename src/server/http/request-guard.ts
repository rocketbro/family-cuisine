// The request-trust rules as middleware. Each refused host is logged once, so a misconfigured
// address can be found in the log without a stranger being able to fill it.
import type { MiddlewareHandler } from 'hono';
import { trustProblem, type TrustPolicy } from './request-trust.ts';

const MAX_LOGGED = 20;

export function requestGuard(policy: TrustPolicy, log: (message: string) => void): MiddlewareHandler {
  const logged = new Set<string>();
  return async (c, next) => {
    const host = c.req.header('host');
    const origin = c.req.header('origin');
    const problem = trustProblem(policy, { method: c.req.method, path: c.req.path, host, origin, secFetchSite: c.req.header('sec-fetch-site') });
    if (!problem) return next();
    const key = `${host}|${origin}`.slice(0, 300);
    if (logged.size < MAX_LOGGED && !logged.has(key)) {
      logged.add(key);
      log(`refused ${c.req.method} ${c.req.path}: host ${JSON.stringify(host)}, origin ${JSON.stringify(origin ?? null)}`);
    }
    return c.json({ error: problem }, 403);
  };
}
