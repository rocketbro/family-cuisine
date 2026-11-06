// The HTTP surface: JSON under /api, the family's photos under /media, and the built
// web app for everything else.
import { cachePolicyFor } from './cache-policy.ts';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { appStatus } from '../application/app-status.ts';
import type { Deps } from '../application/deps.ts';
import { accessGate, accessRoutes } from './access-token.ts';
import { serveClient } from './client-files.ts';
import { errorResponse } from './error-response.ts';
import { requestGuard } from './request-guard.ts';
import type { TrustPolicy } from './request-trust.ts';
import { avoidedMealRoutes } from './routes/avoided-meals.ts';
import { householdRoutes } from './routes/household.ts';
import { checkinRoutes } from './routes/checkin.ts';
import { listenRoutes } from './routes/listen.ts';
import { pantryRoutes } from './routes/pantry.ts';
import { planImportRoutes } from './routes/plan-import.ts';
import { planRoutes } from './routes/plan.ts';
import { pushRoutes } from './routes/push.ts';
import { recipeProblemRoutes } from './routes/recipe-problems.ts';
import { recipeRoutes } from './routes/recipes.ts';
import { receiptRoutes } from './routes/receipts.ts';
import { recordingRoutes } from './routes/recordings.ts';
import { shoppingRoutes } from './routes/shopping.ts';
import { securityHeaders } from './security-headers.ts';
import { isMultipartRequest } from './validate.ts';

const MB = 1024 * 1024;
const tooBig = (message: string) => (c: Context) => c.json({ error: message }, 413);
const uploadLimit = bodyLimit({ maxSize: 60 * MB, onError: tooBig('That file is too big to send (60 MB at most).') });
const jsonLimit = bodyLimit({ maxSize: 2 * MB, onError: tooBig('That’s too much to send at once.') });

export type AppOptions = { clientDir: string; trust: TrustPolicy; accessToken: string | null };

export function createApp(deps: Deps, opts: AppOptions) {
  const api = new Hono()
    .use((c, next) => (isMultipartRequest(c.req.header('content-type')) ? uploadLimit(c, next) : jsonLimit(c, next)))
    .get('/status', c => c.json(appStatus(deps)))
    .route('/plan', planRoutes(deps))
    .route('/plan-import', planImportRoutes(deps))
    .route('/recipes', recipeRoutes(deps))
    .route('/recipe-problems', recipeProblemRoutes(deps))
    .route('/avoided-meals', avoidedMealRoutes(deps))
    .route('/pantry', pantryRoutes(deps))
    .route('/listen', listenRoutes(deps))
    .route('/recordings', recordingRoutes(deps))
    .route('/shopping', shoppingRoutes(deps))
    .route('/receipts', receiptRoutes(deps))
    .route('/checkin', checkinRoutes(deps))
    .route('/push', pushRoutes(deps))
    .route('/household', householdRoutes(deps));

  const app = new Hono();
  // Middleware only wraps what's registered after it, so these all come before any route.
  app.use(securityHeaders());
  app.use(requestGuard(opts.trust, deps.log));
  app.use(async (c, next) => {
    await next();
    const policy = cachePolicyFor(c.req.path);
    if (policy) c.header('Cache-Control', policy);
  });
  if (opts.accessToken) {
    app.route('/', accessRoutes(opts.accessToken));
    app.use(accessGate(opts.accessToken));
  }

  app.route('/api', api);
  app.all('/api/*', c => c.json({ error: 'There’s nothing here.' }, 404));

  app.get('/media/:file', c => {
    const photo = deps.photos.read(c.req.param('file'));
    if (!photo) return c.notFound();
    return c.body(new Uint8Array(photo), 200, { 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=31536000, immutable' });
  });
  app.all('/media/*', c => c.notFound());

  serveClient(app, opts.clientDir);

  app.onError((error, c) => errorResponse(error, c, deps.log));
  return app;
}
