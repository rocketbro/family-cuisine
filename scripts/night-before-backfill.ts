// Runs the one-time pass over existing recipes against a COPY of your data, and prints exactly what it
// would add to each file, so you can read it before the real service does it on its own. It refuses to
// run on the live folder. It calls Anthropic, so it needs a key; it never sends a notification.
//
//   mkdir /tmp/cuisine-copy && cp -R "<data dir>/recipes" /tmp/cuisine-copy/recipes
//   CUISINE_DATA_DIR=/tmp/cuisine-copy ANTHROPIC_API_KEY=... node scripts/night-before-backfill.ts
//   diff -r "<data dir>/recipes" /tmp/cuisine-copy/recipes
import os from 'node:os';
import path from 'node:path';
import { defaultDataDir, pathSetting } from '../src/server/config-values.ts';

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

const asked = process.env.CUISINE_DATA_DIR;
if (!asked) stop('Set CUISINE_DATA_DIR to a copy of your data. This never runs on the live folder.');
const dir = path.resolve(pathSetting(asked, os.homedir(), process.cwd()));
if (dir === path.resolve(defaultDataDir(process.platform, os.homedir(), process.env.XDG_DATA_HOME))) stop('That’s the live data folder. Point CUISINE_DATA_DIR at a copy.');
if (!process.env.ANTHROPIC_API_KEY) stop('Set ANTHROPIC_API_KEY: this asks the model about each recipe.');

const { config } = await import('../src/server/config.ts');
const { buildDeps } = await import('../src/server/container.ts');
const { backfillNightBefore } = await import('../src/server/application/night-before-backfill.ts');

const deps = buildDeps(config, message => console.log(message));
const total = deps.recipes.list().length;
const { asked: gone, added } = await backfillNightBefore(deps).catch((error: Error) => stop(`Stopped partway: ${error.message}. Run it again to go through what's left.`));

console.log(`\nWent through ${gone} of ${total} recipes in ${dir}.`);
if (!added.length) console.log('None would change.');
else {
  console.log(`${added.length} would change, each by one new line in its header:\n`);
  for (const { slug, title, step } of added) console.log(`  ${slug}.md (${title})\n    night_before: ${step}\n`);
}
process.exit(0);
