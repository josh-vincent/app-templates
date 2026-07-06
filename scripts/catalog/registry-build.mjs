#!/usr/bin/env node
// Build a shadcn-style registry from the catalog: one JSON item per
// installable unit (component, screen, lib module, theme), with npm
// dependencies, registryDependencies (other items it imports), file lists,
// and extracted variant/state props for the gallery.
//
//   node scripts/catalog/registry-build.mjs            # → registry/
//
// Item ids are namespaced by template: `drivo/button`, `evento/screen-event-detail`.
// Install items with: node scripts/catalog/add.mjs <id...> --to <target>

import fs from 'node:fs';
import path from 'node:path';
import {
  walk, parseImports, resolveLocalImport, isAssetPath, isLocalSpec,
  packageNameOf, readJson, writeJson, exists, loadRegistry, REPO_ROOT, CATALOG_DIR,
} from './lib.mjs';
import { detectTraits } from './style.mjs';

export const REGISTRY_DIR = path.join(REPO_ROOT, 'registry');

const MODULE_DIRS = ['components', 'contexts', 'hooks', 'utils', 'lib', 'data', 'services'];

function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

function extractUnionProp(src, prop) {
  const m = src.match(new RegExp(`${prop}\\??:\\s*([^;\\n]+)`));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

/** Boolean props from the component's interface — its togglable STATES. */
function extractStateProps(src) {
  const states = new Set();
  for (const m of src.matchAll(/^\s*(\w+)\?\s*:\s*boolean/gm)) {
    const name = m[1];
    if (!['className'].includes(name)) states.add(name);
  }
  return [...states];
}

function itemIdFor(template, relPath) {
  const base = path.basename(relPath).replace(/\.(tsx?|jsx?)$/, '');
  if (relPath.startsWith('components/')) return `${template}/${kebab(base)}`;
  if (relPath.startsWith('app/')) {
    return `${template}/screen-${kebab(relPath.replace(/^app\//, '').replace(/\.tsx$/, '').replace(/[()[\]]/g, '').replace(/\//g, '-'))}`;
  }
  return `${template}/lib-${kebab(relPath.replace(/\.(tsx?|jsx?)$/, '').replace(/\//g, '-'))}`;
}

function typeFor(relPath) {
  if (relPath.startsWith('components/')) return 'registry:ui';
  if (relPath.startsWith('app/')) return 'registry:screen';
  return 'registry:lib';
}

/** Analyze one source file into a registry item skeleton. */
function analyzeFile(templateName, rootAbs, relPath) {
  const full = path.join(rootAbs, relPath);
  const src = fs.readFileSync(full, 'utf8');
  const deps = new Set();
  const regDeps = new Set();
  const assets = new Set();
  for (const spec of parseImports(src)) {
    const local = resolveLocalImport(spec, full, rootAbs);
    if (!local) {
      if (isLocalSpec(spec)) continue;
      const p = packageNameOf(spec);
      if (!['react', 'react-native'].includes(p)) deps.add(p);
      continue;
    }
    const norm = local.split(path.sep).join('/');
    if (isAssetPath(norm)) assets.add(norm);
    else regDeps.add(itemIdFor(templateName, norm));
  }
  const item = {
    name: itemIdFor(templateName, relPath),
    type: typeFor(relPath),
    template: templateName,
    files: [
      { path: relPath, type: typeFor(relPath), target: relPath },
      ...[...assets].sort().map((a) => ({ path: a, type: 'registry:asset', target: a })),
    ],
    dependencies: [...deps].sort(),
    registryDependencies: [...regDeps].sort(),
  };
  if (item.type === 'registry:ui') {
    item.props = {
      variants: extractUnionProp(src, 'variant'),
      sizes: extractUnionProp(src, 'size'),
      rounded: extractUnionProp(src, 'rounded'),
      states: extractStateProps(src),
    };
    item.traits = detectTraits(src).filter((t) => t !== 'theme-aware');
    item.group = relPath.startsWith('components/forms/') ? 'forms' : relPath.startsWith('components/layout/') ? 'layout' : 'elements';
  }
  return item;
}

export function buildRegistry() {
  const registry = loadRegistry();
  const manifestByName = {};
  const items = [];

  for (const [name, entry] of Object.entries(registry.templates)) {
    const root = path.resolve(REPO_ROOT, entry.localPath);
    if (!exists(root)) continue;
    const manifestFile = path.join(CATALOG_DIR, 'templates', `${name}.json`);
    const manifest = exists(manifestFile) ? readJson(manifestFile) : null;
    manifestByName[name] = manifest;

    // Theme item — the template's design layer as one installable unit
    if (manifest?.design?.themeFiles?.length) {
      items.push({
        name: `${name}/theme`,
        type: 'registry:theme',
        template: name,
        title: `${manifest.title || name} theme`,
        files: manifest.design.themeFiles.map((f) => ({ path: f, type: 'registry:theme', target: f })),
        dependencies: [],
        registryDependencies: [],
      });
    }

    // Module dirs → ui + lib items
    for (const dir of MODULE_DIRS) {
      for (const rel of walk(path.join(root, dir), { exts: ['.tsx', '.ts'] })) {
        const relPath = dir + '/' + rel.split(path.sep).join('/');
        if (relPath.endsWith('.d.ts')) continue;
        items.push(analyzeFile(name, root, relPath));
      }
    }
    // Screens (+ their in-app support files under app/contexts, app/hooks)
    for (const rel of walk(path.join(root, 'app'), { exts: ['.tsx', '.ts'] })) {
      const relPath = 'app/' + rel.split(path.sep).join('/');
      if (relPath.endsWith('.d.ts') || /\+api\.ts$/.test(relPath)) continue;
      const item = analyzeFile(name, root, relPath);
      const screen = manifest?.screens?.find((s) => s.path === relPath);
      if (screen) {
        item.category = screen.category;
        item.route = screen.route;
        item.kind = screen.kind;
        item.traits = screen.traits || [];
      } else if (/_layout\.tsx$/.test(relPath)) {
        item.type = 'registry:layout';
      } else if (relPath.startsWith('app/contexts/') || relPath.startsWith('app/hooks/')) {
        item.type = 'registry:lib';
      }
      items.push(item);
    }
  }

  // Drop dangling registryDependencies (imports of files we didn't itemize)
  const known = new Set(items.map((i) => i.name));
  for (const item of items) {
    item.registryDependencies = item.registryDependencies?.filter((d) => known.has(d)) || [];
  }

  // Write per-item files + index
  fs.rmSync(REGISTRY_DIR, { recursive: true, force: true });
  for (const item of items) {
    writeJson(path.join(REGISTRY_DIR, item.name + '.json'), { $schema: '../registry-item.schema.json', ...item });
  }
  const index = {
    $schema: './registry.schema.json',
    generatedBy: 'app-templates/scripts/catalog/registry-build.mjs',
    counts: {
      items: items.length,
      ui: items.filter((i) => i.type === 'registry:ui').length,
      screens: items.filter((i) => i.type === 'registry:screen').length,
      lib: items.filter((i) => i.type === 'registry:lib').length,
      layouts: items.filter((i) => i.type === 'registry:layout').length,
      themes: items.filter((i) => i.type === 'registry:theme').length,
    },
    items: items.map((i) => ({
      name: i.name,
      type: i.type,
      template: i.template,
      ...(i.group ? { group: i.group } : {}),
      ...(i.category ? { category: i.category } : {}),
      ...(i.props ? { props: i.props } : {}),
      ...(i.traits?.length ? { traits: i.traits } : {}),
      dependencies: i.dependencies,
      registryDependencies: i.registryDependencies,
      files: i.files.map((f) => f.path),
    })),
  };
  writeJson(path.join(REGISTRY_DIR, 'registry.json'), index);
  return index;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirect) {
  const index = buildRegistry();
  console.log(`registry: ${index.counts.items} items (${index.counts.ui} ui · ${index.counts.screens} screens · ${index.counts.lib} lib · ${index.counts.layouts} layouts · ${index.counts.themes} themes) → registry/`);
}
