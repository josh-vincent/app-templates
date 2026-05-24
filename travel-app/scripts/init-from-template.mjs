#!/usr/bin/env node
// Rename this template into a new project.
//
// Prompts for: display name, slug, bundle ID, URL scheme, optional EAS owner.
// Then rewrites every occurrence of FitStake / fitstake / FITSTAKE and the
// fitstake bundle id across source files, JSON config, and shell scripts.
//
// Usage:
//   node scripts/init-from-template.mjs               # interactive
//   node scripts/init-from-template.mjs --dry-run     # show changes, write nothing
//   node scripts/init-from-template.mjs \
//     --name "Acme" --slug acme --bundle com.acme.app --scheme acme --owner acme-team
//
// Safe to abort mid-run before changes are confirmed; once it starts writing
// it walks files one by one (no transactional rollback), so commit first or
// run on a fresh copy.
//
// After it finishes:
//   1. rm -rf ios android      (already gone in a fresh template)
//   2. bun install
//   3. bun run prebuild
//   4. cp .env.example .env    and fill in
//   5. bun run convex:dev:local
//   6. bun run ios:dev / android

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// The template's "from" identity. If you fork the template and rename it,
// update these so future re-init runs still find every string.
const TEMPLATE = {
  displayName: 'FitStake',
  slug: 'fitstake',
  upper: 'FITSTAKE',
  bundleId: 'com.tocld.fitstake',
  scheme: 'fitstake',
  // The template's app.json.expo.owner is a placeholder. The init script
  // writes owner explicitly (or removes it) — this value only shows up in
  // the "About to apply" preview.
  owner: 'YOUR-EAS-OWNER',
};

// File patterns to skip entirely. The .gitignore-style entries are checked
// against any path segment, so node_modules / ios / android skip recursively.
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.expo-shared',
  '.convex',
  'ios',
  'android',
  'dist',
  '.next',
  '.turbo',
]);

// File extensions we will rewrite. Anything else (images, fonts, binary blobs)
// is left alone.
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.txt',
  '.yml',
  '.yaml',
  '.html',
  '.css',
  '.svg',
  '.sh',
  '.env',
  '.example',
]);

// Files inside the script directory we should not rewrite — this very script
// contains TEMPLATE.* literals as data and rewriting them would break it.
const SELF_FILES = new Set([resolve(__dirname, 'init-from-template.mjs')]);

const BOOL_FLAGS = new Set(['dry-run', 'yes']);

function parseArgs(argv) {
  const out = { dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (BOOL_FLAGS.has(key)) {
      // Normalise --dry-run → dryRun
      out[key === 'dry-run' ? 'dryRun' : key] = true;
    } else {
      out[key] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function isValidSlug(s) {
  return /^[a-z][a-z0-9-]{0,38}[a-z0-9]$/.test(s);
}
function isValidBundleId(s) {
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(s);
}
function isValidScheme(s) {
  return /^[a-z][a-z0-9.+-]{1,38}$/.test(s);
}

async function prompt(rl, label, def, validate, autoAccept) {
  for (;;) {
    let raw;
    if (autoAccept) {
      raw = '';
      console.log(`${label}${def ? ` [${def}]` : ''}: ${def ?? ''}`);
    } else {
      raw = (await rl.question(`${label}${def ? ` [${def}]` : ''}: `)).trim();
    }
    const value = raw || def || '';
    if (validate) {
      const err = validate(value);
      if (err) {
        if (autoAccept) throw new Error(`invalid value for "${label}": ${err}`);
        console.log(`  ✗ ${err}`);
        continue;
      }
    }
    return value;
  }
}

function toPascal(s) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

async function collectAnswers(args) {
  const nonInteractive = Boolean(args.yes);
  const rl = nonInteractive ? null : createInterface({ input, output });
  try {
    const displayName = await prompt(
      rl,
      'App display name (shown on home screen, e.g. "Acme" or "Acme Demo")',
      args.name,
      (v) => (v.length >= 1 && v.length <= 30 ? null : '1–30 characters'),
      nonInteractive,
    );
    const codeNameDefault = args['code-name'] || toPascal(displayName);
    const codeName = await prompt(
      rl,
      'Code name (PascalCase, used in identifiers like useXxxProGate)',
      codeNameDefault,
      (v) => (/^[A-Z][A-Za-z0-9]{1,40}$/.test(v) ? null : 'PascalCase, letters/digits only, 2–40 chars'),
      nonInteractive,
    );
    const slugDefault = args.slug || codeName.toLowerCase();
    const slug = await prompt(
      rl,
      'Slug (lowercase, used in expo project + URLs)',
      slugDefault,
      (v) => (isValidSlug(v) ? null : 'lowercase letters/digits/hyphens, start with letter, 2–40 chars'),
      nonInteractive,
    );
    const bundleId = await prompt(
      rl,
      'Bundle ID (iOS bundleIdentifier + Android package)',
      args.bundle || `com.example.${slug.replace(/-/g, '')}`,
      (v) => (isValidBundleId(v) ? null : 'reverse-DNS, e.g. com.acme.app'),
      nonInteractive,
    );
    const scheme = await prompt(
      rl,
      'URL scheme (deep-link prefix, e.g. acme:// )',
      args.scheme || slug.replace(/-/g, ''),
      (v) => (isValidScheme(v) ? null : 'lowercase, no spaces, 2–40 chars'),
      nonInteractive,
    );
    const owner = await prompt(
      rl,
      'EAS owner (Expo username / org — leave blank to remove)',
      args.owner || '',
      () => null,
      nonInteractive,
    );
    const upper = codeName.toUpperCase();
    return { displayName, codeName, slug, upper, bundleId, scheme, owner };
  } finally {
    if (rl) rl.close();
  }
}

function buildReplacements(target) {
  // Order matters: longer/more-specific strings first so we don't half-replace.
  // Important: TEMPLATE.displayName ("FitStake") is a JS-identifier-safe
  // PascalCase string in this codebase, so we map it to target.codeName (also
  // identifier-safe). The user-facing display name with possible spaces is
  // written explicitly to app.json.expo.name later — it is never used as a
  // bulk substitution to avoid breaking identifiers like useFitStakeProGate.
  return [
    [TEMPLATE.bundleId, target.bundleId],
    [TEMPLATE.upper, target.upper],
    [TEMPLATE.displayName, target.codeName],
    [TEMPLATE.slug, target.slug],
    // scheme is the same literal as slug; second pass is idempotent.
    [TEMPLATE.scheme, target.scheme],
  ];
}

function applyReplacements(text, pairs) {
  let out = text;
  for (const [from, to] of pairs) {
    if (from === to) continue;
    out = out.split(from).join(to);
  }
  return out;
}

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.name.startsWith('.DS_Store')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile()) out.push(full);
  }
  return out;
}

function extOf(path) {
  const i = path.lastIndexOf('.');
  return i === -1 ? '' : path.slice(i).toLowerCase();
}

function shouldRewrite(path) {
  if (SELF_FILES.has(path)) return false;
  const ext = extOf(path);
  if (TEXT_EXT.has(ext)) return true;
  // .env.example and friends — match by basename
  const base = path.split('/').pop() || '';
  if (base === '.env.example' || base === '.gitignore' || base === '.mcp.json' || base === '.prettierrc') {
    return true;
  }
  return false;
}

async function rewriteProject(target, opts) {
  const pairs = buildReplacements(target);
  const files = await walk(ROOT);

  let changedCount = 0;
  for (const file of files) {
    if (!shouldRewrite(file)) continue;
    const rel = relative(ROOT, file);
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    // Skip files that look binary (NUL byte in first 8 KB).
    const probe = buf.subarray(0, Math.min(buf.length, 8192));
    if (probe.includes(0)) continue;
    const before = buf.toString('utf8');
    const after = applyReplacements(before, pairs);
    if (after !== before) {
      changedCount += 1;
      if (opts.dryRun) {
        console.log(`  ~ ${rel}`);
      } else {
        writeFileSync(file, after, 'utf8');
      }
    }
  }

  // app.json gets a final pass: the bulk substitution above replaces
  // "FitStake" → target.codeName everywhere (correct for code identifiers),
  // but expo.name should be the user-facing display name (which may contain
  // spaces). Also handle owner removal + reset updates.url placeholder.
  const appJsonPath = join(ROOT, 'app.json');
  if (existsSync(appJsonPath)) {
    const parsed = JSON.parse(readFileSync(appJsonPath, 'utf8'));
    if (parsed.expo) {
      parsed.expo.name = target.displayName;
      // Slug and scheme share a literal in the template, so the bulk pass
      // sets scheme = slug. Restore the intended scheme here.
      parsed.expo.scheme = target.scheme;
      if (target.owner) parsed.expo.owner = target.owner;
      else delete parsed.expo.owner;
      if (parsed.expo.updates) {
        parsed.expo.updates.url = 'https://u.expo.dev/PLACEHOLDER-PROJECT-ID-RUN-EAS-INIT';
      }
    }
    if (!opts.dryRun) writeFileSync(appJsonPath, JSON.stringify(parsed, null, 2) + '\n');
  }

  return { changedCount, totalFiles: files.length };
}

function ensureTemplateState() {
  const pkgPath = join(ROOT, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== TEMPLATE.slug) {
    throw new Error(
      `package.json name is "${pkg.name}", expected "${TEMPLATE.slug}". ` +
        `Looks like this template has already been renamed. Either roll back ` +
        `or edit TEMPLATE.* in scripts/init-from-template.mjs.`,
    );
  }
}

function printNextSteps(target) {
  console.log('');
  console.log('  Next steps');
  console.log('  ──────────');
  console.log('    1. rm -rf ios android        (regen with prebuild)');
  console.log('    2. bun install');
  console.log('    3. cp .env.example .env  then fill in EXPO_PUBLIC_CONVEX_URL');
  console.log('    4. bun run convex:dev:local  (downloads convex local backend on first run)');
  console.log('    5. bun run prebuild');
  console.log('    6. bun run ios:dev   (or bun run android)');
  console.log('    7. bun run eas:init  (when you want to publish OTA updates)');
  console.log('');
  console.log(`  Your project: ${target.displayName} (${target.slug}) · ${target.bundleId}`);
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  try {
    ensureTemplateState();
  } catch (e) {
    console.error(`\nrefuse to run: ${e.message}\n`);
    process.exit(1);
  }

  console.log('');
  console.log(`  Renaming ${TEMPLATE.displayName} template → your new project`);
  console.log('  (Ctrl-C any time to abort. Nothing is written until all answers are confirmed.)');
  console.log('');

  const target = await collectAnswers(args);

  console.log('');
  console.log('  About to apply:');
  console.log(`    display name : ${TEMPLATE.displayName}        → ${target.displayName}`);
  console.log(`    code name    : ${TEMPLATE.displayName}        → ${target.codeName}`);
  console.log(`    slug         : ${TEMPLATE.slug}             → ${target.slug}`);
  console.log(`    UPPER        : ${TEMPLATE.upper}             → ${target.upper}`);
  console.log(`    bundle id    : ${TEMPLATE.bundleId} → ${target.bundleId}`);
  console.log(`    URL scheme   : ${TEMPLATE.scheme}://         → ${target.scheme}://`);
  console.log(`    EAS owner    : ${TEMPLATE.owner}             → ${target.owner || '(removed)'}`);
  console.log('');

  if (!args.yes) {
    const rl = createInterface({ input, output });
    const ok = (await rl.question('  Proceed? [y/N] ')).trim().toLowerCase();
    rl.close();
    if (ok !== 'y' && ok !== 'yes') {
      console.log('  aborted, no files changed.');
      process.exit(0);
    }
  }

  const { changedCount, totalFiles } = await rewriteProject(target, { dryRun: args.dryRun });

  if (args.dryRun) {
    console.log(`\n  dry-run: ${changedCount} of ${totalFiles} files would change\n`);
    return;
  }

  console.log(`\n  rewrote ${changedCount} of ${totalFiles} files.`);
  printNextSteps(target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
