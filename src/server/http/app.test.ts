// Through the whole Hono app in memory, set up the way a tailnet install runs: on loopback behind
// `tailscale serve`, which keeps the phone's Host header, and with no access token.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { memoryRecordings, M4A_BYTES, OGG_BYTES, WEBM_BYTES } from '../application/test-support/recording-fakes.ts';
import { fakeDeps } from '../application/test-support/full-deps-fake.ts';
import { UserError } from '../application/user-error.ts';
import { createApp } from './app.ts';
import { GENERIC_ERROR } from './error-response.ts';
import { isJsonRequest } from './validate.ts';

const PUBLIC = 'https://kitchen.tail1234.ts.net:8490';
const PHONE = 'kitchen.tail1234.ts.net:8490';
const trust = { hostnames: new Set(['localhost', '127.0.0.1', '::1', 'kitchen.tail1234.ts.net']), publicOrigin: PUBLIC };
const TOKEN = 'a-long-enough-shared-token';

let clientDir: string;
beforeAll(() => {
  clientDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuisine-client-'));
  fs.mkdirSync(path.join(clientDir, 'assets'));
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><title>shell</title>');
  fs.writeFileSync(path.join(clientDir, 'sw.js'), '// sw');
  fs.writeFileSync(path.join(clientDir, 'manifest.webmanifest'), '{}');
  fs.writeFileSync(path.join(clientDir, 'assets', 'app-abc.js'), '// app');
});
afterAll(() => fs.rmSync(clientDir, { recursive: true, force: true }));

function setup(accessToken: string | null = null) {
  const deps = fakeDeps({ ai: false });
  const recordings = memoryRecordings();
  deps.recordings = recordings;
  const saved: unknown[] = [];
  deps.subscriptions = { list: () => [], save: sub => void saved.push(sub), remove: () => undefined };
  const app = createApp(deps, { clientDir, trust, accessToken });
  const send = (url: string, init: RequestInit & { host?: string } = {}) =>
    app.request(url, { ...init, headers: { host: init.host ?? PHONE, ...init.headers as Record<string, string> } });
  return { app, deps, recordings, saved, send };
}

const json = (body: unknown, headers: Record<string, string> = { origin: PUBLIC }): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const upload = (bytes: Buffer, name = 'dictation.m4a', headers: Record<string, string> = { origin: PUBLIC }): RequestInit => {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array(bytes)], name));
  form.append('label', 'Pantry');
  return { method: 'POST', headers, body: form };
};
const SUBSCRIPTION = { person: 'Sam', subscription: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } } };

describe('the stock-up list', () => {
  const put = (goals: unknown[]): RequestInit => ({ ...json({ goals }), method: 'PUT' });

  it('takes goals by pantry item, and lists them with where they stand', async () => {
    const { send, deps } = setup();
    const beef = deps.pantry.create({ name: 'ground beef', status: 'have' });
    expect((await send('/api/household/stock-up', put([{ pantryItemId: beef.id, amount: 10, unit: 'lbs', storage: 'frozen' }]))).status).toBe(200);
    const [goal] = await (await send('/api/household/stock-up')).json() as { pantryItemId: number; goal: { unit: string }; standing: { goal: string } }[];
    expect(goal).toMatchObject({ pantryItemId: beef.id, goal: { unit: 'lb' }, standing: { goal: 'Goal 10 lb' } });
  });

  it('will not take a typed name, and makes no item from one', async () => {
    const { send, deps } = setup();
    const before = deps.pantry.list().length;
    expect((await send('/api/household/stock-up', put([{ name: 'typed beef', amount: 10, unit: 'lb', storage: 'frozen' }]))).status).toBe(400);
    expect(deps.pantry.list()).toHaveLength(before);
  });

  it('says so when the item is gone', async () => {
    const { send } = setup();
    const answer = await send('/api/household/stock-up', put([{ pantryItemId: 9999, amount: 10, unit: 'lb', storage: 'frozen' }]));
    expect(answer.status).toBe(404);
    expect(((await answer.json()) as { error: string }).error).toContain('Pantry');
  });
});

describe('the night-before reminder time', () => {
  const put = (time: unknown): RequestInit => ({ ...json({ time }), method: 'PUT' });
  const saved = async (send: ReturnType<typeof setup>['send']) => ((await (await send('/api/household/profile')).json()) as { schedule: { nightBeforeTime: unknown } }).schedule.nightBeforeTime;

  it('starts at 5:00 PM, and changes', async () => {
    const { send } = setup();
    expect(await saved(send)).toEqual({ hour: 17, minute: 0 });
    expect((await send('/api/household/night-before-time', put('16:30'))).status).toBe(200);
    expect(await saved(send)).toEqual({ hour: 16, minute: 30 });
  });

  it('refuses what isn’t a time, keeping what was set', async () => {
    const { send } = setup();
    expect((await send('/api/household/night-before-time', put('5pm'))).status).toBe(400);
    expect((await send('/api/household/night-before-time', put(1700))).status).toBe(400);
    expect(await saved(send)).toEqual({ hour: 17, minute: 0 });
  });
});

describe('the installed app keeps working', () => {
  it('reads with no Origin through the tailnet name', async () => {
    const { send } = setup();
    expect((await send('/api/status')).status).toBe(200);
    expect(await (await send('/week')).text()).toContain('shell');
    expect((await send('/sw.js')).status).toBe(200);
    expect((await send('/manifest.webmanifest')).status).toBe(200);
  });

  it('writes JSON from its own origin, including a push subscription', async () => {
    const { send, saved } = setup();
    expect((await send('/api/push/subscribe', json(SUBSCRIPTION))).status).toBe(200);
    expect(saved).toHaveLength(1);
  });

  it.each([[M4A_BYTES, 'audio.m4a'], [WEBM_BYTES, 'audio.webm'], [OGG_BYTES, 'audio.ogg']])('uploads recordings as multipart', async (bytes, file) => {
    const { send, recordings } = setup();
    const response = await send('/api/recordings', upload(bytes));
    expect(response.status).toBe(200);
    expect(recordings.records[0]).toMatchObject({ file, label: 'Pantry' });
  });

  it('sends a test notification and says how many phones got it', async () => {
    const { send, deps } = setup();
    expect(await (await send('/api/push/test', { method: 'POST', headers: { origin: PUBLIC } })).json()).toEqual({ sent: 1 });
    expect(deps.calls.sends).toBe(1);
  });

  it('downloads a kept recording under a name that says nothing about where it lives', async () => {
    const { send } = setup();
    const { id } = await (await send('/api/recordings', upload(WEBM_BYTES))).json() as { id: string };
    const response = await send(`/api/recordings/${id}/audio`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/webm');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="cuisine-dictation.webm"');
    expect(Buffer.from(await response.arrayBuffer()).equals(WEBM_BYTES)).toBe(true);
    expect((await send('/api/recordings/gone/audio')).status).toBe(404);
  });

  it('serves a stored photo, and a 404 for one that isn’t there', async () => {
    const { send, deps } = setup();
    deps.photos = { read: (file: string) => (file === 'soup-1.webp' ? Buffer.from('photo') : null) } as unknown as typeof deps.photos;
    const response = await send('/media/soup-1.webp');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(await response.text()).toBe('photo');
    expect((await send('/media/gone.webp')).status).toBe(404);
  });

  it('still answers on loopback for local tools', async () => {
    const { send } = setup();
    expect((await send('/api/status', { host: '127.0.0.1:2847' })).status).toBe(200);
  });
});

describe('request trust', () => {
  it('refuses a rebinding Host on every path', async () => {
    const { send } = setup();
    for (const url of ['/api/status', '/', '/media/x.webp', '/sw.js']) {
      expect((await send(url, { host: 'evil.example:2847' })).status).toBe(403);
    }
  });

  it('refuses writes from another site whatever their type', async () => {
    const { send, recordings } = setup();
    const evil = { origin: 'https://evil.example' };
    expect((await send('/api/push/subscribe', json(SUBSCRIPTION, evil))).status).toBe(403);
    expect((await send('/api/recordings', upload(WEBM_BYTES, 'x.webm', evil))).status).toBe(403);
    expect((await send('/api/plan/fill', { method: 'POST', headers: evil })).status).toBe(403);
    expect(recordings.records).toHaveLength(0);
  });

  it('logs a refused host once', async () => {
    const { send, deps } = setup();
    await send('/', { host: 'evil.example' });
    await send('/', { host: 'evil.example' });
    expect(deps.logged.filter(line => line.includes('evil.example'))).toHaveLength(1);
  });
});

describe('body types', () => {
  it('require application/json for JSON, even with a good Origin', async () => {
    const { send, saved } = setup();
    for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
      const response = await send('/api/push/subscribe', { method: 'POST', headers: { origin: PUBLIC, 'content-type': type }, body: JSON.stringify(SUBSCRIPTION) });
      expect(response.status).toBe(415);
    }
    expect(saved).toHaveLength(0);
  });

  it('accept a charset on JSON', () => {
    expect(isJsonRequest('application/json; charset=utf-8')).toBe(true);
    expect(isJsonRequest('APPLICATION/JSON')).toBe(true);
    expect(isJsonRequest('application/jsonp')).toBe(false);
    expect(isJsonRequest(undefined)).toBe(false);
  });

  it('require multipart for uploads', async () => {
    const { send } = setup();
    const response = await send('/api/recordings', { method: 'POST', headers: { origin: PUBLIC, 'content-type': 'text/plain' }, body: 'hello' });
    expect(response.status).toBe(415);
  });

  it('limit JSON far below uploads, with a message the app can show', async () => {
    const { send } = setup();
    const response = await send('/api/push/subscribe', json({ person: 'x'.repeat(3 * 1024 * 1024) }));
    expect(response.status).toBe(413);
    expect((await response.json() as { error: string }).error).toBeTruthy();
  });

  it('reject a non-audio recording with a readable reason', async () => {
    const { send, recordings } = setup();
    const response = await send('/api/recordings', upload(Buffer.from('#EXTM3U\nhttp://169.254.169.254/latest\n'), 'evil.webm'));
    expect(response.status).toBe(415);
    expect((await response.json() as { error: string }).error).toContain('WebM');
    expect(recordings.records).toHaveLength(0);
  });

  it('take one recording at a time', async () => {
    const { send, recordings } = setup();
    const form = new FormData();
    for (const name of ['a.webm', 'b.webm']) form.append('audio', new File([new Uint8Array(WEBM_BYTES)], name));
    expect((await send('/api/recordings', { method: 'POST', headers: { origin: PUBLIC }, body: form })).status).toBe(413);
    expect(recordings.records).toHaveLength(0);
  });

  it('refuse a push endpoint that isn’t a push service', async () => {
    const { send, saved } = setup();
    for (const endpoint of ['http://169.254.169.254/latest', 'https://evil.example/push', 'http://web.push.apple.com/abc']) {
      const response = await send('/api/push/subscribe', json({ ...SUBSCRIPTION, subscription: { ...SUBSCRIPTION.subscription, endpoint } }));
      expect(response.status).toBe(400);
    }
    expect(saved).toHaveLength(0);
  });
});

describe('the access token', () => {
  it('leaves a tailnet setup alone when it isn’t set', async () => {
    const { send } = setup(null);
    expect((await send('/api/status')).status).toBe(200);
  });

  it('closes the API, the photos and the app when it is', async () => {
    const { send } = setup(TOKEN);
    expect((await send('/api/status')).status).toBe(401);
    expect((await send('/media/x.webp')).status).toBe(401);
    const page = await send('/week');
    expect(page.status).toBe(401);
    expect(await page.text()).toContain('Access token');
  });

  it('leaves open what a phone needs to install the app', async () => {
    const { send } = setup(TOKEN);
    expect((await send('/manifest.webmanifest')).status).toBe(200);
    expect((await send('/sw.js')).status).toBe(200);
    expect((await send('/access')).status).toBe(200);
  });

  it('takes a bearer token', async () => {
    const { send } = setup(TOKEN);
    expect((await send('/api/status', { headers: { authorization: `Bearer ${TOKEN}` } })).status).toBe(200);
    expect((await send('/api/status', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
  });

  it('gives a browser a cookie for the right token, holding a digest, and not for a wrong one', async () => {
    const { send } = setup(TOKEN);
    const login = (token: string) => send('/access', { method: 'POST', headers: { origin: PUBLIC, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString() });
    expect((await login('nope')).status).toBe(401);
    const good = await login(TOKEN);
    expect(good.status).toBe(303);
    const cookie = good.headers.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain(TOKEN);
    expect((await send('/api/status', { headers: { cookie: cookie.split(';')[0] } })).status).toBe(200);
    expect((await send('/api/status', { headers: { cookie: 'cuisine_access=forged' } })).status).toBe(401);
  });

  it('still refuses a cross-site login attempt', async () => {
    const { send } = setup(TOKEN);
    const response = await send('/access', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' }, body: `token=${TOKEN}` });
    expect(response.status).toBe(403);
  });
});

describe('response headers', () => {
  it('put a Content-Security-Policy on the page, the API and errors alike', async () => {
    const { send } = setup();
    for (const response of [await send('/week'), await send('/api/status'), await send('/api/nope'), await send('/', { host: 'evil.example' })]) {
      const csp = response.headers.get('content-security-policy')!;
      expect(csp).toContain("img-src 'self' https://images.unsplash.com blob:");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain('unsafe');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      // no-referrer would make the access form's Origin "null" and lock people out.
      expect(response.headers.get('referrer-policy')).toBe('same-origin');
    }
  });

  it('mark the API and its errors no-cache, pages no-store, and assets immutable', async () => {
    const { send } = setup();
    expect((await send('/api/status')).headers.get('cache-control')).toBe('no-cache');
    expect((await send('/week')).headers.get('cache-control')).toBe('no-store');
    expect((await send('/api/nope')).headers.get('cache-control')).toBe('no-cache');
    expect((await send('/assets/app-abc.js')).headers.get('cache-control')).toContain('immutable');
  });
});

describe('errors and unknown routes', () => {
  it('answers a missing file with 404, not the app shell, while routes still get the shell', async () => {
    const { send } = setup();
    for (const path of ['/apple-touch-icon-precomposed.png', '/favicon.ico', '/assets/gone.js']) {
      expect((await send(path)).status).toBe(404);
    }
    expect(await (await send('/recipes/soup')).text()).toContain('shell');
  });

  it('answers an unknown API path with JSON 404, not the app shell', async () => {
    const { send } = setup();
    for (const url of ['/api', '/api/nope', '/api/nope/deeper']) {
      const response = await send(url);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
    }
    expect((await send('/api/nope', { method: 'POST', headers: { origin: PUBLIC } })).status).toBe(404);
  });

  it('hides internal failures and logs them', async () => {
    const { send, deps } = setup();
    deps.ai.available = () => { throw new Error('open /Users/someone/secret/cuisine.db failed'); };
    const response = await send('/api/status');
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toContain(GENERIC_ERROR);
    expect(text).not.toContain('/Users');
    expect(deps.logged.join('\n')).toContain('/Users/someone/secret');
  });

  it('passes a user-facing error through with its status', async () => {
    const { send, deps } = setup();
    deps.ai.available = () => { throw new UserError('Pick a day of the week.', 422); };
    const response = await send('/api/status');
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Pick a day of the week.' });
  });

  it('turns a user mistake in a use case into a 4xx with its friendly words', async () => {
    const { send } = setup();
    const response = await send('/api/recipes/no-such-thing', { method: 'DELETE', headers: { origin: PUBLIC } });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'No such recipe.' });
  });

  it('answers the same for a recipe that isn’t there, whichever route asks', async () => {
    const { send } = setup();
    const seasons = await send('/api/recipes/no-such-thing/seasons', { ...json({ seasons: ['fall'] }), method: 'PUT' });
    const image = await send('/api/recipes/no-such-thing/image/refresh', { method: 'POST', headers: { origin: PUBLIC } });
    for (const response of [seasons, image]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'No such recipe.' });
    }
  });

  it('refuses a date that doesn’t exist', async () => {
    const { send } = setup();
    expect((await send('/api/plan?from=2026-99-01&to=2026-11-08')).status).toBe(400);
    expect((await send('/api/plan?from=2026-02-30&to=2026-11-08')).status).toBe(400);
    expect((await send('/api/plan?from=2026-11-01&to=2026-11-08')).status).toBe(200);
  });
});
