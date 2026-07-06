#!/usr/bin/env node
// Query the screen catalog from the command line.
//
// Usage:
//   node scripts/catalog/search.mjs [text...] [--category auth] [--template drivo]
//     [--kind tab|screen|entry] [--component Card] [--package react-native-maps]
//     [--backend convex] [--styling nativewind] [--style glass] [--ids]
//     [--json] [--limit 25]
//
// Free text supports namespaced identifier tokens (see catalog/STYLES.md):
//   style:glass  buttons:pill  layout:drawer+tabs  settings:toggles  sheet:gesture
//
// Examples:
//   node scripts/catalog/search.mjs checkout payment
//   node scripts/catalog/search.mjs settings style:glass
//   node scripts/catalog/search.mjs --style apple-glass --category settings
//   node scripts/catalog/search.mjs --ids buttons    # list identifiers (optionally by namespace)

import path from 'node:path';
import { readJson, exists, fail, parseArgs, CATALOG_DIR } from './lib.mjs';

const args = parseArgs(process.argv.slice(2), ['json', 'ids']);
const indexFile = path.join(CATALOG_DIR, 'index.json');
if (!exists(indexFile)) fail('catalog/index.json missing — run: node scripts/catalog/build-index.mjs');
const index = readJson(indexFile);

// --ids [namespace]: list known identifiers and where they come from
if (args.ids) {
  const ns = typeof args.ids === 'string' ? args.ids : args._[0];
  for (const [token, e] of Object.entries(index.identifiers || {})) {
    if (ns && !token.startsWith(ns + ':') && !token.startsWith(ns)) continue;
    const tpls = Object.entries(e.templates).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}(${c})`).join(' ');
    console.log(token.padEnd(28) + tpls);
  }
  process.exit(0);
}

// Pull identifier tokens (ns:value) out of the free text; also honor --style
const rawWords = args._.join(' ').toLowerCase().trim().split(/\s+/).filter(Boolean);
const idTokens = rawWords.filter((w) => w.includes(':'));
if (args.style) idTokens.push(args.style.includes(':') ? args.style : `style:${args.style}`);
const text = rawWords.filter((w) => !w.includes(':')).join(' ');

// Each identifier restricts to templates that carry it (screen-style:* also
// filters on the screen's own traits) and boosts stronger carriers.
const idTemplateWeights = [];
for (const token of idTokens) {
  const e = index.identifiers?.[token];
  if (!e) fail(`unknown identifier "${token}" — list with: search.mjs --ids ${token.split(':')[0]}`);
  idTemplateWeights.push({ token, templates: e.templates });
}
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
    for (const { token, templates } of idTemplateWeights) {
      if (token.startsWith('screen-style:')) {
        if (!(s.traits || []).includes(token.split(':')[1])) return false;
      } else if (!templates[s.template]) return false;
    }
    return true;
  })
  .map((s) => {
    let boost = 0;
    for (const { templates } of idTemplateWeights) boost += Math.min(templates[s.template] || 0, 5) / 5;
    return { ...s, _score: scoreScreen(s) + boost };
  })
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
