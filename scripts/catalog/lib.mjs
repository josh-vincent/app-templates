// Shared helpers for the template catalog ("mobile app factory") scripts.
// Plain Node ESM, no external dependencies, so these scripts can run against
// any checkout (external template repos included) without installing anything.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CATALOG_DIR = path.join(REPO_ROOT, 'catalog');
export const TEMPLATES_DIR = path.join(CATALOG_DIR, 'templates');
export const REGISTRY_PATH = path.join(CATALOG_DIR, 'registry.json');

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Recursively list files under dir (relative paths), skipping junk dirs. */
export function walk(dir, { exts = null, skip = ['node_modules', '.git', '.expo', 'dist', 'build', 'ios', 'android'] } = {}) {
  const out = [];
  if (!exists(dir)) return out;
  const visit = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (skip.includes(entry.name)) continue;
        visit(full);
      } else if (!exts || exts.some((e) => entry.name.endsWith(e))) {
        out.push(path.relative(dir, full));
      }
    }
  };
  visit(dir);
  return out.sort();
}

const IMPORT_RE = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)|export\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

/** Extract all import/require specifiers from a source file's contents. */
export function parseImports(src) {
  const specs = new Set();
  // Strip block comments to reduce false positives.
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '');
  let m;
  while ((m = IMPORT_RE.exec(clean))) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (spec) specs.add(spec);
  }
  return [...specs];
}

const SOURCE_EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];
const ASSET_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.json', '.ttf', '.otf', '.mp3', '.mp4', '.lottie'];

/**
 * Resolve an import specifier to a repo-relative file path, or null when it
 * is an npm package. Handles the `@/` → repo-root alias used by all templates
 * and relative imports; tries source extensions and /index files.
 */
export function resolveLocalImport(spec, fromFileAbs, rootAbs) {
  const ROOT_DIRS = ['app', 'components', 'contexts', 'hooks', 'utils', 'lib', 'data', 'assets', 'services'];
  let base = null;
  if (spec.startsWith('@/')) base = path.join(rootAbs, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFileAbs), spec);
  else if (spec.startsWith('~/')) base = path.join(rootAbs, spec.slice(2));
  // Some templates import via bare root-relative paths (metro project-root resolution)
  else if (ROOT_DIRS.includes(spec.split('/')[0]) && spec.includes('/')) base = path.join(rootAbs, spec);
  else return null; // npm package
  const candidates = [base, ...SOURCE_EXTS.map((e) => base + e), ...SOURCE_EXTS.map((e) => path.join(base, 'index' + e))];
  for (const c of candidates) {
    if (exists(c) && fs.statSync(c).isFile()) return path.relative(rootAbs, c);
  }
  // Asset with explicit extension (require('@/assets/img/x.png'))
  if (ASSET_EXTS.some((e) => spec.endsWith(e)) && exists(base)) return path.relative(rootAbs, base);
  return null;
}

export function isAssetPath(p) {
  return ASSET_EXTS.some((e) => p.endsWith(e));
}

/** True for project-local specifiers that must never be treated as npm packages. */
export function isLocalSpec(spec) {
  return spec.startsWith('@/') || spec.startsWith('.') || spec.startsWith('~/');
}

export function packageNameOf(spec) {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0];
}

/** Filename-keyword → catalog category heuristics. First match wins. */
const CATEGORY_RULES = [
  [/(login|signup|sign-in|sign-up|forgot-password|auth|welcome)/, 'auth'],
  [/onboarding/, 'onboarding'],
  [/permission/, 'permissions'],
  [/(paywall|subscription|pricing|upgrade)/, 'monetization'],
  [/(edit-profile|user-profile|profile|account)/, 'profile'],
  [/(settings|languages|security|currency|preferences|devices|provider)/, 'settings'],
  [/notification/, 'notifications'],
  [/(chat|message|inbox)/, 'messaging'],
  [/(map|location)/, 'maps'],
  [/(search|filters|explore|discover)/, 'discovery'],
  [/(checkout|wallet|payment|earnings|earn|order|booking|reservation|ticket|cart|checkout)/, 'commerce'],
  [/(analytics|insights|dashboard|progress|stats)/, 'analytics'],
  [/(add-|create-|new-|-entry|compose)/, 'creation'],
  [/(detail|view-)/, 'detail'],
  [/(help|support|faq|safety)/, 'support'],
  [/(home|index|feed)/, 'home'],
  [/(review|rating)/, 'reviews'],
  [/(favorites?|bookmarks?|saved|wishlist)/, 'collections'],
  [/(calendar|schedule|trips?|activity|history)/, 'planning'],
  [/(components?|showcase|demo|blank|empty)/, 'showcase'],
];

export function categorize(fileBase, groups = []) {
  const hay = [fileBase, ...groups].join(' ').toLowerCase();
  for (const [re, cat] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return 'feature';
}

export function tagsFor(relPath) {
  const parts = relPath
    .replace(/\.[a-z]+$/, '')
    .split(/[\\/]/)
    .flatMap((p) => p.replace(/[()[\]…]/g, '').split(/[-_.]/))
    .map((t) => t.toLowerCase())
    .filter((t) => t && !['app', 'screens', 'tsx', 'index', 'tabs', 'drawer', 'id', '404', 'home'].includes(t));
  return [...new Set(parts)];
}

export function loadRegistry() {
  return exists(REGISTRY_PATH) ? readJson(REGISTRY_PATH) : { templates: {} };
}

/** Load every manifest in catalog/templates. Returns [{name, manifest, file}] */
export function loadManifests() {
  if (!exists(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f.replace(/\.json$/, ''), file: path.join(TEMPLATES_DIR, f), manifest: readJson(path.join(TEMPLATES_DIR, f)) }));
}

/** Resolve a template name to its local checkout root using the registry. */
export function resolveTemplateRoot(name) {
  const reg = loadRegistry();
  const entry = reg.templates?.[name];
  if (!entry) return null;
  const abs = path.resolve(REPO_ROOT, entry.localPath);
  return exists(abs) ? abs : null;
}

export function fail(msg) {
  console.error(`\x1b[31merror:\x1b[0m ${msg}`);
  process.exit(1);
}

/** Tiny argv parser: flags (--x value | --x) and positionals. */
export function parseArgs(argv, boolFlags = []) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (boolFlags.includes(key) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) args[key] = true;
      else args[key] = argv[++i];
    } else args._.push(a);
  }
  return args;
}
