// Runs the tidy-up pass against a COPY of your data and prints what it found, what the code would fix and what Claude
// would ask, without applying or saving anything. It refuses to run on the live folder. With a key it calls Anthropic;
// without one only the code layer is shown. It never sends a notification.
//
//   D="<data dir>"; X=$(mktemp -d); mkdir -p $X/data; sqlite3 "$D/cuisine.db" ".backup $X/data/cuisine.db"; cp -R "$D/recipes" $X/data/
//   CUISINE_DATA_DIR=$X/data node --env-file-if-exists=.env scripts/tidy-up.ts
import os from 'node:os';
import path from 'node:path';
import { toISODate } from '../src/domain/dates.ts';
import { defaultDataDir, pathSetting } from '../src/server/config-values.ts';

function stop(message: string): never {
  console.error(message);
  process.exit(1);
}

const asked = process.env.CUISINE_DATA_DIR;
if (!asked) stop('Set CUISINE_DATA_DIR to a copy of your data. This never runs on the live folder.');
const dir = path.resolve(pathSetting(asked, os.homedir(), process.cwd()));
if (dir === path.resolve(defaultDataDir(process.platform, os.homedir(), process.env.XDG_DATA_HOME))) stop('That’s the live data folder. Point CUISINE_DATA_DIR at a copy.');

const { config } = await import('../src/server/config.ts');
const { buildDeps } = await import('../src/server/container.ts');
const { lookAtTidyUp } = await import('../src/server/application/tidy-up.ts');

const deps = buildDeps(config, () => undefined);
const { fixes, candidates, questions } = await lookAtTidyUp(deps, toISODate(new Date())).catch((error: Error) => stop(`Stopped: ${error.message}`));

console.log(`Data in ${dir}. ${deps.ai.available() ? 'Asked Claude.' : 'No key, so only the code layer.'}\n`);
console.log(`The code would fix ${fixes.length} thing(s) by itself:`);
for (const fix of fixes) console.log(`  [${fix.check}] ${fix.line}`);

console.log(`\n${candidates.length} candidate(s) for judgment:`);
for (const c of candidates) console.log(`  [${c.kind}] ${c.evidence[0]}`);

console.log(`\nClaude would ask ${questions.length} question(s):`);
for (const q of questions) {
  console.log(`  ${q.question}`);
  for (const a of q.answers) console.log(`    - ${a.label}: ${a.action ? JSON.stringify(a.action) : 'leave it'}`);
}
console.log('\nNothing was applied or saved.');
process.exit(0);
