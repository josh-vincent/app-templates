# app-templates

Monorepo of Expo/React Native app templates, shared `@jv/*` packages, and the
**mobile app factory** — a screen catalog that turns an idea into a working app
by remixing real, functional screens from proven templates.

## What's here

```
packages/            @jv/tokens · @jv/ui · @jv/forms · @jv/tailwind-preset (+ configs)
apps/showcase        Browsable demo gallery of every @jv component
catalog/             Mobile app factory: registry, manifests, index, remix plans
scripts/catalog/     scan / search / pull / remix tooling (dependency-free Node)
scripts/codemod-imports.ts   Migrate an app's local primitives → @jv/* packages

# Embedded templates
aurora/              Weather (Convex)
casino-app/          Casino games
expo-convex-template/ Convex starter (FitStake base, on @jv/*)
fitstake/            Step wagering (Convex + HealthKit, on @jv/*)
health-app/          Health tracker (Convex)
propia/              Property booking marketplace
travel-app/          Trips & saved places (Convex)
voyage/              Flight booking + AI assistant (Expo API routes + Duffel)
```

External template repos are registered in `catalog/registry.json` and expected
as sibling checkouts: `../caloria-v2`, `../drivo`, `../evento`, `../feedy`,
`../luna`, `../uniwind` (each also carries its own `template.json`).

## Mobile app factory

```bash
# 1. Describe an idea → get a remix plan
pnpm catalog:remix suggest "dog walking marketplace with booking and chat" --out plan.json

# 2. Browse / refine
pnpm catalog:search --category commerce
less catalog/CATALOG.md

# 3. Compare variations before building
pnpm catalog:remix diff plan.json --variants base,lean

# 4. Materialize the winner (screens + components + theme + assets + REMIX.md report)
pnpm catalog:remix apply plan.json --to ../my-app
```

Full guide: [`catalog/README.md`](./catalog/README.md) ·
Browsable index: [`catalog/CATALOG.md`](./catalog/CATALOG.md)

## Workspace commands

```bash
pnpm install
pnpm showcase          # run the component demo gallery
pnpm catalog           # regenerate the showcase component-demo catalog
pnpm catalog:scan      # rescan all templates → catalog/templates/*.json
pnpm catalog:index     # rebuild catalog/index.json + CATALOG.md
pnpm typecheck | lint | build
```
