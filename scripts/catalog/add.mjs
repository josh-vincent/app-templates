#!/usr/bin/env node
// Install registry items into a project — the shadcn-style `add` command.
//
//   node scripts/catalog/add.mjs drivo/button evento/screen-event-detail --to ../my-app
//     [--dry-run] [--force] [--flat]
//
// Resolves each item's registryDependencies transitively, copies every file
// from the source template checkouts into the target (never overwriting
// existing files unless --force — shared deps land once), and reports npm
// packages the target is missing.
//
// List what's installable:
//   node scripts/catalog/add.mjs --list [drivo] [--type registry:ui]

import fs from 'node:fs';
import path from 'node:path';
import { readJson, exists, fail, parseArgs, resolveTemplateRoot, REPO_ROOT } from './lib.mjs';
import { REGISTRY_DIR } from './registry-build.mjs';

function loadItem(id) {
  const f = path.join(REGISTRY_DIR, id + '.json');
  if (!exists(f)) return null;
  return readJson(f);
}

export function resolveClosure(ids) {
  const seen = new Set();
  const items = [];
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const item = loadItem(id);
    if (!item) fail(`unknown registry item "${id}" — list with: add.mjs --list`);
    items.push(item);
    queue.push(...(item.registryDependencies || []));
  }
  return items;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['dry-run', 'force', 'list']);

  if (!exists(path.join(REGISTRY_DIR, 'registry.json'))) {
    fail('registry missing — run: node scripts/catalog/registry-build.mjs');
  }

  if (args.list) {
    const index = readJson(path.join(REGISTRY_DIR, 'registry.json'));
    const tpl = typeof args.list === 'string' ? args.list : args._[0];
    for (const i of index.items) {
      if (tpl && i.template !== tpl) continue;
      if (args.type && i.type !== args.type) continue;
      const extra = i.props
        ? [i.props.variants?.length ? `variants: ${i.props.variants.join('/')}` : '', i.props.states?.length ? `states: ${i.props.states.join('/')}` : '']
            .filter(Boolean)
            .join(' · ')
        : i.category || '';
      console.log(i.name.padEnd(46) + i.type.padEnd(18) + extra);
    }
    return;
  }

  const targetRoot = args.to && path.resolve(args.to);
  if (!targetRoot) fail('--to <target app root> is required');
  const ids = args._;
  if (!ids.length) fail('usage: add.mjs <template/item...> --to <target> [--dry-run] [--force] | add.mjs --list [template]');

  const items = resolveClosure(ids);
  const packages = new Set();
  let copied = 0;
  let skipped = 0;

  console.log(`${args['dry-run'] ? '[dry-run] ' : ''}installing ${ids.length} item(s) → ${items.length} with dependencies`);
  for (const item of items) {
    const srcRoot = resolveTemplateRoot(item.template);
    if (!srcRoot) {
      console.log(`  SKIP ${item.name} — template ${item.template} not checked out`);
      continue;
    }
    (item.dependencies || []).forEach((p) => packages.add(p));
    for (const f of item.files) {
      const src = path.join(srcRoot, f.path);
      const dest = path.join(targetRoot, f.target || f.path);
      if (!exists(src)) continue;
      if (exists(dest) && !args.force) {
        skipped++;
        continue;
      }
      copied++;
      if (!args['dry-run']) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
      console.log(`  + ${f.target || f.path}  (${item.name})`);
    }
  }

  // Package gap
  let missing = [...packages].sort();
  const pkgFile = path.join(targetRoot, 'package.json');
  if (exists(pkgFile)) {
    const p = readJson(pkgFile);
    const have = new Set(Object.keys({ ...(p.dependencies || {}), ...(p.devDependencies || {}) }));
    missing = missing.filter((x) => !have.has(x));
  }
  console.log(`\n${copied} file(s) ${args['dry-run'] ? 'would be ' : ''}copied · ${skipped} already present`);
  if (missing.length) console.log(`packages needed: ${missing.join(' ')}`);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirect) main();
