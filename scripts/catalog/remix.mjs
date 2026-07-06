#!/usr/bin/env node
// Remix: describe an idea, get a plan composed from cataloged screens across
// templates, try variations, then materialize one into a target app.
//
//   suggest — turn an idea/direction into a remix plan skeleton
//     node scripts/catalog/remix.mjs suggest "dog walking marketplace with booking and chat" \
//       [--out plan.json] [--max 12]
//
//   apply — materialize a plan (pull every screen + deps) into a target app
//     node scripts/catalog/remix.mjs apply plan.json --to ../my-app \
//       [--variant bold] [--dry-run] [--force]
//
//   diff — compare two variants of a plan without building anything
//     node scripts/catalog/remix.mjs diff plan.json --variants base,bold
//
// Plan shape (see catalog/examples/):
// {
//   "name": "pawgo",
//   "idea": "dog walking marketplace…",
//   "base": { "template": "propia", "layout": "app/(tabs)/_layout.tsx" },
//   "design": { "from": "propia" },                       // whose theme files to take
//   "screens": [
//     { "template": "propia", "screen": "app/screens/checkout.tsx" },
//     { "template": "feedy", "screen": "app/screens/chat/[id].tsx", "as": "app/screens/chat/[id].tsx" }
//   ],
//   "variants": [
//     { "name": "with-social", "add": [{ "template": "feedy", "screen": "app/screens/add-post.tsx" }], "remove": [] }
//   ]
// }

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, exists, fail, parseArgs, resolveTemplateRoot, CATALOG_DIR, REPO_ROOT } from './lib.mjs';
import { pullScreen, resolveScreenArg, collectDependencyClosure } from './pull.mjs';
import { STYLE_KEYWORDS } from './style.mjs';
import { loadFates, parseIdeaForFates, effectiveCapabilities, resolveCapabilityPulls } from './fates.mjs';

const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'with', 'for', 'app', 'of', 'to', 'in', 'that', 'my', 'like', 'then', 'style']);
// Domain synonyms so plain-English ideas hit catalog tags/categories.
const SYNONYMS = {
  booking: ['booking', 'reservation', 'checkout', 'trips', 'calendar', 'order'],
  marketplace: ['listings', 'product', 'detail', 'filters', 'favorites', 'checkout', 'review'],
  chat: ['chat', 'messaging', 'message'],
  social: ['feed', 'post', 'profile', 'follow', 'notifications'],
  fitness: ['workout', 'progress', 'meals', 'weight', 'health', 'steps'],
  food: ['meals', 'meal'],
  events: ['event', 'tickets', 'ticket', 'calendar'],
  travel: ['trips', 'trip', 'flight', 'stays', 'itinerary', 'map'],
  ride: ['map', 'tracking', 'driver', 'location'],
  delivery: ['order', 'tracking', 'map', 'checkout'],
  ai: ['ai', 'voice', 'suggestions', 'provider', 'assistant'],
  property: ['property', 'listings', 'booking', 'map'],
  payments: ['wallet', 'earnings', 'payments', 'subscription', 'checkout'],
  weather: ['hourly', 'location', 'map', 'overlays'],
  gambling: ['blackjack', 'slots', 'history', 'wallet'],
  auth: ['login', 'signup', 'welcome', 'forgot', 'password'],
  onboarding: ['onboarding', 'welcome', 'permission'],
};

function loadIndex() {
  const f = path.join(CATALOG_DIR, 'index.json');
  if (!exists(f)) fail('catalog/index.json missing — run: node scripts/catalog/build-index.mjs');
  return readJson(f);
}

function expandIdea(idea) {
  const words = idea.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));
  const expanded = new Set(words);
  for (const w of words) for (const syn of SYNONYMS[w] || []) expanded.add(syn);
  return [...expanded];
}

function suggest(idea, { max = 12, style = {}, fate = null, archetypes = [], capabilities = [] } = {}) {
  const index = loadIndex();
  const fatesData = loadFates();

  // Fate / archetype / capability requests from the idea text + explicit flags
  const parsed = parseIdeaForFates(idea);
  fate = fate || parsed.fate;
  archetypes = [...new Set([...archetypes, ...parsed.archetypes])];
  capabilities = [...new Set([...capabilities, ...parsed.capabilities])];
  if (fate && !fatesData.fates[fate]) fail(`unknown fate "${fate}" (have: ${Object.keys(fatesData.fates).join(', ')})`);
  for (const a of archetypes) if (!fatesData.archetypes[a]) fail(`unknown archetype "${a}" (have: ${Object.keys(fatesData.archetypes).join(', ')})`);
  for (const c of capabilities) if (!fatesData.capabilities[c]) fail(`unknown capability "${c}" (have: ${Object.keys(fatesData.capabilities).join(', ')})`);
  const effCaps = effectiveCapabilities(fatesData, fate, capabilities);
  const archetypeCategories = new Set(archetypes.flatMap((a) => fatesData.archetypes[a].categories));
  const archetypeTemplates = new Set(archetypes.flatMap((a) => fatesData.archetypes[a].templates));
  const noAuth = effCaps.includes('no-auth');

  // Style words in the idea text ("glass", "apple", "flat", "pill"…) become
  // identifier requests, merged with explicit --style/--layout/… flags.
  const styleTokens = { ...style };
  for (const word of idea.toLowerCase().split(/[^a-z0-9:-]+/)) {
    const token = index.identifiers?.[word] ? word : STYLE_KEYWORDS[word];
    if (!token) continue;
    const ns = token.split(':')[0];
    styleTokens[ns === 'style' ? 'screens' : ns] ||= token;
  }
  for (const token of Object.values(styleTokens)) {
    if (token && !index.identifiers?.[token]) fail(`unknown identifier "${token}" — see catalog/STYLES.md or search.mjs --ids`);
  }

  const keywords = expandIdea(idea);
  const scoreOf = (hay) => keywords.reduce((n, k) => n + (hay.includes(k) ? 1 : 0), 0);

  // Score templates (title/description/tags/screen tags) to pick a base;
  // templates carrying the requested style identifiers score higher.
  const templateScores = index.templates
    .map((t) => {
      const screenTags = index.screens.filter((s) => s.template === t.name).flatMap((s) => s.tags || []);
      const hay = [t.name, t.title, t.description, t.idea, ...(t.tags || []), ...screenTags].join(' ').toLowerCase();
      let score = scoreOf(hay);
      for (const token of Object.values(styleTokens)) {
        const carriers = index.identifiers?.[token]?.templates || {};
        if (carriers[t.name]) score += 2 + Math.min(carriers[t.name], 5) / 5;
      }
      if (styleTokens.layout && t.layouts.some((l) => `layout:${l.type}` === styleTokens.layout)) score += 3;
      if (archetypeTemplates.has(t.name)) score += 4;
      return { name: t.name, score, template: t };
    })
    .sort((a, b) => b.score - a.score);
  const base = templateScores[0];

  // Score screens: idea keywords + archetype categories; drop auth screens for no-auth
  const scored = index.screens
    .filter((s) => !(noAuth && s.category === 'auth'))
    .map((s) => {
      const hay = [s.id, s.category, s.path, ...(s.tags || [])].join(' ').toLowerCase();
      let score = scoreOf(hay);
      if (archetypeCategories.has(s.category)) score += 1;
      if (s.template === base.name && score > 0) score += 0.5; // prefer staying coherent with the base
      return { ...s, _score: score };
    })
    .filter((s) => s._score > 0)
    .sort((a, b) => b._score - a._score);

  // De-dupe: one screen per (category + basename), best score wins
  const seen = new Set();
  const picks = [];
  for (const s of scored) {
    const key = s.category + ':' + path.basename(s.path);
    if (seen.has(key)) continue;
    seen.add(key);
    picks.push(s);
    if (picks.length >= max) break;
  }

  // Shallowest non-root layout is the app shell; --layout can pick a deeper one
  const baseLayouts = base.template.layouts
    .filter((l) => l.type !== 'root')
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  const preferredLayout = styleTokens.layout
    ? baseLayouts.find((l) => `layout:${l.type}` === styleTokens.layout) || baseLayouts[0]
    : baseLayouts[0];
  const plan = {
    $comment: 'Remix plan generated by remix.mjs suggest — edit freely, then: remix.mjs apply <plan> --to <target>',
    name: idea.split(/\s+/).slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, ''),
    idea,
    base: { template: base.name, layout: preferredLayout?.path || null },
    design: { from: base.name },
    style: Object.keys(styleTokens).length ? styleTokens : undefined,
    fate: fate || undefined,
    archetypes: archetypes.length ? archetypes : undefined,
    capabilities: effCaps.length ? effCaps : undefined,
    screens: picks.map((s) => ({ template: s.template, screen: s.path, category: s.category })),
    variants: [
      { name: 'lean', remove: picks.slice(Math.ceil(max / 2)).map((s) => ({ template: s.template, screen: s.path })), add: [], notes: 'Smaller MVP cut' },
    ],
    alternatives: templateScores.slice(1, 4).filter((t) => t.score > 0).map((t) => t.name),
  };

  // Capability pulls: append the screens each effective capability needs
  const have = new Set(plan.screens.map((s) => s.template + '|' + s.screen));
  for (const capName of effCaps) {
    for (const pick of resolveCapabilityPulls(fatesData.capabilities[capName], index, base.name)) {
      if (noAuth && /login|signup|forgot/.test(pick.screen)) continue;
      const key = pick.template + '|' + pick.screen;
      if (have.has(key)) continue;
      have.add(key);
      plan.screens.push({ ...pick, via: `capability:${capName}` });
    }
  }

  // Fate-required screen categories: fill any still missing from the base template
  if (fate) {
    const coveredCats = new Set(plan.screens.map((s) => s.category));
    for (const cat of fatesData.fates[fate].screenCategories || []) {
      if (coveredCats.has(cat) || (noAuth && cat === 'auth')) continue;
      const candidates = index.screens.filter((s) => s.category === cat && !(noAuth && /login|signup|forgot/.test(s.path)));
      const pick = candidates.find((s) => s.template === base.name) || candidates[0];
      if (pick && !have.has(pick.template + '|' + pick.path)) {
        plan.screens.push({ template: pick.template, screen: pick.path, category: pick.category, via: `fate:${fate}` });
        coveredCats.add(cat);
      }
    }
  }
  return { plan, templateScores: templateScores.slice(0, 5) };
}

function resolveVariant(plan, variantName) {
  let screens = [...plan.screens];
  if (variantName && variantName !== 'base') {
    const v = (plan.variants || []).find((x) => x.name === variantName);
    if (!v) fail(`variant "${variantName}" not in plan (have: base, ${(plan.variants || []).map((x) => x.name).join(', ')})`);
    const removeKeys = new Set((v.remove || []).map((r) => r.template + '|' + r.screen));
    screens = screens.filter((s) => !removeKeys.has(s.template + '|' + s.screen));
    screens.push(...(v.add || []));
  }
  return screens;
}

function applyPlan(planFile, args) {
  const plan = readJson(path.resolve(planFile));
  const targetRoot = args.to && path.resolve(args.to);
  if (!targetRoot) fail('--to <target app root> is required');
  const dryRun = !!args['dry-run'];
  const variant = args.variant || 'base';
  const screens = resolveVariant(plan, variant);

  if (!exists(targetRoot)) {
    if (dryRun) console.log(`[dry-run] target ${targetRoot} does not exist yet — would be created`);
    else fs.mkdirSync(targetRoot, { recursive: true });
  }

  const report = [];
  const allMissing = new Set();
  const provenance = [];

  // 0. Style pattern overrides — pull the components that implement each
  // requested identifier FIRST, so first-write-wins makes every screen pulled
  // afterwards reuse them (e.g. buttons:pill from the best-carrying template).
  const styleBlock = plan.style || {};
  const index = loadIndex();
  for (const [facet, token] of Object.entries(styleBlock)) {
    if (!token || facet === 'layout' || facet === 'screens') continue; // handled via base/template choice
    const entry = index.identifiers?.[token];
    if (!entry) {
      report.push(`SKIPPED style.${facet}=${token} — unknown identifier`);
      continue;
    }
    // Prefer the plan's base template if it carries the identifier, else the strongest carrier
    const carriers = Object.entries(entry.templates).sort((a, b) => b[1] - a[1]);
    const providerName = carriers.find(([n]) => n === plan.base?.template)?.[0] || carriers[0][0];
    const providerRoot = resolveTemplateRoot(providerName);
    if (!providerRoot) {
      report.push(`SKIPPED style.${facet}=${token} — provider ${providerName} not checked out`);
      continue;
    }
    const providerManifest = readJson(path.join(CATALOG_DIR, 'templates', `${providerName}.json`));
    let pulled = 0;
    if (facet === 'settings') {
      // Settings identifiers describe screens, not components: ensure a
      // settings screen carrying the trait lands (unless the plan has one).
      const planHasSettings = screens.some((s) => /settings/.test(s.screen));
      const settingsScreen = providerManifest.screens.find((s) => s.category === 'settings' && /\/settings\.tsx$/.test(s.path))
        || providerManifest.screens.find((s) => s.category === 'settings');
      if (!planHasSettings && settingsScreen) {
        const r = pullScreen({ sourceRoot: providerRoot, targetRoot, screenRel: settingsScreen.path, dryRun, force: !!args.force, log: () => {} });
        r.missingPackages.forEach((p) => allMissing.add(p));
        pulled = r.copies.filter((c) => c.action !== 'skip (exists)').length;
        provenance.push({ what: `style ${facet} (${token})`, from: providerName, path: settingsScreen.path, files: r.copies.length });
      }
    } else {
      // Pull the component files evidenced for this identifier from the provider
      const comps = [...new Set(entry.evidence
        .filter((e) => e.startsWith(providerName + ':') && !e.includes(' '))
        .map((e) => e.split(':')[1]))];
      for (const comp of comps) {
        const rel = Object.values(providerManifest.patterns || {}).flat()
          .find((p) => p.component === comp)?.path
          || (exists(path.join(providerRoot, 'components', comp + '.tsx')) ? 'components/' + comp + '.tsx' : null);
        if (!rel) continue;
        const r = pullScreen({ sourceRoot: providerRoot, targetRoot, screenRel: rel, dryRun, force: !!args.force, log: () => {} });
        r.missingPackages.forEach((p) => allMissing.add(p));
        pulled += r.copies.filter((c) => c.action !== 'skip (exists)').length;
        provenance.push({ what: `style ${facet} (${token})`, from: providerName, path: rel, files: r.copies.length });
      }
    }
    report.push(`${dryRun ? 'would apply' : 'applied'} style.${facet}=${token} from ${providerName} (${pulled} files)`);
  }

  // 1. Design + layout from the base template
  const baseRoot = plan.base?.template && resolveTemplateRoot(plan.base.template);
  if (plan.base?.template && !baseRoot) fail(`base template "${plan.base.template}" not checked out (see catalog/registry.json)`);
  if (baseRoot && plan.base.layout) {
    const r = pullScreen({ sourceRoot: baseRoot, targetRoot, screenRel: plan.base.layout, dryRun, force: !!args.force, log: () => {} });
    r.missingPackages.forEach((p) => allMissing.add(p));
    provenance.push({ what: 'layout', from: plan.base.template, path: plan.base.layout, files: r.copies.length });
  }
  const designFrom = plan.design?.from && resolveTemplateRoot(plan.design.from);
  if (designFrom) {
    const manifest = readJson(path.join(CATALOG_DIR, 'templates', `${plan.design.from}.json`));
    for (const tf of manifest.design?.themeFiles || []) {
      const src = path.join(designFrom, tf);
      const dest = path.join(targetRoot, tf);
      if (exists(src) && (!exists(dest) || args.force)) {
        if (!dryRun) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
        provenance.push({ what: 'design', from: plan.design.from, path: tf });
      }
    }
  }

  // 2. Screens (cross-template)
  for (const entry of screens) {
    const srcRoot = resolveTemplateRoot(entry.template);
    if (!srcRoot) {
      report.push(`SKIPPED ${entry.template}:${entry.screen} — template not checked out`);
      continue;
    }
    const screenRel = resolveScreenArg(srcRoot, entry.template, entry.screen);
    if (!screenRel) {
      report.push(`SKIPPED ${entry.template}:${entry.screen} — screen not found`);
      continue;
    }
    const r = pullScreen({ sourceRoot: srcRoot, targetRoot, screenRel, asRel: entry.as || null, dryRun, force: !!args.force, log: () => {} });
    r.missingPackages.forEach((p) => allMissing.add(p));
    const copied = r.copies.filter((c) => c.action !== 'skip (exists)').length;
    const skipped = r.copies.length - copied;
    provenance.push({ what: 'screen', from: entry.template, path: entry.as || screenRel, files: copied, reused: skipped });
    report.push(`${dryRun ? 'would pull' : 'pulled'} ${entry.template}:${screenRel}${entry.as ? ` as ${entry.as}` : ''} (${copied} files, ${skipped} already present)`);
  }

  // 3. Capability packages join the gap list BEFORE scaffolding so they get
  // merged into the seeded package.json with real versions.
  const fatesData = loadFates();
  const effCaps = effectiveCapabilities(fatesData, plan.fate, plan.capabilities || []);
  for (const capName of effCaps) {
    (fatesData.capabilities[capName]?.packages || []).forEach((p) => allMissing.add(p));
  }

  // Project scaffold: when the target has no package.json, seed it from the
  // base template (correct dependency versions) plus config files, then merge
  // in gap packages with versions looked up across the source templates.
  if (baseRoot && !exists(path.join(targetRoot, 'package.json'))) {
    const CONFIG_FILES = ['tsconfig.json', 'babel.config.js', 'babel.config.cjs', 'metro.config.js', 'metro.config.cjs', 'app.json', 'postcss.config.js', 'postcss.config.mjs', 'prettier.config.js', 'nativewind-env.d.ts', 'app-env.d.ts', '.gitignore'];
    for (const cf of CONFIG_FILES) {
      const src = path.join(baseRoot, cf);
      const dest = path.join(targetRoot, cf);
      if (exists(src) && !exists(dest)) {
        if (!dryRun) fs.copyFileSync(src, dest);
        provenance.push({ what: 'config', from: plan.base.template, path: cf });
      }
    }
    if (!dryRun) {
      const basePkg = readJson(path.join(baseRoot, 'package.json'));
      basePkg.name = plan.name || path.basename(targetRoot);
      // Resolve gap packages to real versions from whichever source template has them
      const registry = readJson(path.join(CATALOG_DIR, 'registry.json'));
      const sourcePkgs = Object.values(registry.templates)
        .map((e) => path.resolve(REPO_ROOT, e.localPath, 'package.json'))
        .filter(exists)
        .map(readJson);
      for (const p of [...allMissing]) {
        if (basePkg.dependencies?.[p]) {
          allMissing.delete(p);
          continue;
        }
        const version = sourcePkgs.map((sp) => sp.dependencies?.[p] || sp.devDependencies?.[p]).find(Boolean);
        (basePkg.dependencies ||= {})[p] = version || '*';
        allMissing.delete(p);
      }
      fs.writeFileSync(path.join(targetRoot, 'package.json'), JSON.stringify(basePkg, null, 2) + '\n');
    }
    provenance.push({ what: 'config', from: plan.base.template, path: 'package.json (renamed, gap packages merged)' });
    report.push(`${dryRun ? 'would scaffold' : 'scaffolded'} project files from ${plan.base.template}`);
  }

  // 4. Fate: capability setup + checklist for the REMIX.md report
  const capLines = [];
  for (const capName of effCaps) {
    const cap = fatesData.capabilities[capName];
    if (!cap) continue;
    capLines.push(`### ${cap.title}`, '', ...(cap.setup || []).map((s) => `- [ ] ${s}`), '');
  }
  const checklistLines = plan.fate
    ? [
        `## Fate: ${fatesData.fates[plan.fate].title}`,
        '',
        ...(fatesData.fates[plan.fate].checklist || []).map((c) => `- [ ] ${c.text}`),
        '',
        `Audit anytime: \`node scripts/catalog/check.mjs <this-app> --fate ${plan.fate}${effCaps.length ? ` --capabilities ${effCaps.join(',')}` : ''}\``,
        '',
      ]
    : [];

  // 4. REMIX.md provenance report in the target
  const md = [
    `# Remix: ${plan.name || path.basename(String(planFile))}`,
    '',
    plan.idea ? `> ${plan.idea}` : '',
    '',
    `Variant: **${variant}** · Base: **${plan.base?.template ?? '—'}** · Design from: **${plan.design?.from ?? '—'}**`,
    Object.keys(styleBlock).length ? `Style: ${Object.entries(styleBlock).map(([k, v]) => `${k}=\`${v}\``).join(' · ')}` : '',
    '',
    '| Layer | Source template | Path | Files |',
    '|---|---|---|---|',
    ...provenance.map((p) => `| ${p.what} | ${p.from} | \`${p.path}\` | ${p.files ?? ''}${p.reused ? ` (+${p.reused} reused)` : ''} |`),
    '',
    allMissing.size ? `## Packages to install\n\n\`\`\`\nnpm install ${[...allMissing].sort().join(' ')}\n\`\`\`` : '',
    '',
    ...checklistLines,
    ...(capLines.length ? ['## Capability setup', '', ...capLines] : []),
    '## Next steps',
    '',
    '- Wire pulled screens into the layout (`app/(tabs)/_layout.tsx` tab triggers / stack routes).',
    '- Screens pulled from different templates keep their own component copies on first conflict-free write; existing files are never overwritten without `--force`, so shared names resolve to whichever template landed first — review `components/` for duplicates.',
    '- Re-run with `--variant <name>` in a fresh target dir to compare variations side by side before committing to one.',
    '',
  ].filter((l) => l !== null).join('\n');

  if (!dryRun) fs.writeFileSync(path.join(targetRoot, 'REMIX.md'), md);

  console.log(report.join('\n'));
  if (allMissing.size) console.log(`\npackages needed: ${[...allMissing].sort().join(', ')}`);
  console.log(dryRun ? '\n[dry-run] nothing written' : `\nwrote ${path.join(targetRoot, 'REMIX.md')}`);
}

function diffPlan(planFile, args) {
  const plan = readJson(path.resolve(planFile));
  const names = (args.variants || 'base').split(',').map((s) => s.trim());
  const sets = names.map((n) => ({ n, screens: new Set(resolveVariant(plan, n).map((s) => s.template + ':' + (s.as || s.screen))) }));
  const all = [...new Set(sets.flatMap((s) => [...s.screens]))].sort();
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(pad('SCREEN', 60) + sets.map((s) => pad(s.n, 12)).join(''));
  for (const scr of all) {
    console.log(pad(scr, 60) + sets.map((s) => pad(s.screens.has(scr) ? '✓' : '—', 12)).join(''));
  }
}

const args = parseArgs(process.argv.slice(3), ['dry-run', 'force']);
const cmd = process.argv[2];
if (cmd === 'suggest') {
  const idea = args._.join(' ');
  if (!idea) fail('usage: remix.mjs suggest "<idea text>" [--out plan.json] [--max 12] [--style glass] [--layout drawer+tabs] [--settings toggles] [--buttons pill] [--sheet gesture] [--header blurred]');
  // Explicit facet flags become identifier tokens (namespace inferred from the flag)
  const style = {};
  for (const facet of ['style', 'layout', 'settings', 'buttons', 'sheet', 'header', 'tabs', 'card', 'input']) {
    if (typeof args[facet] === 'string') {
      const ns = facet === 'style' ? 'style' : facet;
      const key = facet === 'style' ? 'screens' : facet;
      style[key] = args[facet].includes(':') ? args[facet] : `${ns}:${args[facet]}`;
    }
  }
  const { plan, templateScores } = suggest(idea, {
    max: args.max ? parseInt(args.max, 10) : 12,
    style,
    fate: typeof args.fate === 'string' ? args.fate : null,
    archetypes: typeof args.archetype === 'string' ? args.archetype.split(',').map((s) => s.trim()) : [],
    capabilities: typeof args.capabilities === 'string' ? args.capabilities.split(',').map((s) => s.trim()) : [],
  });
  console.error('template match scores: ' + templateScores.map((t) => `${t.name}=${t.score}`).join('  '));
  if (args.out) {
    writeJson(path.resolve(args.out), plan);
    console.log(`plan → ${args.out} (${plan.screens.length} screens, base: ${plan.base.template})`);
    console.log(`next: node scripts/catalog/remix.mjs apply ${args.out} --to <target> --dry-run`);
  } else {
    console.log(JSON.stringify(plan, null, 2));
  }
} else if (cmd === 'apply') {
  const planFile = args._[0];
  if (!planFile) fail('usage: remix.mjs apply <plan.json> --to <target> [--variant name] [--dry-run] [--force]');
  applyPlan(planFile, args);
} else if (cmd === 'diff') {
  const planFile = args._[0];
  if (!planFile) fail('usage: remix.mjs diff <plan.json> --variants base,lean');
  diffPlan(planFile, args);
} else {
  fail('usage: remix.mjs <suggest|apply|diff> …  (see header comment)');
}
