// The built web app. Serving it is what this layer is for, so these files are read here rather
// than through a port: no use case has any business with them.
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

export function serveClient(app: Hono, clientDir: string): void {
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), clientDir) }));
  // Client-side routes (/recipes/soup, /checkin/…) all load the app shell. A file that isn't there
  // doesn't: iOS tries /apple-touch-icon-precomposed.png when making a home screen icon, and a page
  // sent back as if it were that picture leaves it with no icon at all.
  app.get('*', c => {
    if (c.req.path.slice(c.req.path.lastIndexOf('/') + 1).includes('.')) return c.notFound();
    const index = path.join(clientDir, 'index.html');
    return fs.existsSync(index) ? c.html(fs.readFileSync(index, 'utf8')) : c.text('Run `npm run build` first.', 503);
  });
}
