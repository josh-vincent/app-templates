// Fates engine: resolve fate/capability/archetype declarations against the
// catalog (what to pull) and against a real app checkout (audit).

import fs from 'node:fs';
import path from 'node:path';
import { readJson, exists, CATALOG_DIR } from './lib.mjs';

export function loadFates() {
  return readJson(path.join(CATALOG_DIR, 'fates.json'));
}

/** Words/phrases in idea text → fate / archetype / capability requests. */
export const IDEA_PHRASES = {
  fates: {
    mvp: 'mvp',
    prototype: 'spike',
    spike: 'spike',
    beta: 'beta',
    testflight: 'beta',
    'store ready': 'store-ready',
    'app store ready': 'store-ready',
    'production ready': 'store-ready',
    'full working': 'store-ready',
  },
  capabilities: {
    ota: 'ota-updates',
    'ota updates': 'ota-updates',
    'over the air': 'ota-updates',
    skeleton: 'skeleton-shell',
    'error screens': 'skeleton-shell',
    'local first': 'local-first',
    'local-first': 'local-first',
    offline: 'local-first',
    'no auth': 'no-auth',
    'no login': 'no-auth',
    guest: 'no-auth',
    'demo mode': 'demo-mode',
    onboarding: 'onboarding',
    push: 'push-notifications',
    notifications: 'push-notifications',
    paywall: 'payments-iap',
    subscription: 'payments-iap',
    widgets: 'widgets',
    widget: 'widgets',
  },
  archetypes: {
    marketplace: 'marketplace',
    directory: 'directory',
    listings: 'directory',
    social: 'social',
    game: 'game',
    casino: 'game',
    tracker: 'tracker',
    habit: 'tracker',
    fitness: 'tracker',
    'ai assistant': 'ai-assistant',
    chatbot: 'ai-assistant',
    events: 'events',
    delivery: 'on-demand',
    ride: 'on-demand',
    travel: 'travel',
    feed: 'media-feed',
    utility: 'utility',
    tool: 'utility',
    dashboard: 'saas-companion',
  },
};

export function parseIdeaForFates(idea) {
  const hay = ' ' + idea.toLowerCase().replace(/[^a-z0-9 -]/g, ' ') + ' ';
  const out = { fate: null, archetypes: [], capabilities: [] };
  // Longest phrases first so "app store ready" beats "store"
  const scan = (map, cb) => {
    for (const phrase of Object.keys(map).sort((a, b) => b.length - a.length)) {
      if (hay.includes(' ' + phrase + ' ')) cb(map[phrase]);
    }
  };
  scan(IDEA_PHRASES.fates, (f) => (out.fate ||= f));
  scan(IDEA_PHRASES.archetypes, (a) => !out.archetypes.includes(a) && out.archetypes.push(a));
  scan(IDEA_PHRASES.capabilities, (c) => !out.capabilities.includes(c) && out.capabilities.push(c));
  return out;
}

/** Effective capability set for a plan: fate requirements + explicit, minus conflicts. */
export function effectiveCapabilities(fatesData, fateName, explicit = []) {
  const fate = fateName ? fatesData.fates[fateName] : null;
  const set = new Set([...(fate?.capabilities || []), ...explicit]);
  // no-auth conflicts with auth-dependent capabilities
  if (set.has('no-auth')) {
    set.delete('auth');
    set.delete('account-deletion');
    set.delete('demo-mode');
  }
  return [...set];
}

/**
 * Resolve one capability's `pulls` queries against the catalog index into
 * concrete {template, screen} picks (preferring the base template).
 */
export function resolveCapabilityPulls(cap, index, baseTemplate) {
  const picks = [];
  for (const q of cap.pulls || []) {
    const matches = index.screens.filter((s) => {
      if (q.category && s.category !== q.category) return false;
      if (q.match && !s.path.toLowerCase().includes(q.match)) return false;
      return true;
    });
    if (!matches.length) continue;
    const pick = matches.find((s) => s.template === baseTemplate) || matches[0];
    picks.push({ template: pick.template, screen: pick.path, category: pick.category });
  }
  return picks;
}

// ---- audit ------------------------------------------------------------------

function pkgDeps(root) {
  const f = path.join(root, 'package.json');
  if (!exists(f)) return {};
  const p = readJson(f);
  return { ...(p.dependencies || {}), ...(p.devDependencies || {}) };
}

function grepTree(root, needles, dirs = ['app', 'contexts', 'components', 'lib']) {
  for (const d of dirs) {
    const dir = path.join(root, d);
    if (!exists(dir)) continue;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const full = path.join(cur, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (/\.(tsx?|jsx?|json)$/.test(e.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (needles.some((n) => src.includes(n))) return true;
        }
      }
    }
  }
  return false;
}

/** Does this app checkout satisfy a capability's detection rules? */
export function detectCapability(cap, root, manifest) {
  const d = cap.detect || {};
  const deps = pkgDeps(root);
  const screens = manifest?.screens || [];
  const hasScreen = (needle) => screens.some((s) => s.path.toLowerCase().includes(needle));
  const results = [];

  if (d.packages) results.push(d.packages.some((p) => deps[p]));
  if (d.files) results.push(d.files.some((f) => exists(path.join(root, f))));
  if (d.anyScreens) results.push(d.anyScreens.some(hasScreen));
  if (d.absentScreens) results.push(d.absentScreens.every((n) => !hasScreen(n)));
  if (d.components) {
    const comps = new Set([...(manifest?.components?.elements || []), ...(manifest?.components?.forms || []), ...(manifest?.components?.layout || [])]);
    results.push(d.components.some((c) => comps.has(c)) || d.components.some((c) => deps['@jv/ui'] && c));
  }
  if (d.sources) results.push(grepTree(root, d.sources));
  if (d.appJson) {
    const f = path.join(root, 'app.json');
    const cfg = exists(f) ? JSON.stringify(readJson(f)) : '';
    results.push(d.appJson.some((k) => cfg.includes(`"${k}"`)));
  }
  if (!results.length) return null; // undetectable
  return results.some(Boolean);
}

/**
 * Audit an app checkout (already scanned into `manifest`) against a fate.
 * Returns [{id, text, status: 'pass'|'fail'|'manual'|'skipped', via}]
 */
export function auditFate(fatesData, fateName, root, manifest, declaredCapabilities = []) {
  const fate = fatesData.fates[fateName];
  if (!fate) throw new Error(`unknown fate "${fateName}" (have: ${Object.keys(fatesData.fates).join(', ')})`);
  const caps = new Set(effectiveCapabilities(fatesData, fateName, declaredCapabilities));
  const results = [];

  const capStatus = (capName) => {
    const cap = fatesData.capabilities[capName];
    if (!cap) return 'manual';
    const hit = detectCapability(cap, root, manifest);
    return hit === null ? 'manual' : hit ? 'pass' : 'fail';
  };

  // Required screen categories (auth requirement is waived under no-auth)
  for (const cat of fate.screenCategories || []) {
    if (cat === 'auth' && caps.has('no-auth')) {
      results.push({ id: `screens:${cat}`, text: `Has ${cat} screen(s) — waived, no-auth declared`, status: 'skipped', via: 'screen category' });
      continue;
    }
    const ok = (manifest.screens || []).some((s) => s.category === cat);
    results.push({ id: `screens:${cat}`, text: `Has ${cat} screen(s)`, status: ok ? 'pass' : 'fail', via: 'screen category' });
  }
  // Capability detections
  for (const capName of caps) {
    results.push({ id: `capability:${capName}`, text: fatesData.capabilities[capName]?.title || capName, status: capStatus(capName), via: 'capability' });
  }
  // Checklist items
  for (const item of fate.checklist || []) {
    if (item.onlyWith && !caps.has(item.onlyWith)) {
      results.push({ id: item.id, text: item.text, status: 'skipped', via: `only with ${item.onlyWith}` });
      continue;
    }
    let status = 'manual';
    const det = item.detect || 'manual';
    if (det.startsWith('capability:')) status = capStatus(det.slice(11));
    else if (det.startsWith('category:')) status = (manifest.screens || []).some((s) => s.category === det.slice(9)) ? 'pass' : 'fail';
    else if (det.startsWith('files:')) status = det.slice(6).split(',').some((f) => exists(path.join(root, f.trim()))) ? 'pass' : 'fail';
    else if (det === 'auth-decision') {
      const hasAuth = (manifest.screens || []).some((s) => s.category === 'auth');
      const declaredNoAuth = caps.has('no-auth');
      status = hasAuth || declaredNoAuth ? 'pass' : 'fail';
    }
    results.push({ id: item.id, text: item.text, status, via: 'checklist' });
  }
  return results;
}
