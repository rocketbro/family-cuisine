// Entry point: seed on first run, make sure today is planned, serve, and tick the scheduler.
import { mealsOnly } from '../domain/plan-slot.ts';
import { serve } from '@hono/node-server';
import { toISODate } from '../domain/dates.ts';
import { planHorizonEnd } from '../domain/shop-schedule.ts';
import { shopSchedule } from './application/shop-schedule.ts';
import { runDueJobs } from './application/jobs.ts';
import { planAhead } from './application/planning.ts';
import { findRecipeImage } from './application/recipes.ts';
import { learnWalmartPacks } from './application/walmart-packs.ts';
import { allowedHostnames, startupProblem } from './config-rules.ts';
import { config } from './config.ts';
import { buildDeps } from './container.ts';
import { createApp } from './http/app.ts';
import { seedFirstRun } from './infrastructure/seed.ts';

const log = (message: string) => console.log(`[${new Date().toLocaleString()}] ${message}`);

const refused = startupProblem(config);
if (refused) {
  console.error(`Cuisine won't start: ${refused}`);
  process.exit(1);
}

const deps = buildDeps(config, log);
seedFirstRun({ seedDir: config.seedDir, recipesDir: config.recipesDir, pantry: deps.pantry, recipes: deps.recipes, plan: deps.plan, household: deps.household, log });

const hostnames = allowedHostnames({ publicUrl: config.publicUrl, allowedHosts: config.allowedHosts, bindHost: config.host });
const app = createApp(deps, {
  clientDir: config.clientDir,
  trust: { hostnames: new Set(hostnames), publicOrigin: new URL(config.publicUrl).origin },
  accessToken: config.accessToken,
});
log(`answering to ${hostnames.join(', ')}; access token ${config.accessToken ? 'on' : 'off'}`);

const server = serve({ fetch: app.fetch, port: config.port, hostname: config.host }, info =>
  log(`Cuisine on http://${info.address}:${info.port} (model ${deps.ai.available() ? config.model : 'off'}, photos ${deps.images.available() ? 'Unsplash' : 'off'}, push ${deps.notifier.enabled() ? 'on' : 'off'}, Aldi lookup ${deps.storePrices ? 'on' : 'off'}, Walmart lookup ${deps.walmartProducts ? 'on' : 'off'})`),
);

// Planning can write new recipes, which takes a while, so it never holds up the app coming back.
async function catchUp(): Promise<void> {
  const today = toISODate(new Date());
  // An extra on an otherwise empty day still leaves its meals to plan.
  const unplanned = !mealsOnly(deps.plan.range(today, today)).length;
  const { added } = await planAhead(deps, today, unplanned ? planHorizonEnd(today, shopSchedule(deps)) : null);
  if (unplanned) log(`first plan: ${added} meals`);
  for (const recipe of deps.recipes.list()) await findRecipeImage(deps, recipe);
  await learnWalmartPacks(deps);
}
void catchUp().catch(error => log(`catching up failed: ${(error as Error).message}`));

let running = false;
const tick = async () => {
  if (running) return;
  running = true;
  try {
    await runDueJobs(deps, deps.settings.schedule, new Date());
  } catch (error) {
    log(`scheduled job failed: ${(error as Error).message}`);
  } finally {
    running = false;
  }
};
setInterval(tick, 60_000);
void tick();
// A first walk through the whole kitchen can be a long recording; give it time to transcribe and read.
if ('requestTimeout' in server) server.requestTimeout = 10 * 60_000;
