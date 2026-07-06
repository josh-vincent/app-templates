#!/usr/bin/env node
// Scan an Expo Router template checkout and emit a template.json manifest
// describing its layouts, screens, components, and design system — the raw
// material the mobile app factory catalog is built from.
//
// Usage:
//   node scripts/catalog/scan.mjs <template-root> [--name <id>] [--repo <owner/repo>]
//     [--out <file>] [--print]
//   node scripts/catalog/scan.mjs --all          # rescan every registry entry
//
// Curated fields (title, description, idea, screen category/description/tags
// overrides under `curation`) in an existing manifest are preserved on rescan.

import fs from 'node:fs';
import path from 'node:path';
import {
  walk, parseImports, resolveLocalImport, isAssetPath, packageNameOf, isLocalSpec,
  categorize, tagsFor, readJson, writeJson, exists, fail, parseArgs,
  loadRegistry, TEMPLATES_DIR, REPO_ROOT,
} from './lib.mjs';
import { analyzeStyle, screenTraits } from './style.mjs';

const GENERATOR = 'app-templates/scripts/catalog/scan.mjs';

function detectStack(root, pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const styling = deps.uniwind ? 'uniwind' : deps.nativewind || exists(path.join(root, 'nativewind-env.d.ts')) ? 'nativewind' : 'stylesheet';
  let backend = 'none';
  if (deps.convex || exists(path.join(root, 'convex'))) backend = 'convex';
  else if (deps['@supabase/supabase-js']) backend = 'supabase';
  else if (walk(path.join(root, 'app'), { exts: ['+api.ts'] }).length > 0) backend = 'expo-api-routes';
  return {
    expo: (deps.expo || '').replace(/[^0-9.]/g, '').split('.')[0] || null,
    navigation: deps['expo-router'] ? 'expo-router' : 'unknown',
    styling,
    backend,
    typescript: !!deps.typescript,
    usesSharedLibrary: Object.keys(deps).some((d) => d.startsWith('@jv/')),
    notable: ['react-native-maps', 'react-native-purchases', 'react-native-health', 'ai', 'lottie-react-native', 'expo-notifications', '@tanstack/react-query']
      .filter((d) => deps[d]),
  };
}

function detectLayoutType(src) {
  const types = [];
  if (/Drawer/.test(src)) types.push('drawer');
  if (/Tabs|TabList|TabTrigger|TabSlot/.test(src)) types.push('tabs');
  if (/<Stack/.test(src)) types.push('stack');
  return types.length ? types.join('+') : 'stack';
}

function firstParagraph(file) {
  if (!exists(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const para = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#') || t === '' || t.startsWith('```')) {
      if (para.length) break;
      continue;
    }
    para.push(t);
  }
  const text = para.join(' ').trim();
  return text ? text.slice(0, 300) : null;
}

export function scanTemplate(root, { name, repo } = {}) {
  root = path.resolve(root);
  // Tolerate a missing package.json (e.g. a freshly remixed target being audited)
  const pkg = exists(path.join(root, 'package.json')) ? readJson(path.join(root, 'package.json')) : {};
  name = name || path.basename(root);

  const appDir = path.join(root, 'app');
  const files = walk(appDir, { exts: ['.tsx', '.ts'] }).map((f) => f.split(path.sep).join('/'));

  const layouts = [];
  const screens = [];
  const apiRoutes = [];

  for (const rel of files) {
    const full = path.join(appDir, rel);
    const appRel = 'app/' + rel;
    const base = path.basename(rel).replace(/\.tsx?$/, '');
    const dirs = rel.split('/').slice(0, -1);
    const groups = dirs.filter((d) => d.startsWith('(') && d.endsWith(')'));

    if (rel.endsWith('+api.ts')) {
      apiRoutes.push({ path: appRel, route: '/' + rel.replace(/\+api\.ts$/, '') });
      continue;
    }
    // Support files that live inside app/ but are not routes
    if (dirs[0] === 'contexts' || dirs[0] === 'hooks' || dirs[0] === 'api' || base.startsWith('+')) continue;
    if (base.startsWith('[...')) continue; // catch-all 404
    if (!rel.endsWith('.tsx')) continue;

    const src = fs.readFileSync(full, 'utf8');

    if (base === '_layout') {
      layouts.push({
        path: appRel,
        type: rel === '_layout.tsx' ? 'root' : detectLayoutType(src),
        group: groups.join('/') || null,
      });
      continue;
    }

    // Trace imports for this screen
    const components = new Set();
    const modules = new Set();
    const packages = new Set();
    const assets = new Set();
    for (const spec of parseImports(src)) {
      const local = resolveLocalImport(spec, full, root);
      if (!local) {
        if (isLocalSpec(spec)) continue; // dangling local import — not a package
        const p = packageNameOf(spec);
        if (!['react', 'react-native'].includes(p)) packages.add(p);
        continue;
      }
      const norm = local.split(path.sep).join('/');
      if (isAssetPath(norm)) assets.add(norm);
      else if (norm.startsWith('components/')) components.add(path.basename(norm).replace(/\.tsx?$/, ''));
      else modules.add(norm);
    }

    const id = appRel
      .replace(/^app\//, '')
      .replace(/\.tsx$/, '')
      .replace(/[()[\]]/g, '')
      .replace(/\//g, ':');

    screens.push({
      id,
      path: appRel,
      route: '/' + rel.replace(/\.tsx$/, '').replace(/\(([^)]+)\)\//g, '').replace(/\/?index$/, ''),
      kind: groups.some((g) => g.includes('tabs')) ? 'tab' : rel === 'index.tsx' ? 'entry' : 'screen',
      category: categorize(base, groups.concat(dirs)),
      tags: tagsFor(appRel),
      traits: screenTraits(root, appRel),
      components: [...components].sort(),
      modules: [...modules].sort(),
      packages: [...packages].sort(),
      assets: [...assets].sort(),
    });
  }

  // Components inventory: elements vs forms vs layout, per template convention
  const componentFiles = walk(path.join(root, 'components'), { exts: ['.tsx'] }).map((f) => f.split(path.sep).join('/'));
  const componentsByGroup = { elements: [], forms: [], layout: [] };
  for (const f of componentFiles) {
    const cname = path.basename(f).replace(/\.tsx$/, '');
    if (f.startsWith('forms/')) componentsByGroup.forms.push(cname);
    else if (f.startsWith('layout/')) componentsByGroup.layout.push(cname);
    else componentsByGroup.elements.push(cname);
  }

  const design = {
    theming: exists(path.join(root, 'global.css')) ? 'css-variables' : 'js-tokens',
    themeFiles: ['global.css', 'utils/color-theme.ts', 'contexts/ThemeColors.tsx', 'app/contexts/ThemeColors.tsx', 'tailwind.config.js']
      .filter((f) => exists(path.join(root, f))),
    darkMode: true,
  };

  const { componentTraits, patterns, styleProfile } = analyzeStyle(root, screens);

  return {
    $schema: '../schema/template.schema.json',
    name,
    title: null,
    description: firstParagraph(path.join(root, 'PRODUCT.md')) || firstParagraph(path.join(root, 'README.md')),
    source: { repo: repo || null, localPath: null },
    stack: detectStack(root, pkg),
    design,
    layouts,
    screens,
    apiRoutes,
    components: componentsByGroup,
    componentTraits,
    patterns,
    styleProfile,
    counts: { screens: screens.length, layouts: layouts.length, components: componentFiles.length },
    generatedBy: GENERATOR,
  };
}

/** Preserve curated fields from a previous manifest and apply screen overrides. */
export function mergeCurated(fresh, existing) {
  if (!existing) return fresh;
  const out = { ...fresh };
  for (const k of ['title', 'description', 'idea', 'tags']) {
    if (existing[k] != null) out[k] = existing[k];
  }
  if (existing.source) out.source = { ...fresh.source, ...existing.source };
  const curation = existing.curation || {};
  out.curation = curation;
  out.screens = fresh.screens.map((s) => {
    const c = curation[s.path];
    return c ? { ...s, ...c, tags: [...new Set([...(s.tags || []), ...(c.tags || [])])] } : s;
  });
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), ['print', 'all']);

  if (args.all) {
    const registry = loadRegistry();
    for (const [name, entry] of Object.entries(registry.templates)) {
      const root = path.resolve(REPO_ROOT, entry.localPath);
      if (!exists(root)) {
        console.warn(`skip ${name}: ${entry.localPath} not checked out`);
        continue;
      }
      const outFile = path.join(TEMPLATES_DIR, `${name}.json`);
      const existing = exists(outFile) ? readJson(outFile) : null;
      const manifest = mergeCurated(scanTemplate(root, { name, repo: entry.repo }), existing);
      manifest.source = { repo: entry.repo || null, localPath: entry.localPath };
      writeJson(outFile, manifest);
      console.log(`scanned ${name}: ${manifest.counts.screens} screens, ${manifest.counts.components} components → ${path.relative(REPO_ROOT, outFile)}`);
    }
    return;
  }

  const root = args._[0];
  if (!root) fail('usage: scan.mjs <template-root> [--name id] [--repo owner/repo] [--out file] [--print] | scan.mjs --all');
  const manifest = scanTemplate(root, { name: args.name, repo: args.repo });
  const outFile = args.out ? path.resolve(args.out) : path.join(path.resolve(root), 'template.json');
  const existing = exists(outFile) ? readJson(outFile) : null;
  const merged = mergeCurated(manifest, existing);
  if (args.print) {
    console.log(JSON.stringify(merged, null, 2));
    return;
  }
  writeJson(outFile, merged);
  console.log(`scanned ${merged.name}: ${merged.counts.screens} screens, ${merged.counts.components} components → ${outFile}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPathSafe(import.meta.url)) {
  main();
}

function fileURLToPathSafe(url) {
  return path.resolve(new URL(url).pathname);
}
