import { describe, expect, it } from 'vitest';
import { UserError } from '../../application/user-error.ts';
import { jsonLdBlocks, ogSiteName, pageText } from './html-text.ts';
import { publicOnlyLookup, usesEnvProxy } from './node-transport.ts';
import { modelContent, webPageFetcher } from './page-fetcher.ts';
import type { HttpReply, WebTransport } from './public-fetch.ts';

type Page = { status?: number; location?: string; body?: string; type?: string };

/** A pretend internet: which pages exist and what names resolve to. */
function internet(pages: Record<string, Page>, dns: Record<string, string[]>, proxied = false) {
  const opened: string[] = [];
  const asked: number[] = [];
  const transport: WebTransport = {
    proxied,
    resolve: async host => {
      if (!dns[host]) throw new Error('ENOTFOUND');
      return dns[host];
    },
    open: async url => {
      opened.push(url.href);
      const page = pages[url.href];
      if (!page) throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:443 at /some/internal/path'), { code: 'ECONNREFUSED' });
      const reply: HttpReply = {
        status: page.status ?? 200,
        header: name => (name === 'location' ? page.location ?? null : name === 'content-type' ? page.type ?? 'text/html' : null),
        read: async max => {
          asked.push(max);
          return Buffer.from(page.body ?? '').subarray(0, max);
        },
        discard: () => undefined,
      };
      return reply;
    },
  };
  return { transport, opened, asked };
}

const PUBLIC_IP = ['93.184.216.34'];
const expectRefused = async (promise: Promise<unknown>, words: string) => {
  const error = await promise.then(() => null, e => e as UserError);
  expect(error).toBeInstanceOf(UserError);
  expect(error?.message).toContain(words);
};

describe('following links', () => {
  it('says when a site turns us away, in a way the screen can act on', async () => {
    for (const status of [401, 403, 429]) {
      const { transport } = internet({ 'https://food.example/soup': { status } }, { 'food.example': PUBLIC_IP });
      const error = await webPageFetcher(transport).fetch('https://food.example/soup').catch(e => e as UserError);
      expect(error).toMatchObject({ message: 'This site blocked the import.', code: 'site-refused' });
    }
  });

  it('tells a missing page from a broken site', async () => {
    const { transport } = internet({ 'https://food.example/gone': { status: 404 }, 'https://food.example/down': { status: 500 } }, { 'food.example': PUBLIC_IP });
    await expectRefused(webPageFetcher(transport).fetch('https://food.example/gone'), 'isn’t there');
    await expectRefused(webPageFetcher(transport).fetch('https://food.example/down'), 'HTTP 500');
  });

  it('fetches a public page', async () => {
    const { transport } = internet({ 'https://food.example/soup': { body: '<p>Soup</p>' } }, { 'food.example': PUBLIC_IP });
    const page = await webPageFetcher(transport).fetch('https://food.example/soup');
    expect(page).toMatchObject({ url: 'https://food.example/soup', siteName: 'food.example', content: 'Soup' });
  });

  it('refuses a name that resolves privately, before connecting', async () => {
    const { transport, opened } = internet({}, { 'sneaky.example': ['192.168.1.10'] });
    await expectRefused(webPageFetcher(transport).fetch('https://sneaky.example/'), 'private network');
    expect(opened).toEqual([]);
  });

  it('refuses a name with any private answer among public ones', async () => {
    const { transport, opened } = internet({}, { 'mixed.example': ['93.184.216.34', '127.0.0.1'] });
    await expectRefused(webPageFetcher(transport).fetch('https://mixed.example/'), 'private network');
    expect(opened).toEqual([]);
  });

  it('follows a redirect by hand and re-checks where it goes', async () => {
    const { transport, opened } = internet({
      'https://short.example/a': { status: 302, location: 'https://food.example/b' },
      'https://food.example/b': { status: 301, location: '/c' },
      'https://food.example/c': { body: 'Soup' },
    }, { 'short.example': PUBLIC_IP, 'food.example': PUBLIC_IP });
    const page = await webPageFetcher(transport).fetch('https://short.example/a');
    expect(page.url).toBe('https://food.example/c');
    expect(opened).toHaveLength(3);
  });

  it.each(['http://169.254.169.254/latest/meta-data/', 'http://127.0.0.1:2847/api/pantry', 'http://[::ffff:127.0.0.1]/', 'http://100.100.100.100/', 'file:///etc/passwd', 'https://internal.example/'])('stops a redirect to %s', async target => {
    const { transport, opened } = internet({ 'https://evil.example/': { status: 302, location: target } }, { 'evil.example': PUBLIC_IP, 'internal.example': ['10.1.2.3'] });
    await expect(webPageFetcher(transport).fetch('https://evil.example/')).rejects.toBeInstanceOf(UserError);
    expect(opened).toEqual(['https://evil.example/']);
  });

  it('gives up on a redirect loop', async () => {
    const { transport, opened } = internet({ 'https://loop.example/': { status: 302, location: '/' } }, { 'loop.example': PUBLIC_IP });
    await expectRefused(webPageFetcher(transport).fetch('https://loop.example/'), 'too many');
    expect(opened.length).toBeLessThanOrEqual(6);
  });

  it('caps the download', async () => {
    const { transport, asked } = internet({ 'https://big.example/': { body: 'x'.repeat(100) } }, { 'big.example': PUBLIC_IP });
    await webPageFetcher(transport).fetch('https://big.example/');
    expect(asked).toEqual([5 * 1024 * 1024]);
  });

  it('refuses what isn’t a page, and keeps connection details out of its messages', async () => {
    const { transport } = internet({ 'https://food.example/x.pdf': { body: '%PDF', type: 'application/pdf' } }, { 'food.example': PUBLIC_IP });
    await expectRefused(webPageFetcher(transport).fetch('https://food.example/x.pdf'), 'isn’t a web page');
    const down = webPageFetcher(transport).fetch('https://food.example/gone');
    await expectRefused(down, 'Couldn’t reach');
    await expect(down).rejects.not.toThrow(/10\.0\.0\.1|internal/);
  });
});

describe('behind a proxy', () => {
  it('carries on when local DNS can’t resolve, since the proxy does the lookup', async () => {
    const { transport, opened } = internet({ 'https://food.example/': { body: 'Soup' } }, {}, true);
    expect((await webPageFetcher(transport).fetch('https://food.example/')).content).toBe('Soup');
    expect(opened).toHaveLength(1);
  });

  it('still refuses private literals, private names and private answers', async () => {
    const { transport, opened } = internet({}, { 'sneaky.example': ['10.0.0.1'] }, true);
    for (const url of ['http://127.0.0.1/', 'http://localhost/', 'https://nas.local/', 'https://sneaky.example/']) {
      await expectRefused(webPageFetcher(transport).fetch(url), 'private network');
    }
    expect(opened).toEqual([]);
  });

  it('is only assumed when Node is really using one', () => {
    expect(usesEnvProxy({ NODE_USE_ENV_PROXY: '1', HTTPS_PROXY: 'http://proxy:8080' })).toBe(true);
    expect(usesEnvProxy({ NODE_USE_ENV_PROXY: '1' })).toBe(false);
    expect(usesEnvProxy({ HTTPS_PROXY: 'http://proxy:8080' })).toBe(false);
  });
});

describe('the connection-time check', () => {
  const lookup = (host: string, options: object) => new Promise<{ error: NodeJS.ErrnoException | null; address?: unknown }>(resolve => {
    (publicOnlyLookup as unknown as (h: string, o: object, c: (e: NodeJS.ErrnoException | null, a?: unknown) => void) => void)(host, options, (error, address) => resolve({ error, address }));
  });

  it('refuses a name that resolves privately when the socket connects, closing the rebinding gap', async () => {
    expect((await lookup('localhost', {})).error?.code).toBe('EPRIVATEADDRESS');
    expect((await lookup('localhost', { all: true })).error?.code).toBe('EPRIVATEADDRESS');
  });
});

describe('reading a page', () => {
  it('takes text out of markup and leaves hidden parts behind', () => {
    const html = '<HEADER>menu</HEADER><h1>Soup</h1><script>var x = "<p>nope</p>";</script><p>Boil &amp; stir</p><nav>links</nav><li>One</li>';
    expect(pageText(html)).toBe('Soup\n Boil & stir\n One');
  });

  it('finds JSON-LD and the site name', () => {
    const html = '<META content="Serious &amp; Eats" property="og:site_name"><script type="application/ld+json">{"@type":"Recipe","name":"Soup"}</script><script>x</script>';
    expect(jsonLdBlocks(html)).toEqual(['{"@type":"Recipe","name":"Soup"}']);
    expect(ogSiteName(html)).toBe('Serious & Eats');
  });

  it('truncates what reaches the model, with or without structured data', () => {
    expect(modelContent(`<p>${'word '.repeat(100_000)}</p>`).length).toBeLessThanOrEqual(60_000);
    const recipe = JSON.stringify({ '@type': 'Recipe', name: 'x'.repeat(100_000) });
    const both = modelContent(`<script type="application/ld+json">${recipe}</script><p>${'word '.repeat(100_000)}</p>`);
    expect(both.length).toBeLessThan(41_000);
    expect(both).toContain('Structured recipe data');
  });

  it.each([
    ['unclosed scripts', '<script '.repeat(700_000)],
    ['unclosed metas', '<meta '.repeat(800_000)],
    ['a sea of angle brackets', '<'.repeat(5_000_000)],
    ['scripts with no end', '<script type="application/ld+json">'.repeat(140_000)],
    ['nested tags', '<nav>'.repeat(1_000_000)],
  ])('stays quick on hostile markup: %s', (_kind, html) => {
    const started = performance.now();
    modelContent(html);
    ogSiteName(html);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
