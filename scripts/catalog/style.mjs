// Style & pattern analysis — the finer-grained layer of the catalog.
//
// Detects visual/interaction TRAITS from component and screen source (glass,
// gradient, pill, elevated, flat, native-adaptive, animated …), extracts
// PATTERN inventories (buttons, sheets, drawers, tab bars, headers, cards,
// inputs, settings styles) with their variant options, and aggregates a
// template-level styleProfile.
//
// Identifiers are namespaced tokens usable in search and remix plans:
//   style:glass      style:flat        style:gradient    style:apple
//   buttons:pill     buttons:outline   sheet:gesture     drawer:custom
//   tabs:labeled     header:blurred    settings:toggles  layout:drawer+tabs

import fs from 'node:fs';
import path from 'node:path';
import { walk, exists } from './lib.mjs';

// ---- trait detectors --------------------------------------------------------
// Each rule: [trait, regex, weight]. Weight scales the styleProfile tally.
const TRAIT_RULES = [
  ['glass', /BlurView|expo-blur|GlassView|expo-glass-effect|backdrop-blur/, 3],
  ['liquid-glass', /expo-glass-effect|isLiquidGlassAvailable/, 4],
  ['gradient', /LinearGradient/, 2],
  ['pill', /rounded-full/, 1],
  ['soft-rounded', /rounded-(2xl|3xl)/, 1],
  ['sharp', /rounded-none/, 1],
  ['elevated', /shadowPresets|shadowColor|elevation:/, 1],
  ['outlined', /variant.*['"]outline['"]|border-border|isBordered/, 1],
  ['native-adaptive', /Platform\.(OS|select)/, 1],
  ['animated', /react-native-reanimated|useAnimatedStyle|withSpring|withTiming|Animated\./, 1],
  ['haptic', /expo-haptics|Haptics\./, 2],
  ['lottie', /lottie-react-native|LottieView/, 2],
  ['charts', /react-native-chart-kit|VictoryChart|BarChart|LineChart|PieChart/, 2],
  ['maps', /react-native-maps|MapView/, 2],
  ['theme-aware', /ThemedText|useThemeColors|dark:/, 0],
];

export function detectTraits(src) {
  const traits = [];
  for (const [trait, re] of TRAIT_RULES) if (re.test(src)) traits.push(trait);
  // "flat" is the absence of depth cues on something that still draws surfaces
  if (!traits.includes('elevated') && !traits.includes('glass') && /bg-(secondary|background|white|black)/.test(src)) {
    traits.push('flat');
  }
  return traits;
}

/** Extract union values for a prop from a TS interface, e.g. variant?: 'a' | 'b' */
function extractUnion(src, prop) {
  const m = src.match(new RegExp(`${prop}\\??:\\s*([^;\\n]+)`));
  if (!m) return [];
  const values = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  return values;
}

const PATTERN_MATCHERS = [
  { key: 'buttons', file: /^(Button|.*Button)\.tsx$/, exclude: /TabButton|DrawerButton|FloatingButton/ },
  { key: 'sheets', file: /Sheet/ },
  { key: 'drawers', file: /Drawer/ },
  { key: 'tabbars', file: /^(TabButton|TabBar|HomeTabs|ThemeTabs)\.tsx$/ },
  { key: 'headers', file: /^Header\.tsx$/ },
  { key: 'cards', file: /^(Card|CustomCard)\.tsx$/ },
  { key: 'chips', file: /^Chip\.tsx$/ },
  { key: 'inputs', file: /^(Input|Select|Switch|Selectable)\.tsx$/ },
];

/**
 * Build the fine-grained pattern inventory for one template checkout.
 * Returns { patterns, componentTraits, styleProfile }.
 */
export function analyzeStyle(root, screens = []) {
  const componentsDir = path.join(root, 'components');
  const files = walk(componentsDir, { exts: ['.tsx'] }).map((f) => f.split(path.sep).join('/'));

  const componentTraits = {};
  const tally = {};
  const patterns = {};

  for (const rel of files) {
    const name = path.basename(rel).replace(/\.tsx$/, '');
    const src = fs.readFileSync(path.join(componentsDir, rel), 'utf8');
    const traits = detectTraits(src);
    const visible = traits.filter((t) => t !== 'theme-aware');
    if (visible.length) componentTraits[name] = visible;
    for (const t of traits) {
      const rule = TRAIT_RULES.find((r) => r[0] === t);
      tally[t] = (tally[t] || 0) + (rule ? rule[2] : 1);
    }

    for (const pm of PATTERN_MATCHERS) {
      if (!pm.file.test(path.basename(rel))) continue;
      if (pm.exclude && pm.exclude.test(name)) continue;
      (patterns[pm.key] ||= []).push({
        component: name,
        path: 'components/' + rel,
        variants: extractUnion(src, 'variant'),
        rounded: extractUnion(src, 'rounded'),
        sizes: extractUnion(src, 'size'),
        traits: visible,
        // pattern-specific facets
        ...(pm.key === 'sheets' ? { gesture: /gestureEnabled/.test(src) } : {}),
        ...(pm.key === 'headers' ? { modes: extractUnion(src, 'variant').length ? extractUnion(src, 'variant') : undefined } : {}),
        ...(pm.key === 'tabbars' ? { labeled: /isLabelVisible/.test(src) } : {}),
      });
    }
  }

  // Settings style: inspect screens categorized as settings
  const settingsTraits = new Set();
  for (const s of screens.filter((x) => x.category === 'settings' || /settings/.test(x.path))) {
    const f = path.join(root, s.path);
    if (!exists(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (/ListLink/.test(src)) settingsTraits.add('list-chevron');
    if (/<Switch/.test(src)) settingsTraits.add('toggles');
    if (/<Section/.test(src)) settingsTraits.add('grouped');
    if (/ActionSheet/.test(src)) settingsTraits.add('sheet-pickers');
    if (/Avatar/.test(src)) settingsTraits.add('profile-header');
  }
  if (settingsTraits.size) patterns.settings = [...settingsTraits].sort();

  // Aggregate profile: dominant traits, plus a coarse family label
  const ranked = Object.entries(tally)
    .filter(([t]) => t !== 'theme-aware' && t !== 'flat')
    .sort((a, b) => b[1] - a[1]);
  const dominant = ranked.slice(0, 6).map(([t]) => t);
  const glassScore = (tally['glass'] || 0) + (tally['liquid-glass'] || 0);
  const family = tally['liquid-glass']
    ? 'apple-glass'
    : glassScore >= 6
      ? 'glass'
      : (tally['elevated'] || 0) > files.length / 4
        ? 'elevated'
        : 'flat';

  return {
    componentTraits,
    patterns,
    styleProfile: { family, dominant, tally },
  };
}

/** Screen-level traits from its own source file. */
export function screenTraits(root, screenPath) {
  const f = path.join(root, screenPath);
  if (!exists(f)) return [];
  return detectTraits(fs.readFileSync(f, 'utf8')).filter((t) => t !== 'theme-aware');
}

// ---- identifiers ------------------------------------------------------------
/**
 * Flatten one template manifest into namespaced identifier tokens →
 * evidence entries. Used by build-index to make identifiers searchable.
 */
export function identifiersOf(manifest) {
  const ids = {}; // token -> [evidence]
  const add = (token, evidence) => ((ids[token] ||= []).push(evidence));
  const t = manifest.name;

  if (manifest.styleProfile) {
    add(`style:${manifest.styleProfile.family}`, `${t} (template family)`);
    for (const tr of manifest.styleProfile.dominant || []) add(`style:${tr}`, `${t} (dominant)`);
  }
  for (const [comp, traits] of Object.entries(manifest.componentTraits || {})) {
    for (const tr of traits) add(`style:${tr}`, `${t}:${comp}`);
  }
  for (const l of manifest.layouts || []) {
    if (l.type && l.type !== 'root') add(`layout:${l.type}`, `${t}:${l.path}`);
  }
  const p = manifest.patterns || {};
  for (const b of p.buttons || []) {
    for (const v of b.variants || []) add(`buttons:${v}`, `${t}:${b.component}`);
    if ((b.rounded || []).includes('full')) add('buttons:pill', `${t}:${b.component}`);
    for (const tr of b.traits || []) add(`buttons:${tr}`, `${t}:${b.component}`);
  }
  for (const s of p.sheets || []) {
    add('sheet:action', `${t}:${s.component}`);
    if (s.gesture) add('sheet:gesture', `${t}:${s.component}`);
    for (const tr of s.traits || []) add(`sheet:${tr}`, `${t}:${s.component}`);
  }
  for (const d of p.drawers || []) add('drawer:custom', `${t}:${d.component}`);
  for (const h of p.headers || []) {
    for (const m of h.modes || []) add(`header:${m}`, `${t}:${h.component}`);
    for (const tr of h.traits || []) add(`header:${tr}`, `${t}:${h.component}`);
  }
  for (const tb of p.tabbars || []) {
    if (tb.labeled) add('tabs:labeled', `${t}:${tb.component}`);
    for (const tr of tb.traits || []) add(`tabs:${tr}`, `${t}:${tb.component}`);
  }
  for (const c of p.cards || []) for (const v of c.variants || []) add(`card:${v}`, `${t}:${c.component}`);
  for (const i of p.inputs || []) for (const v of i.variants || []) add(`input:${v}`, `${t}:${i.component}`);
  for (const st of p.settings || []) add(`settings:${st}`, `${t} (settings screens)`);
  for (const s of manifest.screens || []) {
    for (const tr of s.traits || []) add(`screen-style:${tr}`, `${t}:${s.id}`);
  }
  return ids;
}

/** Style words recognized in free-text ideas, mapped to identifier tokens. */
export const STYLE_KEYWORDS = {
  glass: 'style:glass',
  glassmorphism: 'style:glass',
  blur: 'style:glass',
  'liquid-glass': 'style:liquid-glass',
  apple: 'style:apple-glass',
  native: 'style:native-adaptive',
  flat: 'style:flat',
  minimal: 'style:flat',
  gradient: 'style:gradient',
  elevated: 'style:elevated',
  shadow: 'style:elevated',
  pill: 'buttons:pill',
  rounded: 'style:soft-rounded',
  animated: 'style:animated',
  lottie: 'style:lottie',
};
