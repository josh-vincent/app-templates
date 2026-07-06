# Mobile App Factory — Screen Catalog

Describe an idea, pull real, functional screens from proven templates, remix
them into a new app — and try variations before committing to a build.

The catalog indexes every template this workspace knows about (embedded dirs
like `voyage/` and external sibling checkouts like `../drivo`) and breaks each
one down into four layers:

| Layer | What it is | Where it lives in a manifest |
|---|---|---|
| **Layout** | Navigation shells — drawer, tabs, stack (`_layout.tsx`) | `layouts[]` |
| **Design** | Theming/tokens — `global.css`, `color-theme.ts`, `ThemeColors` | `design` |
| **Screens** | Functional feature screens, the primary catalog unit | `screens[]` |
| **Elements** | Reusable components a screen imports (Button, Card, …) | `components` + per-screen `screens[].components` |

Every screen entry records its route, kind (`tab`/`screen`/`entry`), category
(auth, commerce, messaging, maps, …), tags, the components/modules it imports,
the npm packages it needs, and the image assets it references — so a screen can
be lifted out of its template with everything required to run.

## Style & pattern identifiers

Below screens sits a finer grain: the scanner detects visual/interaction
**traits** from source (BlurView/expo-glass-effect → glass, LinearGradient →
gradient, `rounded-full` → pill, shadowPresets → elevated, `Platform.select` →
native-adaptive, …), extracts **pattern inventories** with their variant
options (buttons, sheets, drawers, tab bars, headers, cards, inputs, settings
styles), and rolls each template up into a `styleProfile` (family: apple-glass,
glass, elevated, flat).

All of it is addressable through namespaced **identifiers** — see the generated
reference [`STYLES.md`](./STYLES.md):

```
style:glass        style:liquid-glass   style:flat        style:gradient
buttons:pill       buttons:outline      buttons:ghost     sheet:gesture
drawer:custom      tabs:labeled         header:blurred    card:overlay
input:underlined   settings:toggles     settings:list-chevron
layout:drawer+tabs layout:tabs          screen-style:glass
```

Use them anywhere:

```bash
pnpm catalog:search --ids buttons                 # list identifiers per namespace
pnpm catalog:search settings style:glass          # identifier tokens in free text
pnpm catalog:remix suggest "meditation and travel app with glass style and pill buttons" \
  --layout tabs --settings toggles --out plan.json
```

The goal sentence works literally: *"creating a meditation and travel app —
use `style:glass` screens and `layout:tabs` with `settings:toggles`"*. Style
words in the idea text (glass, apple, flat, pill, gradient, animated…) are
recognized automatically; explicit flags (`--style --layout --settings
--buttons --sheet --header --tabs --card --input`) pin the rest.

In a plan, the `style` block drives **pattern overrides**: `apply` pulls the
components that implement each identifier (from the best-carrying template,
preferring the base) *before* any screens, so first-write-wins makes every
pulled screen adopt them — e.g. `buttons:pill` claims `components/Button.tsx`
from its provider, and `settings:toggles` guarantees a toggle-style settings
screen lands. Every override is listed in the target's `REMIX.md` provenance.

## Fates, capabilities & archetypes

A plan also declares what the app is destined to be — see the generated
[`FATES.md`](./FATES.md) reference:

- **Fate** (maturity tier): `spike` → `mvp` → `beta` → `store-ready` →
  `flagship`. Each fate requires capabilities and screen categories and
  carries a review checklist (store-ready includes Apple's account-deletion
  rule, permission priming, legal screens, IAP compliance, offline behavior,
  i18n; flagship adds the native-polish surfaces below plus explicit
  ship-or-rule-out decisions for the rest).
- **Capability** (31 composable features): `ota-updates`, `skeleton-shell`
  (login gate + loading + network boundaries + all error screens),
  `local-first`, `no-auth`, `demo-mode`, `push-notifications`, `payments-iap`,
  `error-reporting`, `analytics`, `deep-links`, `i18n`, `permission-priming`,
  `legal`, `account-deletion`, `maps`, … and the **native tier**:
  `live-activities` (ActivityKit + Dynamic Island), `widgets` (WidgetKit /
  Glance), `watch-app`, `app-intents` (Siri/Shortcuts/Spotlight/interactive
  widgets), `quick-actions`, `share-extension`, `app-clips`, `biometrics`,
  `health-data` (HealthKit/Health Connect), `camera-media`,
  `background-tasks`, `haptics`, `store-review`. Native capabilities carry
  platform tags, real detection rules, and reference implementations in this
  repo (fitstake ships working WidgetKit widgets + a Live Activity via
  `@bacons/apple-targets`).
- **Archetype** (app shape): `game`, `directory`, `marketplace`, `social`,
  `tracker`, `ai-assistant`, `events`, `on-demand`, `travel`, `media-feed`,
  `utility`, `saas-companion` — each maps to screen categories and the best
  base templates.

All three are recognized in idea text ("…no auth, local first, app store
ready") or pinned with flags:

```bash
pnpm catalog:remix suggest "local directory of dog parks" \
  --fate store-ready --archetype directory --capabilities no-auth,local-first --out plan.json
pnpm catalog:remix apply plan.json --to ../dogparks     # pulls capability screens,
                                                        # scaffolds package.json + configs,
                                                        # writes fate checklist into REMIX.md
pnpm catalog:check ../dogparks --plan plan.json         # audit the gate: pass/fail/manual
```

`check` scans the real target (screens, package.json, app.json, source
greps) and exits non-zero while detectable requirements fail — usable as a
CI gate per fate. `no-auth` waives auth requirements and strips login/signup
from every suggestion; capability packages are merged into the scaffolded
package.json with real versions from the source templates.

## Registry (shadcn-style) & the `add` command

Everything the catalog knows is also compiled into an installable **registry**
(`registry/`): one JSON item per unit — `registry:ui` (components, with
extracted `variant`/`size`/`rounded` unions and boolean **state** props),
`registry:screen`, `registry:layout`, `registry:lib` (contexts/hooks/utils/
data), and `registry:theme` — each with npm `dependencies` and
`registryDependencies` (the other items it imports). Item ids are namespaced:
`drivo/button`, `evento/screen-screens-event-detail`, `propia/theme`.

```bash
pnpm catalog:registry                                  # rebuild registry/ from the catalog
pnpm catalog:add --list drivo --type registry:ui       # what's installable
pnpm catalog:add drivo/button propia/theme --to ../my-app [--dry-run]
```

`add` resolves `registryDependencies` transitively and copies every needed
file from the source checkouts — like `npx shadcn add button`, but for any
component, screen, layout, lib module, or theme in any template.

## Visual component library

```bash
pnpm catalog:gallery      # → catalog/gallery/index.html (self-contained)
```

A browsable gallery of **every UI component in every template**, rendered as
variant × size × state matrices (primary/secondary/outline/ghost ·
small/medium/large · default/disabled/loading/selected…) using each template's
**real theme palette** parsed from its theme files, in both light and dark
mode. Filter by template, group (elements/forms/layout), or free text; every
card shows the component's traits, its extracted prop unions, and a
click-to-copy install command. Previews are CSS approximations driven by real
extracted data — live RN rendering of the shared `@jv/*` components stays in
`apps/showcase` (`pnpm showcase`).

## Onboarding new projects

```bash
# scaffold from a base template (or --plan remix.json), register, rescan
pnpm catalog:onboard new pawgo --template propia --idea "dog walking marketplace" --fate mvp

# register a project that already exists (sibling checkouts work too)
pnpm catalog:onboard existing ../my-app --repo me/my-app
```

`onboard` creates the project (full template copy or remix plan), renames
package/app config, writes a `PRODUCT.md` stub carrying the idea + fate, adds
the project to `catalog/registry.json`, and rebuilds the scan → index →
registry → gallery chain — so everything you build in the new project is
immediately searchable, remixable, installable, and visible in the gallery.
As the project grows, `pnpm catalog:scan && pnpm catalog:index &&
pnpm catalog:registry && pnpm catalog:gallery` keeps its sections current.

## Files

```
catalog/
  registry.json          # which templates exist and where they're checked out
  schema/template.schema.json
  templates/<name>.json  # one manifest per template (generated + curated)
  index.json             # generated: flattened cross-template index + identifiers
  CATALOG.md             # generated: human-browsable screen catalog
  STYLES.md              # generated: style & pattern identifier reference
  fates.json             # fates / capabilities / archetypes definitions (editable)
  FATES.md               # generated: fates reference
  examples/              # example remix plans
  gallery/index.html     # generated: visual component library
registry/                # generated: shadcn-style installable items
  registry.json          # index of all items
  <template>/<item>.json # per-item: files, dependencies, registryDependencies, props
scripts/catalog/
  scan.mjs   style.mjs   fates.mjs   build-index.mjs   registry-build.mjs
  search.mjs   pull.mjs   remix.mjs   check.mjs   add.mjs   onboard.mjs   gallery.mjs
```

All scripts are dependency-free Node ESM — they run against any checkout
without installing anything.

## Workflow: idea → app

### 1. Describe the idea

```bash
pnpm catalog:remix suggest "dog walking marketplace with booking, payments and chat" --out plan.json
```

This scores the idea against every template and screen (with domain synonym
expansion: "booking" also matches reservations/checkout/calendar…), picks the
best-matching template as the **base** (its layout + design system), and
composes a plan of matching screens — cross-template when another template has
a better screen (e.g. Luna's `ai-voice` into a Caloria-based fitness coach).

### 2. Browse and refine

```bash
pnpm catalog:search checkout payment            # free-text across all templates
pnpm catalog:search --category auth --styling nativewind
pnpm catalog:search --component DriveMap --json # which screens use a component
```

Or read [`CATALOG.md`](./CATALOG.md) — all screens grouped by category.
Edit `plan.json` freely: swap screens, add `as` to rename a route, change the
base, add variants.

### 3. Try variations before building

A plan carries named `variants` (add/remove screen sets). Compare them without
writing anything:

```bash
pnpm catalog:remix diff plan.json --variants base,lean
pnpm catalog:remix apply plan.json --to ../try-base --variant base --dry-run
pnpm catalog:remix apply plan.json --to ../try-lean --variant lean --dry-run
```

Materialize competing variants into separate directories to compare for real,
then keep the winner.

### 4. Build it

```bash
pnpm catalog:remix apply plan.json --to ../my-app
```

`apply` copies, per selected screen, the **transitive local dependency
closure** — the screen file, every component/context/hook/util/data module it
imports, and the image assets it references — plus the base template's layout
and design/theme files. It never overwrites an existing file unless `--force`,
so shared components (Button, ThemedText…) land once and are reused by later
screens. It finishes by writing a `REMIX.md` provenance report into the target:
which layer came from which template, and the npm packages you still need to
install.

You can also cherry-pick a single screen at any time:

```bash
pnpm catalog:pull --template evento --screen app/screens/event-detail.tsx --to ../my-app --dry-run
```

## Keeping the catalog fresh

```bash
pnpm catalog:scan          # rescan every registered template (scan.mjs --all)
pnpm catalog:index         # rebuild index.json + CATALOG.md
```

- **Add a template**: add an entry to `registry.json` (external repos are
  expected as sibling checkouts of this repo), then run the two commands above.
  That's the whole expansion story — the catalog grows one JSON line at a time.
- **Curate**: `title`, `description`, `idea`, `tags` at the top of a manifest,
  and per-screen overrides under `curation` (keyed by screen path), survive
  rescans. Everything else is regenerated.
- **Self-describing repos**: external template repos carry their own
  `template.json` (generated with
  `node scripts/catalog/scan.mjs ../drivo --repo ExpoStartup/drivo`), so any
  consumer can read a template's screen inventory without this monorepo.

## Notes & limits

- Cross-template pulls copy each template's own components. Two templates may
  both ship a `Button.tsx` with different styling — first write wins, later
  screens reuse it. Check the target's `components/` after a heavily mixed
  remix; the `REMIX.md` report lists provenance to make this auditable.
- Screens are copied verbatim: imports keep working because all templates share
  the `@/*` → project-root alias, but visual coherence across templates comes
  from the design layer you chose — expect to tweak.
- The shared `@jv/ui` / `@jv/forms` / `@jv/tokens` packages (see
  `apps/showcase` for the component demo catalog) are the long-term home for
  deduplicated elements; `pnpm codemod <appDir> --apply` migrates a pulled
  app's local primitives onto them.
