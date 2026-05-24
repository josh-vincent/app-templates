#!/usr/bin/env node
/**
 * codemod-imports — rewrites per-app imports during a cutover.
 *   node scripts/codemod-imports.cjs <appDir> [--apply]
 * Plain-CJS twin of codemod-imports.ts so it can run without tsx/pnpm install.
 */
'use strict';
const { readFileSync, readdirSync, lstatSync, statSync, writeFileSync, existsSync } = require('node:fs');
const { extname, join, resolve } = require('node:path');

const UI_PRIMITIVES = new Set([
  'ActionSheetThemed', 'AnimatedFab', 'AnimatedView', 'Avatar', 'Button', 'Card',
  'CardScroller', 'Chip', 'ConfirmationModal', 'Container', 'CustomCard',
  'ErrorBoundary', 'FloatingButton', 'Header', 'HeaderIcon', 'Icon', 'ListLink',
  'MultiStep', 'Step', 'PaceRing', 'PageLoader', 'Placeholder', 'SafeWrapper',
  'ScreenContent', 'Skeleton', 'SkeletonBar', 'SkeletonCard', 'SkeletonRow',
  'SkeletonLoader', 'TabButton', 'ThemedText', 'ThemeFlatList', 'ThemeFooter',
  'ThemeScroller', 'ThemeTabs', 'ThemeTab', 'ThemeToggle', 'Toggle',
]);
const FORMS_PRIMITIVES = new Set([
  'Checkbox', 'Counter', 'DatePicker', 'FormTabs', 'FormTab', 'Input',
  'Select', 'Selectable', 'Slider', 'Switch', 'TextInput', 'TimePicker',
]);

const rewrites = [
  (line) => line.replace(/from\s+['"]@\/lib\/theme['"]/g, "from '@jv/tokens'"),
  (line) => line.replace(/from\s+['"]@\/utils\/useShadow['"]/g, "from '@jv/ui'"),
  (line) => line.replace(/from\s+['"]@\/contexts\/ThemeColors['"]/g, "from '@jv/ui'"),
  (line) => line.replace(/from\s+['"]@\/contexts\/ThemeContext['"]/g, "from '@jv/ui'"),
  // After the from-rewrites above, fix default-import shapes that @jv/ui
  // doesn't re-export as default. Converts:
  //   import useThemeColors from '@jv/ui'
  //   import useThemeColors, { foo } from '@jv/ui'
  //   import useShadow, { shadowPresets } from '@jv/ui'
  // into named-import form.
  (line) =>
    line.replace(
      /^(\s*import\s+)(useThemeColors|useShadow)(\s*,\s*\{([^}]*)\})?\s+from\s+(['"]@jv\/ui['"])/,
      (_m, prefix, name, _hasNamed, named, src) =>
        named && named.trim()
          ? `${prefix}{ ${name}, ${named.trim()} } from ${src}`
          : `${prefix}{ ${name} } from ${src}`
    ),
  (line) =>
    line.replace(/from\s+['"]@\/components\/forms\/([A-Za-z0-9_]+)['"]/g, (m, name) =>
      FORMS_PRIMITIVES.has(name) ? "from '@jv/forms'" : m
    ),
  (line) =>
    line.replace(/from\s+['"]@\/components\/([A-Za-z0-9_]+)['"]/g, (m, name) =>
      UI_PRIMITIVES.has(name) ? "from '@jv/ui'" : m
    ),
  (line) =>
    line.replace(/from\s+['"]\.\/forms\/([A-Za-z0-9_]+)['"]/g, (m, name) =>
      FORMS_PRIMITIVES.has(name) ? "from '@jv/forms'" : m
    ),
];

const SKIP_DIRS = new Set([
  'node_modules', '.expo', '.git', 'ios', 'android', '.turbo', 'build', 'dist',
  '.next', '.codebuddy', '.claude', '.cursor', '.vscode', '.idea', 'coverage',
]);

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let stat;
    try {
      stat = lstatSync(full);
      if (stat.isSymbolicLink()) {
        if (!existsSync(full)) continue;
        stat = statSync(full);
      }
    } catch { continue; }
    if (stat.isDirectory()) walk(full, acc);
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(full))) acc.push(full);
  }
  return acc;
}

function rewriteFile(file, apply) {
  const source = readFileSync(file, 'utf8');
  let next = source;
  for (const fn of rewrites) {
    next = next.split('\n').map((line) => fn(line) || line).join('\n');
  }
  if (next === source) return false;
  if (apply) writeFileSync(file, next);
  return true;
}

const args = process.argv.slice(2);
const appDir = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');

if (!appDir) {
  console.error('Usage: node scripts/codemod-imports.cjs <appDir> [--apply]');
  process.exit(1);
}

const root = resolve(appDir);
const files = walk(root);
let changed = 0;
for (const f of files) {
  if (rewriteFile(f, apply)) {
    changed++;
    console.log((apply ? 'REWROTE' : 'WOULD REWRITE'), f.slice(root.length + 1));
  }
}
console.log(`\n${apply ? 'Rewrote' : 'Would rewrite'} ${changed} of ${files.length} files in ${root}.`);
if (!apply && changed > 0) console.log('Run again with --apply to write changes.');
