# Expo + Convex Template

A working Expo Router + Convex mobile-app starter, bundled with a fully
fleshed-out example app (LuckyChips — virtual-money fitness wagers backed by
Apple Health / Health Connect). Clone this repo, run one setup script, and
you have a renamed project with auth, push, deep links, EAS, and a local
Convex backend already wired up.

> **What's "the template" vs. "the example"?**
> The plumbing — Expo Router stack, Convex Auth (anonymous + Apple),
> NativeWind, EAS build profiles, push notifications, deep-link handler,
> reminder cron, settle/poke/referral infrastructure — is meant to be
> kept and adapted. The fitness-specific surface (HealthKit reads, step
> entries, jackpot pools, RevenueCat IAP, wager schema) is bundled as a
> reference implementation. Delete the parts you don't want, or use them
> as worked examples while you build something different.

## Stack

- **Expo Router** (RN 0.83, React 19), typed routes off, NativeWind
- **Convex** (`convex/`) — schema, queries, mutations, actions, cron
- **Convex Auth** — anonymous + Apple sign-in scaffolded
- **EAS** — `development` / `development-simulator` / `preview` / `production` profiles
- **Push** — Expo notifications + per-user reminder scheduler
- **Deep links** — `<scheme>://join/<username>` and `<scheme>://bet/<id>` already routed
- **TanStack Query** — caches HealthKit reads in the example app
- **react-native-purchases** — RevenueCat scaffolded; remove if you don't need IAP
- **Bun** as package manager

## 0. Prerequisites

- Node 20
- [Bun](https://bun.sh/install) (`curl -fsSL https://bun.sh/install | bash`)
- Xcode 15+ (for iOS) and/or Android SDK + emulator
- Optional: a free [Convex](https://convex.dev) account, only if you want
  the cloud dev deployment instead of the local backend (the template
  defaults to local).

## 1. Rename the template into your project

```bash
# clone this repo into a new directory, then:
cd your-new-project
node scripts/init-from-template.mjs
# or, after `bun install`: bun run init-template
```

The script prompts for:

| Field | Example | Where it goes |
|---|---|---|
| Display name | `Acme Demo` | `app.json` `expo.name`, splash/permission strings |
| Code name | `AcmeDemo` | JS identifiers (`useAcmeProGate`, classes), constants |
| Slug | `acme-demo` | `app.json` `expo.slug`, `package.json` name |
| Bundle ID | `com.acme.demo` | iOS `bundleIdentifier`, Android `package` |
| URL scheme | `acmedemo` | `app.json` `expo.scheme`, deep-link prefix |
| EAS owner | `acme-team` (or blank) | `app.json` `expo.owner` |

It rewrites every occurrence of `LuckyChips` / `luckychips` / `LUCKYCHIPS` /
`com.tocld.luckychips` across `.ts`, `.tsx`, `.json`, `.md`, etc. It does
**not** touch `node_modules`, `ios/`, `android/`, `.git`, `.expo`, or
`.convex`.

Non-interactive form (CI-friendly):

```bash
node scripts/init-from-template.mjs \
  --name "Acme Demo" --code-name AcmeDemo \
  --slug acme-demo --bundle com.acme.demo --scheme acmedemo \
  --owner acme-team --yes
```

Preview-only mode (writes nothing):

```bash
node scripts/init-from-template.mjs --dry-run --yes \
  --name "Acme Demo" --code-name AcmeDemo --slug acme-demo \
  --bundle com.acme.demo --scheme acmedemo
```

The script refuses to run if `package.json` `name` is no longer
`luckychips` (i.e. it's already been renamed). If you forked the template
and want re-init to work on your fork, update the `TEMPLATE` block at
the top of `scripts/init-from-template.mjs`.

## 2. Install dependencies and set up Convex

```bash
bun install
cp .env.example .env

# In one terminal — start a fully local Convex backend (no cloud account
# needed). First run downloads the local-backend binary; subsequent runs
# are instant.
bun run convex:dev:local
# When it prints `Convex functions ready! ...` you'll see a URL like
# http://127.0.0.1:3210 — put that into .env as EXPO_PUBLIC_CONVEX_URL.
```

Prefer the cloud dev deployment? Swap for `bun run convex:dev` — auto-syncs
to convex.dev, no Docker/binary download.

## 3. Run the app

Native dirs (`ios/`, `android/`) are intentionally not checked in — the
template generates them via `expo prebuild` so they match your new bundle
ID/slug exactly.

```bash
# in another terminal
bun run prebuild
bun run ios:dev      # or: bun run android
bun run start:dev-client
```

### LAN access (physical device, second simulator, second Mac)

The local Convex backend binds to `0.0.0.0` on ports `3210`/`3211`, so
anything on your LAN can reach it. `lib/convexUrl.ts` rewrites the
`127.0.0.1` host to whatever host Metro served the JS from, so you don't
need to edit `.env.local` or run a proxy. The chosen URL is logged once
at startup:

```
LOG  [convex] using http://192.168.1.161:3210
```

If `bun run start:dev-client` shows `exp://localhost:8081`, restart with
`--host lan` or `--tunnel` so the bundle ships from the LAN host. For
networks where LAN broadcast is blocked, `npx expo start --tunnel` gets
you an ngrok-style URL for both Metro and Convex.

## What's in the box

```
app/                  Expo Router screens
  (auth)/sign-in.tsx       Apple + anonymous sign-in
  (tabs)/                  Tab-bar root
  onboarding/              4-step gated onboarding flow
  +native-intent.tsx       Deep-link router (join + bet share)
convex/                Convex backend
  schema.ts                Users, profiles, challenges, wagers, jackpot…
  auth.ts                  Convex Auth config
  crons.ts                 Daily settle + 15-min reminder ticks
  notifications.ts         Expo push relay
  reminders.ts             Per-profile lead-hour reminder scheduler
  iapHttp.ts / iapSkus.ts  RevenueCat webhook handler
components/            UI primitives + feature components
contexts/              React contexts (dev personas, themes, …)
lib/                   Helpers — convex URL, health, theme, suggestions
app.json               Expo config — permissions, plugins, EAS owner
eas.json               4 build profiles (dev / dev-sim / preview / prod)
scripts/
  init-from-template.mjs   This template's rename script (see §1)
  lan-env.mjs              Set EXPO_PUBLIC_CONVEX_URL to your LAN IP
```

## What lives in the example you might delete

If you don't need the fitness vertical, here's where to trim:

| You don't need… | Delete / strip |
|---|---|
| HealthKit / Health Connect | `lib/health.ts`, `app/onboarding/health.tsx`, `app/hooks/useStepSubmitter.tsx`, `app/hooks/useHealthHistory.tsx`, `react-native-health*` from `package.json`, all health-related plugins and `infoPlist` keys in `app.json` |
| Step bets / jackpots / wagers | `app/(tabs)/challenges/`, `app/(tabs)/jackpot.tsx`, `app/(tabs)/wallet.tsx`, `convex/challenges.ts`, `convex/wagers.ts`, `convex/jackpot*.ts`, `convex/settle.ts`, `convex/seed.ts` |
| Pokes / referrals | `convex/pokes.ts`, `convex/users.ts:claimReferral`, `components/modals/PokeBurst.tsx`, deep-link branches in `app/+native-intent.tsx` |
| RevenueCat IAP | `convex/iapHttp.ts`, `convex/iapSkus.ts`, `components/RevenueCatProvider.tsx`, `app/hooks/useLuckyChipsProGate.ts`, `react-native-purchases*` from `package.json`, `EXPO_PUBLIC_REVENUECAT_*` from `.env.example` |
| Location-based proof | `lib/locationTracking.ts`, location plugin block in `app.json`, location `infoPlist` keys |

Keep:

- `app/(auth)/sign-in.tsx` and `convex/auth.ts` — the auth scaffold
- `convex/notifications.ts`, `app/hooks/usePushNotifications.ts`,
  `convex/reminders.ts` if you want push at all
- `app/+native-intent.tsx` — but trim branches you don't use
- `lib/convexUrl.ts` — LAN-friendly Convex URL resolution
- `eas.json` build profiles
- `metro.config.cjs`, `babel.config.js`, `global.css`, `tailwind.config.js`

A more detailed walk-through of how the example is wired together lives
in [`PRODUCT.md`](./PRODUCT.md).

## Production wiring (already in place)

### Reminder cron

`convex/reminders.ts:scheduleDueReminders` runs every 15 min (see
`convex/crons.ts`). For each active participant it:

1. Loads `profile.notifyLeadHours` (or smart default from
   `lib/notifyDefaults.ts` keyed off `challenge.durationDays`)
2. Checks whether `now` falls in any unfired lead-hour window
   (4× catch-up tolerance for missed cron ticks)
3. Calls `schedulePushForUsers` to fan the push out
4. Records the fire in `reminderFires` to avoid re-sends

Mute-all path: setting `profile.notifyLeadHours = []` from the example's
Profile → REMINDERS → "Mute all" skips the user entirely.

### Push delivery

`convex/notifications.ts:schedulePushForUsers` resolves per-profile tokens
honouring `profile.pushEnabled`, then schedules
`internal.notifications.sendPush` which POSTs to Expo's push relay. Dead
tokens (`DeviceNotRegistered`) are auto-purged.

### Settlement (example app)

`convex/settle.ts:dailySettlement` runs hourly. Reads `stepEntries` for
each running challenge whose `endsAt < now`, calls `participantFinished()`
per row, refunds finishers + forfeits losers + grows the jackpot pool.

### HealthKit → Convex step bridge (example app)

`app/hooks/useStepSubmitter.tsx` runs at the app root inside the
`QueryClientProvider`. It watches the current step count and active step
bets; whenever steps tick up by ≥ 250 OR 60s pass since the last write,
it calls `api.steps.submitDaily` for each step-tracked bet. AsyncStorage
caches the last-submitted value so reloads don't re-submit aggressively.

## EAS Updates and production builds

`eas.json` defines four build profiles:

- `development` — dev-client for a physical device (channel `development`)
- `development-simulator` — dev-client for the iOS sim (channel `development`)
- `preview` — internal-distribution build for TestFlight reviewers (channel `preview`)
- `production` — App Store build (channel `production`, auto-increments build number)

`app.json` has `updates.enabled: true` with `checkAutomatically: ON_LOAD`,
so installed builds pull a fresh JS bundle on launch when one is published.
**The `updates.url` is a placeholder until `eas init` runs and prints the
real project ID** — run that once per project owner:

```bash
bun run eas:init
```

That writes the project ID into `app.json` and lets `eas update` resolve.

Publishing JS-only changes:

```bash
bun run eas:update:preview      # ships to internal testers
bun run eas:update:production   # ships to App Store users on the current binary
```

Cutting a new build:

```bash
bun run eas:build:preview       # internal TestFlight build
bun run eas:testflight          # production build + auto-submit to TestFlight
```

`runtimeVersion: { policy: 'appVersion' }` binds each update to the
binary's `app.json.version` — bump `version` whenever the native side
changes; keep it fixed when shipping JS-only fixes.

## License

MIT. The bundled LuckyChips example assets (icons, mascots) ship under the
same license — replace them with your own before publishing.
