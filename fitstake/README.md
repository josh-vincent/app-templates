# FitStake

Stake (virtual) money on your fitness goals. Hit your step targets and keep
your stake. Miss them and your stake forfeits into a shared **jackpot pool**
that finishers split.

Steps are verified through Apple Health / HealthKit so they can't be faked from
inside the app.

## Status

Early scaffold. Money is **virtual** (no real cash in/out yet). Backend is
Convex with realtime queries for live jackpot growth.

**v0 testing mode**: auth is bypassed — the app auto-signs-in anonymously on
first launch and you boot straight into the tabs. From Profile you can
upgrade to Apple sign-in (when configured). To reset and start fresh, hit
"Reset dev session" in Profile.

## Stack

- **Expo Router** (RN 0.83, React 19)
- **NativeWind** for styling
- **Convex** for users, challenges, wagers, jackpot pools, transactions
- **Convex Auth** (anonymous + Apple)
- **react-native-health** for Apple Health step verification (iOS only for now)
- **TanStack Query** for client-side caching of Health data
- **Bun** as package manager

## Prerequisites

- Node 20
- iOS Simulator (Xcode 15+) for build; **physical iPhone** for real step data
  (the simulator doesn't surface HealthKit data)
- Bun (`curl -fsSL https://bun.sh/install | bash`)
- A free Convex account (`https://convex.dev`)

## Setup (local Convex backend, no cloud account needed)

```bash
bun install
cp .env.example .env

# In one terminal: start a fully local Convex backend. First run downloads
# the local-backend binary; subsequent runs are instant.
bun run convex:dev:local
# When it prints `Convex functions ready! ...` it'll show a URL like
# http://127.0.0.1:3210. Put that in .env as EXPO_PUBLIC_CONVEX_URL.

# In another terminal:
bun run prebuild
bun run ios:dev
bun run start:dev-client
```

If you'd rather use a free cloud dev deployment (auto-syncs to convex.dev,
no Docker/binary download), swap `convex:dev:local` for `convex:dev`.

### LAN access (physical device, second simulator, second Mac)

The local backend already binds to `0.0.0.0` on ports `3210` and `3211`, so
it's reachable from anything on your LAN. You don't need to edit `.env.local`
or run a proxy: `lib/convexUrl.ts` rewrites the `127.0.0.1` host to whatever
host Metro served the JS bundle from. That host is your Mac's LAN IP on a
physical device or remote sim, and stays as `localhost` on a same-host sim.
The chosen URL is logged once at startup:

```
LOG  [convex] using http://192.168.1.161:3210
```

If `bun run start:dev-client` shows a LAN URL (e.g. `exp://192.168.1.x:8081`),
LAN devices are good to go. If it shows `exp://localhost:8081`, run with
`--host lan` or `--tunnel` so the bundle ships from the LAN host.

For networks where LAN broadcast is blocked (some coffee-shop wifi),
`npx expo start --tunnel` gets you a public ngrok-style URL for both Metro
and Convex.

## App structure

- `app/(auth)/sign-in.tsx` — Apple + anonymous sign-in
- `app/(tabs)/(home)/index.tsx` — Today dashboard (steps, active wagers, peek at jackpot)
- `app/(tabs)/challenges/` — Browse, detail, create
- `app/(tabs)/jackpot.tsx` — Current jackpot pool, your share if eligible
- `app/(tabs)/wallet.tsx` — Virtual balance + transaction history
- `app/(tabs)/profile.tsx` — Account, Health permission status, sign out

## Convex schema (high level)

- `users` — auth identity + wallet balance + lifetime stats
- `challenges` — step goal, duration, stake amount, jackpot pool fk
- `participants` — user ↔ challenge with stake + final step count
- `stepEntries` — daily steps submitted from HealthKit
- `jackpotPools` — per-period prize pot funded by forfeits
- `transactions` — append-only ledger

Daily cron at midnight UTC settles completed challenges:
- Finishers get stake back + share of forfeited stakes from losers
- Unfinished participants forfeit stake to next period's jackpot

## Production wiring (what's live)

### HealthKit → Convex step bridge

`app/hooks/useStepSubmitter.tsx` runs at the app root inside the
`QueryClientProvider`. It watches the current step count and the user's
active step bets; whenever steps tick up by ≥ 250 OR 60s pass since the
last write, it calls `api.steps.submitDaily` for each step-tracked bet.
AsyncStorage caches the last-submitted value per bet so reloads don't
re-submit aggressively.

Without this hook, `convex/settle.ts:dailySettlement` reads an empty
`stepEntries` table on each hourly tick and every step bet silently
forfeits — so this is a P0 dependency between the client and the bet
engine.

### Reminder cron

`convex/reminders.ts:scheduleDueReminders` runs every 15 min (see
`convex/crons.ts`). For each active participant it:

1. Loads their `profile.notifyLeadHours` (or the smart default from
   `lib/notifyDefaults.ts` based on `challenge.durationDays`)
2. Checks whether `now` falls inside any unfired lead-hour window
   (with a 4× catch-up tolerance for missed cron ticks)
3. Calls `schedulePushForUsers` to fan the push out
4. Records the fire in `reminderFires` so it doesn't re-send

Mute-all path: setting `profile.notifyLeadHours = []` from
Profile → REMINDERS → "Mute all" skips the user entirely.

### Settlement

`convex/settle.ts:dailySettlement` runs hourly. Reads `stepEntries` for
each running challenge whose `endsAt < now`, calls `participantFinished()`
per row, refunds finishers + forfeits losers + grows the jackpot pool.

### Push notification delivery

`convex/notifications.ts:schedulePushForUsers` resolves per-profile tokens
honoring `profile.pushEnabled`, then schedules `internal.notifications.sendPush`
which POSTs to Expo's push relay. Dead tokens (`DeviceNotRegistered`) are
auto-purged.

## Onboarding

4-step gate at `app/index.tsx` redirects new users to
`/onboarding/welcome` → `/health` → `/notifications` → `/first-bet`.
The first-bet step calls `api.users.completeOnboarding` and forwards to
either the bet-create screen or Today. Dev personas (Josh/Jeff) bypass
the gate entirely.

## Android (Health Connect)

`app.json` declares the Health Connect permissions
(`ACTIVITY_RECOGNITION`, `health.READ_STEPS`, `health.READ_DISTANCE`,
`health.READ_EXERCISE`). `lib/health.ts` lazy-loads
`react-native-health-connect` on Android via `Platform.OS` dispatch so
the iOS bundle doesn't touch it.

To finish wiring on Android:

```bash
bun run prebuild --platform android
bun run android  # requires Android SDK + emulator or device
```

Smoke-test checklist:

- Cold launch → onboarding → /health permission sheet renders the
  Health Connect bottom-sheet (Android 14+) or system dialog (≤ 13)
- Granting "Steps" lets the Today hero render real values
- A step bet that goes inactive triggers `submitDaily` per the bridge
  hook (verify in Convex log)

## Social mechanics

### Pokes / floating-emoji nudges

`convex/pokes.ts` exposes `sendPoke({ toUserId, emoji })`,
`myInbox()`, and `markSeen({ id })`. Sending is friendship-gated and
fires a push notification carrying `{ kind: 'poke', emoji, fromName }`
alongside the row.

The recipient's app subscribes to `myInbox` reactively. When a row
arrives, `components/modals/PokeBurst.tsx` animates the emoji from
the bottom of the screen upward (1.7s, springy scale + fade) and calls
`markSeen` on completion. Multiple unseen pokes play back-to-back as
soon as the previous one finishes.

Send from `/friends/[id]` — the POKE row right under the hero — with
five stock emojis (👋 🔥 💪 🏃 🎯).

### Invite links + referral

`fitstake://join/<username>` opens `/join/[ref]` which calls
`users.claimReferral` — one-shot, immutable, self-reference rejected.
The landing page snapshots the inviter's lifetime stats so the joiner
sees who's waiting for them.

Friends list "Invite link" button auto-includes the current user's
`@username` so signups are credited automatically.

`app/+native-intent.tsx` also handles `fitstake://bet/<id>` for h2h
invite shares — taps land directly on the bet detail.

### Activity suggestions on first bet

Onboarding step 4 (`/onboarding/first-bet`) reads the last 30 days
of HealthKit history via `app/hooks/useHealthHistory.tsx` and runs
the pure heuristics in `lib/activitySuggestions.ts` to produce 2–3
right-sized starter bets. Each card shows the activity icon, goal,
stake, duration, and a one-liner reason ("You averaged 8,400 — aim
slightly higher.").

Tapping a card prefills `/(tabs)/challenges/create` with the
activity/goal/stake/days as search params so the user is one step
from confirming.

### Background HealthKit observer

`lib/health.ts:setupBackgroundDelivery + startStepObserver` register
an iOS HKObserverQuery + immediate background-delivery on `StepCount`.
On each tick we invalidate the react-query cache for today's steps,
which causes `useStepSubmitter` to re-evaluate and push the new count
to Convex — even with the app backgrounded.

(Android Health Connect doesn't support silent background delivery
without a foreground service. Out of scope this turn.)

## EAS Updates + production builds

`eas.json` defines four build profiles:

- `development` — dev-client for a physical device (channel `development`)
- `development-simulator` — dev-client for the iOS sim (channel `development`)
- `preview` — internal-distribution build for TestFlight reviewers (channel `preview`)
- `production` — App Store build (channel `production`, auto-increments build number)

`app.json` has `updates.enabled: true` with `checkAutomatically: ON_LOAD`
so installed builds pull a fresh JS bundle on launch when one is
published. **The `updates.url` is a placeholder until `eas init` runs and
prints the real project ID** — run that once per project owner:

```bash
bun run eas:init
```

That writes the project ID into `app.json` and lets `eas update` resolve.

Publishing JS-only changes (no native rebuild needed):

```bash
bun run eas:update:preview      # ships to internal testers
bun run eas:update:production   # ships to App Store users on the current binary
```

Cutting a new build (when native deps change):

```bash
bun run eas:build:preview       # internal TestFlight build
bun run eas:testflight          # production build + auto-submit to TestFlight
```

The `runtimeVersion: { policy: 'appVersion' }` setting binds each update to
the binary's `app.json.version` — so a `0.1.0` update only delivers to
`0.1.0` builds. Bump `version` whenever the native side changes; keep it
fixed when shipping JS-only fixes.

## Followups (out of scope for v0)

- Real payments (Apple IAP consumables to fund virtual balance)
- iOS Widget showing live jackpot
- App Store / TestFlight pipeline (needs new EAS project + ASC app record)
- Universal links + Apple App Site Association file for production
  deep linking
- Android background HealthConnect via foreground service
