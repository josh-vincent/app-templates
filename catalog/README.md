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

## Files

```
catalog/
  registry.json          # which templates exist and where they're checked out
  schema/template.schema.json
  templates/<name>.json  # one manifest per template (generated + curated)
  index.json             # generated: flattened cross-template index
  CATALOG.md             # generated: human-browsable catalog
  examples/              # example remix plans
scripts/catalog/
  scan.mjs   build-index.mjs   search.mjs   pull.mjs   remix.mjs
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
