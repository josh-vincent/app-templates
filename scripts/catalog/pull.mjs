#!/usr/bin/env node
// Pull a screen (plus everything it needs) out of a source template and into a
// target app: walks the screen's local import graph (components, contexts,
// hooks, utils, lib, data, assets) and copies each file to the same relative
// path in the target. Reports npm packages the target is missing.
//
// Usage:
//   node scripts/catalog/pull.mjs --template evento --screen app/screens/event-detail.tsx \
//     --to ../my-new-app [--as app/screens/show-detail.tsx] [--dry-run] [--force]
//   node scripts/catalog/pull.mjs --from ../evento --screen screens:event-detail --to ../my-app
//
// --template resolves the source checkout via catalog/registry.json; --from
// takes an explicit path. --screen accepts a path or a catalog screen id.
// Existing files in the target are kept (shared components are not clobbered)
// unless --force is given. --dry-run prints the plan without writing.

import fs from 'node:fs';
import path from 'node:path';
import {
  parseImports, resolveLocalImport, isAssetPath, packageNameOf, readJson,
  exists, fail, parseArgs, resolveTemplateRoot, loadManifests,
} from './lib.mjs';

export function collectDependencyClosure(rootAbs, entryRel) {
  const files = new Set();
  const assets = new Set();
  const packages = new Set();
  const queue = [entryRel];
  while (queue.length) {
    const rel = queue.shift();
    if (files.has(rel)) continue;
    files.add(rel);
    const full = path.join(rootAbs, rel);
    const src = fs.readFileSync(full, 'utf8');
    for (const spec of parseImports(src)) {
      const local = resolveLocalImport(spec, full, rootAbs);
      if (!local) {
        const p = packageNameOf(spec);
        if (!['react', 'react-native'].includes(p)) packages.add(p);
        continue;
      }
      const norm = local.split(path.sep).join('/');
      if (isAssetPath(norm)) assets.add(norm);
      else if (!files.has(norm)) queue.push(norm);
    }
  }
  files.delete(entryRel);
  return { entry: entryRel, files: [...files].sort(), assets: [...assets].sort(), packages: [...packages].sort() };
}

export function resolveScreenArg(sourceRoot, templateName, screenArg) {
  // Direct path?
  if (exists(path.join(sourceRoot, screenArg))) return screenArg;
  // Catalog id lookup
  if (templateName) {
    const m = loadManifests().find((x) => x.name === templateName)?.manifest;
    const hit = m?.screens?.find((s) => s.id === screenArg || s.id.endsWith(':' + screenArg) || path.basename(s.path, '.tsx') === screenArg);
    if (hit && exists(path.join(sourceRoot, hit.path))) return hit.path;
  }
  return null;
}

export function pullScreen({ sourceRoot, targetRoot, screenRel, asRel = null, dryRun = false, force = false, log = console.log }) {
  const closure = collectDependencyClosure(sourceRoot, screenRel);
  const copies = [];
  const plan = [
    { from: closure.entry, to: asRel || closure.entry },
    ...closure.files.map((f) => ({ from: f, to: f })),
    ...closure.assets.map((f) => ({ from: f, to: f })),
  ];

  for (const { from, to } of plan) {
    const src = path.join(sourceRoot, from);
    const dest = path.join(targetRoot, to);
    if (exists(dest) && !force && to !== (asRel || closure.entry)) {
      copies.push({ from, to, action: 'skip (exists)' });
      continue;
    }
    copies.push({ from, to, action: exists(dest) ? 'overwrite' : 'copy' });
    if (!dryRun) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }

  // Package gap report
  let missing = closure.packages;
  const targetPkgFile = path.join(targetRoot, 'package.json');
  if (exists(targetPkgFile)) {
    const tp = readJson(targetPkgFile);
    const have = new Set(Object.keys({ ...(tp.dependencies || {}), ...(tp.devDependencies || {}) }));
    missing = closure.packages.filter((p) => !have.has(p));
  }

  log(`${dryRun ? '[dry-run] ' : ''}pull ${screenRel} → ${targetRoot}`);
  for (const c of copies) log(`  ${c.action.padEnd(15)} ${c.to}${c.from !== c.to ? `  (from ${c.from})` : ''}`);
  if (missing.length) log(`  packages needed in target: ${missing.join(', ')}`);
  return { copies, missingPackages: missing, closure };
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['dry-run', 'force']);
  const targetRoot = args.to && path.resolve(args.to);
  if (!targetRoot) fail('--to <target app root> is required');

  let sourceRoot = args.from ? path.resolve(args.from) : args.template ? resolveTemplateRoot(args.template) : null;
  if (!sourceRoot) fail('provide --template <name> (registry) or --from <path>');
  if (!exists(sourceRoot)) fail(`source not found: ${sourceRoot}`);

  const screenRel = resolveScreenArg(sourceRoot, args.template, args.screen || args._[0] || '');
  if (!screenRel) fail(`screen not found in ${sourceRoot}: ${args.screen || args._[0]}`);

  pullScreen({
    sourceRoot,
    targetRoot,
    screenRel,
    asRel: args.as || null,
    dryRun: !!args['dry-run'],
    force: !!args.force,
  });
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirect) main();
