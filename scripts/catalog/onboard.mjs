#!/usr/bin/env node
// Onboard a project into the factory — create it and/or register it so its
// screens, components, styles, and patterns feed the catalog and registry as
// you build.
//
//   new — scaffold a project and register it
//     node scripts/catalog/onboard.mjs new pawgo --template propia
//       [--idea "dog walking marketplace"] [--fate mvp] [--plan plan.json] [--dest ../pawgo]
//     --template copies the whole base template; --plan runs a remix apply instead.
//     Default destination is ./<name> (a top-level dir in this monorepo, like the
//     other templates).
//
//   existing — register a project that already exists
//     node scripts/catalog/onboard.mjs existing ../my-app [--name my-app] [--repo owner/repo]
//
// Both finish by rescanning the project into catalog/templates/<name>.json and
// rebuilding the index, docs, and registry — so the new project's screens and
// components are immediately searchable, remixable, and installable.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { walk, readJson, writeJson, exists, fail, parseArgs, resolveTemplateRoot, REPO_ROOT, REGISTRY_PATH } from './lib.mjs';

const SCRIPTS = path.join(REPO_ROOT, 'scripts', 'catalog');

function run(script, argv = []) {
  execFileSync(process.execPath, [path.join(SCRIPTS, script), ...argv], { stdio: 'inherit', cwd: REPO_ROOT });
}

function copyTemplate(srcRoot, destRoot) {
  const files = walk(srcRoot, { exts: null, skip: ['node_modules', '.git', '.expo', 'ios', 'android', 'dist', 'build'] });
  let n = 0;
  for (const rel of files) {
    if (/^(bun\.lock|package-lock\.json|template\.json)$/.test(rel)) continue;
    const src = path.join(srcRoot, rel);
    try {
      if (fs.lstatSync(src).isSymbolicLink()) continue;
      const dest = path.join(destRoot, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      n++;
    } catch (e) {
      console.warn(`  skip ${rel}: ${e.code || e.message}`);
    }
  }
  return n;
}

function register(name, localPath, extra = {}) {
  const registry = readJson(REGISTRY_PATH);
  if (registry.templates[name]) fail(`"${name}" is already registered in catalog/registry.json`);
  registry.templates[name] = { repo: extra.repo || null, localPath, kind: extra.kind || 'project' };
  writeJson(REGISTRY_PATH, registry);
}

function refresh() {
  run('scan.mjs', ['--all']);
  run('build-index.mjs');
  run('registry-build.mjs');
  if (exists(path.join(SCRIPTS, 'gallery.mjs'))) run('gallery.mjs');
}

async function main() {
  const cmd = process.argv[2];
  const args = parseArgs(process.argv.slice(3), []);

  if (cmd === 'new') {
    const name = args._[0];
    if (!name || !/^[a-z0-9-]+$/.test(name)) fail('usage: onboard.mjs new <kebab-name> --template <base> [--plan plan.json] [--idea "..."] [--fate mvp] [--dest path]');
    const destRoot = path.resolve(args.dest || path.join(REPO_ROOT, name));
    if (exists(destRoot) && fs.readdirSync(destRoot).length) fail(`${destRoot} already exists and is not empty`);

    if (args.plan) {
      run('remix.mjs', ['apply', path.resolve(args.plan), '--to', destRoot]);
    } else {
      const base = args.template;
      if (!base) fail('provide --template <base> or --plan <plan.json>');
      const srcRoot = resolveTemplateRoot(base);
      if (!srcRoot) fail(`base template "${base}" not found in catalog/registry.json (or not checked out)`);
      const n = copyTemplate(srcRoot, destRoot);
      console.log(`copied ${n} files from ${base} → ${destRoot}`);
      const pkgFile = path.join(destRoot, 'package.json');
      if (exists(pkgFile)) {
        const pkg = readJson(pkgFile);
        pkg.name = name;
        writeJson(pkgFile, pkg);
      }
      const appJson = path.join(destRoot, 'app.json');
      if (exists(appJson)) {
        const cfg = readJson(appJson);
        if (cfg.expo) {
          cfg.expo.name = name;
          cfg.expo.slug = name;
        }
        writeJson(appJson, cfg);
      }
    }

    // PRODUCT.md stub so the idea/fate travel with the project (and curated
    // description comes from here on rescan)
    const product = path.join(destRoot, 'PRODUCT.md');
    if (!exists(product)) {
      fs.writeFileSync(product, `# ${name}\n\n${args.idea || 'TODO: one-paragraph product pitch.'}\n\n- Fate: ${args.fate || 'mvp'}\n- Base: ${args.template || args.plan || 'remix'}\n- Created via: scripts/catalog/onboard.mjs\n`);
    }

    const rel = path.relative(REPO_ROOT, destRoot);
    register(name, rel.startsWith('.') ? rel : './' + rel);
    refresh();
    console.log(`\nonboarded "${name}" (${destRoot})`);
    console.log(`- catalog/templates/${name}.json generated; screens/components now searchable and installable`);
    if (args.fate) console.log(`- audit anytime: node scripts/catalog/check.mjs ${rel} --fate ${args.fate}`);
    return;
  }

  if (cmd === 'existing') {
    const target = args._[0] && path.resolve(args._[0]);
    if (!target || !exists(target)) fail('usage: onboard.mjs existing <path> [--name x] [--repo owner/repo]');
    const name = args.name || path.basename(target);
    const rel = path.relative(REPO_ROOT, target);
    register(name, rel.startsWith('.') ? rel : './' + rel, { repo: args.repo, kind: rel.startsWith('..') ? 'external' : 'project' });
    refresh();
    console.log(`\nonboarded existing project "${name}" (${target})`);
    return;
  }

  fail('usage: onboard.mjs <new|existing> …  (see header comment)');
}

main();
