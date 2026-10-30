#!/usr/bin/env node
// node scripts/recommend.mjs <preview-brief.json> [--json]
import fs from 'node:fs';
import { validateBrief, recommend } from './concepts.mjs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/recommend.mjs <preview-brief.json> [--json]'); process.exit(1); }

let brief;
try { brief = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`ERROR cannot read ${file}: ${e.message}`); process.exit(1); }

const errs = validateBrief(brief);
if (errs.length) { for (const e of errs) console.error(`ERROR ${e}`); process.exit(1); }

const r = recommend(brief);
if (json) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

for (const p of r.picks) {
  console.log(`\n${p.role.toUpperCase()}: ${p.id} (${p.name}), hook ${p.hook}, score ${p.score}`);
  for (const bt of p.beats) console.log(`  ${bt.kind.padEnd(5)} ${String(bt.sec).padStart(4)}s  ${bt.moment ?? '-'}`);
  for (const k of p.risks) console.log(`  RISK ${k}`);
  for (const x of p.reasons) console.log(`  [${x.source}] ${x.text} (${x.ref})`);
}
if (r.excluded.length) { console.log('\nExcluded:'); for (const e of r.excluded) console.log(`  ${e.id}: ${e.reason}`); }
for (const n of r.notes) console.log(`NOTE ${n}`);
