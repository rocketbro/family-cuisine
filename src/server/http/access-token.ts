// The optional shared token for anyone exposing this beyond a private network. Scripts send it as
// a bearer token; browsers type it once into a small page and keep a long-lived cookie, which
// holds a digest rather than the token itself. Off entirely when ACCESS_TOKEN isn't set.
import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { accessPage } from './access-page.ts';

const COOKIE = 'cuisine_access';
const MAX_AGE_SECONDS = 400 * 24 * 3600; // the most browsers allow
/** The page itself and what a phone fetches to add the app to its home screen. */
const OPEN_PATHS = /^\/(access|access\.css|manifest\.webmanifest|sw\.js|icon-\d+\.png|apple-touch-icon\.png)$/;

const digest = (text: string) => createHash('sha256').update(`cuisine-access:${text}`).digest();

export function accessRoutes(token: string) {
  return new Hono()
    .get('/access', c => c.html(accessPage(false)))
    .post('/access', async c => {
      const form = await c.req.parseBody();
      const supplied = typeof form.token === 'string' ? form.token : '';
      if (!timingSafeEqual(digest(supplied), digest(token))) return c.html(accessPage(true), 401);
      const secure = new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https';
      // Lax, not Strict: tapping a notification opens the app from outside it. The Origin check covers writes.
      setCookie(c, COOKIE, digest(token).toString('base64url'), { httpOnly: true, sameSite: 'Lax', secure, path: '/', maxAge: MAX_AGE_SECONDS });
      return c.redirect('/', 303);
    });
}

export function accessGate(token: string): MiddlewareHandler {
  const expected = digest(token);
  const expectedCookie = digest(expected.toString('base64url'));
  return async (c, next) => {
    if (OPEN_PATHS.test(c.req.path)) return next();
    const bearer = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')?.[1];
    if (bearer && timingSafeEqual(digest(bearer), expected)) return next();
    const cookie = getCookie(c, COOKIE);
    if (cookie && timingSafeEqual(digest(cookie), expectedCookie)) return next();
    if (c.req.method === 'GET' && !/^\/(api|media)(\/|$)/.test(c.req.path)) return c.html(accessPage(false), 401);
    return c.json({ error: 'This Cuisine needs its access token. Reload the app and enter it.' }, 401);
  };
}
