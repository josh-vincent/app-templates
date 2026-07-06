#!/usr/bin/env node
// Audit an app checkout against a fate — the gate between "it runs" and
// "it's actually MVP / beta / store-ready".
//
// Usage:
//   node scripts/catalog/check.mjs <app-root> --fate store-ready
//     [--capabilities local-first,no-auth] [--json]
//
// If the target contains a remix plan reference (REMIX.md written by
// remix.mjs apply) or a plan file is given via --plan, its fate/capabilities
// are used as defaults.
//
// Exit code: 0 when nothing detectable fails, 1 otherwise (manual items never
// fail the gate — they're printed as ☐ TODO).

import path from 'node:path';
import { readJson, exists, fail, parseArgs } from './lib.mjs';
import { scanTemplate } from './scan.mjs';
import { loadFates, auditFate } from './fates.mjs';

const args = parseArgs(process.argv.slice(2), ['json']);
const root = args._[0] && path.resolve(args._[0]);
if (!root || !exists(root)) fail('usage: check.mjs <app-root> --fate <spike|mvp|beta|store-ready> [--capabilities a,b] [--plan plan.json] [--json]');

let fateName = args.fate;
let declared = args.capabilities ? args.capabilities.split(',').map((s) => s.trim()) : [];
if (args.plan) {
  const plan = readJson(path.resolve(args.plan));
  fateName = fateName || plan.fate;
  declared = declared.length ? declared : plan.capabilities || [];
}
if (!fateName) fail('--fate is required (spike | mvp | beta | store-ready)');

const fatesData = loadFates();
const manifest = scanTemplate(root, { name: path.basename(root) });
const results = auditFate(fatesData, fateName, root, manifest, declared);

if (args.json) {
  console.log(JSON.stringify({ fate: fateName, root, results }, null, 2));
} else {
  const icon = { pass: '✅', fail: '❌', manual: '☐ ', skipped: '⏭️ ' };
  console.log(`Fate audit: ${fatesData.fates[fateName].title}`);
  console.log(`Target: ${root} (${manifest.counts.screens} screens)\n`);
  for (const group of ['screen category', 'capability', 'checklist']) {
    const rows = results.filter((r) => r.via === group || (group === 'checklist' && !['screen category', 'capability'].includes(r.via)));
    if (!rows.length) continue;
    console.log(group.toUpperCase());
    for (const r of rows) console.log(`  ${icon[r.status]} ${r.text}${r.status === 'skipped' ? ` (${r.via})` : ''}`);
    console.log('');
  }
  const fails = results.filter((r) => r.status === 'fail');
  const manual = results.filter((r) => r.status === 'manual');
  console.log(`${results.filter((r) => r.status === 'pass').length} pass · ${fails.length} fail · ${manual.length} manual TODO`);
  if (fails.length) {
    console.log('\nClose the gaps with: node scripts/catalog/search.mjs --category <missing> · remix.mjs apply · or the capability setup steps in catalog/FATES.md');
    process.exit(1);
  }
}
