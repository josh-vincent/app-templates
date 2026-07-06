#!/usr/bin/env node
// Query the screen catalog from the command line.
//
// Usage:
//   node scripts/catalog/search.mjs [text...] [--category auth] [--template drivo]
//     [--kind tab|screen|entry] [--component Card] [--package react-native-maps]
//     [--backend convex] [--styling nativewind] [--json] [--limit 25]
//
// Examples:
//   node scripts/catalog/search.mjs checkout payment
//   node scripts/catalog/search.mjs --category auth --styling nativewind
//   node scripts/catalog/search.mjs --component DriveMap --json

import path from 'node:path';
import { readJson, exists, fail, parseArgs, CATALOG_DIR } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['json']);
const indexFile = path.join(CATALOG_DIR, 'index.json');
if (!exists(indexFile)) fail('catalog/index.json missing — run: node scripts/catalog/build-index.mjs');
const index = readJson(indexFile);

const text = args._.join(' ').toLowerCase().trim();
const limit = args.limit ? parseInt(args.limit, 10) : 50;
const templateByName = Object.fromEntries(index.templates.map((t) => [t.name, t]));

function scoreScreen(s) {
  if (!text) return 1;
  const hay = [s.id, s.category, s.path, ...(s.tags || []), ...(s.components || [])].join(' ').toLowerCase();
  let score = 0;
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    if (hay.includes(word)) score += 1;
  }
  return score;
}

let results = index.screens
  .filter((s) => {
    const t = templateByName[s.template];
    if (args.category && s.category !== args.category) return false;
    if (args.template && s.template !== args.template) return false;
    if (args.kind && s.kind !== args.kind) return false;
    if (args.component && !(s.components || []).includes(args.component)) return false;
    if (args.package && !(s.packages || []).includes(args.package)) return false;
    if (args.backend && t?.stack?.backend !== args.backend) return false;
    if (args.styling && t?.stack?.styling !== args.styling) return false;
    return true;
  })
  .map((s) => ({ ...s, _score: scoreScreen(s) }))
  .filter((s) => s._score > 0)
  .sort((a, b) => b._score - a._score || a.template.localeCompare(b.template));

const total = results.length;
results = results.slice(0, limit);

if (args.json) {
  console.log(JSON.stringify(results.map(({ _score, ...s }) => s), null, 2));
} else {
  if (!results.length) {
    console.log('no matches');
    process.exit(0);
  }
  const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
  console.log(pad('TEMPLATE', 22) + pad('CATEGORY', 15) + pad('KIND', 8) + 'PATH');
  for (const s of results) {
    console.log(pad(s.template, 22) + pad(s.category, 15) + pad(s.kind, 8) + s.path);
  }
  console.log(`\n${results.length}${total > results.length ? ` of ${total}` : ''} screens · pull one with: node scripts/catalog/pull.mjs --template <name> --screen <path> --to <target>`);
}
