// The real network for link imports, on node:http rather than fetch because its `lookup` hook
// checks the addresses actually connected to: with no proxy, a DNS answer that changes between the
// check and the connection (rebinding) is refused too. Behind a proxy (NODE_USE_ENV_PROXY) the
// proxy resolves the name itself, so only the check before connecting applies.
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { isPublicAddress } from './public-address.ts';
import type { HttpReply, WebTransport } from './public-fetch.ts';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh) Cuisine recipe importer',
  Accept: 'text/html',
  'Accept-Encoding': 'gzip, deflate, br',
};

export function usesEnvProxy(env: NodeJS.ProcessEnv = process.env): boolean {
  const enabled = env.NODE_USE_ENV_PROXY === '1' || (env.NODE_OPTIONS ?? '').includes('--use-env-proxy') || process.execArgv.includes('--use-env-proxy');
  return enabled && Boolean(env.HTTP_PROXY || env.http_proxy || env.HTTPS_PROXY || env.https_proxy);
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void;

export const publicOnlyLookup = ((hostname: string, options: dns.LookupOptions, callback: LookupCallback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || !addresses.every(a => isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`${hostname} resolved to a private address`), { code: 'EPRIVATEADDRESS' }));
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}) as unknown as LookupFunction;

function decoded(source: http.IncomingMessage): Readable {
  const encoding = (source.headers['content-encoding'] ?? '').toLowerCase();
  const decoder = encoding === 'gzip' ? zlib.createGunzip() : encoding === 'br' ? zlib.createBrotliDecompress() : encoding === 'deflate' ? zlib.createInflate() : null;
  if (!decoder) return source;
  source.on('error', error => decoder.destroy(error));
  return source.pipe(decoder);
}

function readUpTo(source: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = decoded(source);
    const chunks: Buffer[] = [];
    let size = 0;
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= maxBytes) {
        resolve(Buffer.concat(chunks).subarray(0, maxBytes));
        source.destroy();
        stream.destroy();
      }
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function nodeTransport(): WebTransport {
  const proxied = usesEnvProxy();
  return {
    proxied,
    async resolve(hostname) {
      return (await dns.promises.lookup(hostname, { all: true })).map(entry => entry.address);
    },
    open(url, signal) {
      return new Promise<HttpReply>((resolve, reject) => {
        const request = (url.protocol === 'https:' ? https : http).request(url, {
          headers: HEADERS,
          signal,
          ...(proxied ? {} : { lookup: publicOnlyLookup }),
        }, response => resolve({
          status: response.statusCode ?? 0,
          header: name => {
            const value = response.headers[name.toLowerCase()];
            return Array.isArray(value) ? value[0] : value ?? null;
          },
          read: maxBytes => readUpTo(response, maxBytes),
          discard: () => void response.destroy(),
        }));
        request.on('error', reject);
        request.end();
      });
    },
  };
}
