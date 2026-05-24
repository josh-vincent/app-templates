# Product Context (bundled example)

> **This is the product doc for the Aurora example app that ships with
> the template** — not your project's product doc. When the template's
> rename script runs, every occurrence of `Aurora` in this file is
> substituted with your code name, which makes the doc nonsense if your
> project isn't a fitness wager app. Either delete this file and write
> your own, or treat its post-rename state as a worked example of the
> shape a product context doc takes in this codebase.
>
> The example covers: a registry-driven activity system (`lib/activities.ts`),
> three coexisting bet shapes (solo / head-to-head / over-under), a
> sensor-vs-proof trust model, and a jackpot pool fed by forfeits.

## Design Context

### Register
product

### Users
Aurora users are people who already track activity (steps, runs, rides,
strength sessions, golf rounds, tennis matches) but struggle with
follow-through. They want skin in the game: a small stake on a short goal that
makes "I'll go tomorrow" cost something. From v2 onward they also want to bet
*against* friends — head-to-head and over/under markets where someone
on the other side cares about the outcome too. They are comfortable with
crypto/sports-betting UI patterns but expect the app to feel serious, not
slot-machine-y.

### Product Purpose
A fitness-wager app where any tracked activity becomes a stake. Three bet
shapes coexist: solo (you vs the house, forfeits feed the jackpot),
head-to-head (you vs an invited friend, 1:1 even money), and over/under
markets (anyone takes either side of a posted claim). Sensor activities settle
automatically via HealthKit / Health Connect; non-sensor activities settle on
submitter-trusted proof (photo + GPS, or scorecard + GPS) with after-the-fact
dispute.

### Brand Personality
Sharp, confident, lightly competitive. The interface should feel like a sports
sportsbook crossed with a fitness ring: bold but legible, never sleazy. Honest
about the wager: people lose money here, and the app should not hide that.

### Aesthetic Direction
- **Iron** dark base with **bone** light text. High-contrast.
- **Gold** for jackpot / prize moments. The one warm accent.
- **Lime** for on-track / wins. **Ember** for at-risk / forfeits / disputes.
- Big numbers. Big stakes. Big step / distance / score counts.
- Anti-reference: pastels, parchment-and-serif editorial travel UI, soft
  gradients for everything, fitness-tracker chrome, sportsbook neon-on-black.

### Design Principles
1. **Two things, always: outcome and dollars.** The activity-side number
   varies by bet (steps, km, sessions, score). The dollar side never varies.
   Both must be visible at a glance.
2. **Stakes are visible.** Don't hide what's at risk behind a tap.
3. **The data source decides the trust model.** Sensor-tracked activities
   settle automatically and surface live progress; non-sensor activities show
   proof state plainly (Awaiting / Submitted / Acknowledged / Disputed). The
   app shouldn't pretend a manual proof is a sensor reading.
4. **Counterparties are real.** When a friend or stranger is on the other
   side of a bet, name them, render their initials, surface their action
   state. A head-to-head bet without a "vs" feels like a solo bet.
5. **The jackpot is the spectacle.** Give it room. Don't card it.
6. **No fake gamification.** Confetti only when someone actually wins the
   jackpot. No streaks or badges or progress dopamine that isn't tied to
   real money outcomes.
7. **Activities scale by registry, not by branching.** Adding a sport means
   adding one entry to `lib/activities.ts`. Surfaces dispatch by goal-kind
   (count / distance / duration / binary / score) and proof-kind (sensor /
   photo / gps / scorecard). No screen should know the activity by name.
8. **Platform-agnostic from the start.** iOS uses HealthKit, Android uses
   Health Connect. The app surfaces "Health" not "Apple Health" outside
   the platform-specific permission flow.

### Vocabulary
- **Stake** — the noun for an active wager.
- **Bet** — the verb for placing one. The tab is named "Bets".
- **Bet shapes** — Solo, Head-to-head, Over/Under.
- **Proof** — what settles a non-sensor stake.
- **Pool** — the jackpot (forfeits from solo bets feed it).
