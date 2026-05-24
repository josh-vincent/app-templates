#!/usr/bin/env tsx
/**
 * codemod-imports — rewrites per-app imports during a cutover.
 *
 *   pnpm codemod <appDir> [--apply]
 *
 * Without --apply it runs in dry mode and prints the changes it would make.
 * Maps:
 *   @/lib/theme                  → @jv/tokens
 *   @/components/<Primitive>     → @jv/ui  (Button, Card, Chip, etc.)
 *   @/components/forms/<Input>   → @jv/forms
 *   @/contexts/ThemeColors       → @jv/ui (useThemeColors)
 *   @/contexts/ThemeContext      → @jv/ui (useTheme, ThemeProvider)
 *   @/utils/useShadow            → @jv/ui (useShadow, shadowPresets)
 *
 * Idempotent — already-rewritten imports are left alone.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

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

type Rewrite = (line: string) => string | null;

const rewrites: Rewrite[] = [
  // @/lib/theme → @jv/tokens
  (line) => line.replace(/from\s+['"]@\/lib\/theme['"]/g, "from '@jv/tokens'"),
  // @/utils/useShadow → @jv/ui
  (line) => line.replace(/from\s+['"]@\/utils\/useShadow['"]/g, "from '@jv/ui'"),
  // @/contexts/ThemeColors → @jv/ui
  (line) => line.replace(/from\s+['"]@\/contexts\/ThemeColors['"]/g, "from '@jv/ui'"),
  // @/contexts/ThemeContext → @jv/ui
  (line) => line.replace(/from\s+['"]@\/contexts\/ThemeContext['"]/g, "from '@jv/ui'"),
  // @/components/forms/<Name> → @jv/forms
  (line) =>
    line.replace(/from\s+['"]@\/components\/forms\/([A-Za-z0-9_]+)['"]/g, (_m, name) =>
      FORMS_PRIMITIVES.has(name) ? "from '@jv/forms'" : _m
    ),
  // @/components/<Primitive> → @jv/ui   (only if it's a known shared primitive)
  (line) =>
    line.replace(/from\s+['"]@\/components\/([A-Za-z0-9_]+)['"]/g, (_m, name) =>
      UI_PRIMITIVES.has(name) ? "from '@jv/ui'" : _m
    ),
  // Relative ./forms/X imports inside files under components/ → @jv/forms
  (line) =>
    line.replace(/from\s+['"]\.\/forms\/([A-Za-z0-9_]+)['"]/g, (_m, name) =>
      FORMS_PRIMITIVES.has(name) ? "from '@jv/forms'" : _m
    ),
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.expo' || name === '.git' || name === 'ios' || name === 'android') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(full))) acc.push(full);
  }
  return acc;
}

function rewriteFile(file: string, apply: boolean): boolean {
  const source = readFileSync(file, 'utf8');
  let next = source;
  for (const fn of rewrites) {
    next = next
      .split('\n')
      .map((line) => fn(line) ?? line)
      .join('\n');
  }
  if (next === source) return false;
  if (apply) writeFileSync(file, next);
  return true;
}

const args = process.argv.slice(2);
const appDir = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');

if (!appDir) {
  console.error('Usage: pnpm codemod <appDir> [--apply]');
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
