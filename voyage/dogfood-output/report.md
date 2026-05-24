# Dogfood Report: Voyage

| Field | Value |
| --- | --- |
| **Date** | 2026-04-22 |
| **Platform** | iOS simulator |
| **Target App** | `com.tocld.voyage` |
| **Session** | `voyage-ios-iphone17` |
| **Scope** | Top-level tabs, assistant prompt flow, profile/settings, notifications |
| **Method** | Runtime-only QA on `Iphone 17`; no source inspection used for findings |

## Status After Fixes

Follow-up verification on the same simulator session confirms the major issues from the initial pass are fixed on the current branch:

- Search no longer exposes raw query/debug payloads and now falls back to product UI.
- Assistant quick prompts now submit, show progress, and return concierge results.
- Assistant/Profile utility controls now expose accessibility labels.
- Notifications content is now aligned to flights, fares, trips, and itinerary updates.
- Tracked and Trips empty states have been upgraded to match the app’s editorial travel brand more closely.
- The custom tab layout now survives a cold restart; `app/(tabs)/_layout.tsx` was updated to use `Tabs asChild`, which is required when wrapping `TabSlot`/`TabList` in a container view.

One additional local-dev issue was discovered and fixed during verification: the app was still falling back to `localhost:8081` for API calls even when the active Expo dev server was on `:8082`. That blocked assistant calls in the development build until `lib/apiBase.ts` was corrected to use the active dev-server port.

## Summary

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 3 |
| Medium | 2 |
| Low | 0 |
| **Total** | **5** |

## Screenshot Inventory

- `screenshots/search-error.png`
- `screenshots/tracked-empty.png`
- `screenshots/trips-empty.png`
- `screenshots/assistant-home.png`
- `screenshots/assistant-prompt-selected.png`
- `screenshots/profile-home.png`
- `screenshots/profile-settings.png`
- `screenshots/notifications-screen.png`
- `screenshots/settings-screen.png`

## Issues

The issues below are preserved as the original dogfood findings that drove the fixes above.

### ISSUE-001: Search tab exposes a raw error payload instead of results or recovery UI

| Field | Value |
| --- | --- |
| **Severity** | high |
| **Category** | functional / diagnostics |
| **Screen / Route** | Search tab |
| **Evidence** | `screenshots/search-error.png` |

**Description**

The core search surface renders a raw serialized query plus `data is undefined` in a peach error card. This looks like an internal query/debug string leaking to production UI. For a first-run user, the primary product promise appears broken immediately, with no retry or recovery affordance.

**Repro Steps**

1. Open Voyage on iOS.
2. Navigate to the Search tab.
3. Observe the JFK → LAX route card.
4. **Observe:** the main content area shows a raw payload string and `data is undefined` instead of results, empty state guidance, or a loading/retry flow.

### ISSUE-002: Assistant suggested prompt can be inserted but not submitted

| Field | Value |
| --- | --- |
| **Severity** | high |
| **Category** | functional |
| **Screen / Route** | Assistant tab |
| **Evidence** | `screenshots/assistant-home.png`, `screenshots/assistant-prompt-selected.png` |

**Description**

Tapping a suggested prompt changes the header and creates a dark prompt chip, but the conversation does not start. Tapping the send icon afterward produced no visible state change, no loading state, and no assistant response. This makes the most discoverable assistant entry point feel dead.

**Repro Steps**

1. Open the Assistant tab.
2. Tap `Cheapest NYC → Tokyo next month for 2 adults under $800`.
3. Tap the send icon in the composer area.
4. **Observe:** the screen remains unchanged; no message thread, progress indicator, or assistant output appears.

### ISSUE-003: Assistant and profile utility actions are unlabeled for accessibility

| Field | Value |
| --- | --- |
| **Severity** | medium |
| **Category** | accessibility / ux |
| **Screen / Route** | Assistant tab, Profile tab |
| **Evidence** | `screenshots/assistant-home.png`, `screenshots/profile-home.png` |

**Description**

Multiple icon-only controls are exposed as empty `AXGroup` elements with no label in the accessibility tree. This affected assistant top-right controls, the assistant send button, and the profile utility toggles. VoiceOver and switch-control users would not know what these buttons do.

**Repro Steps**

1. Open the Assistant tab and inspect the top-right controls / send icon.
2. Open the Profile tab and inspect the utility icons near the top-right.
3. Compare with labeled controls such as tab bar items and settings rows.
4. **Observe:** utility actions are visible but unlabeled in accessibility output.

### ISSUE-004: Notifications content is from the wrong product domain

| Field | Value |
| --- | --- |
| **Severity** | high |
| **Category** | content / ux |
| **Screen / Route** | Profile → Notifications |
| **Evidence** | `screenshots/notifications-screen.png` |

**Description**

The notifications screen contains lodging/host-style content such as `Beachfront Villa`, `check-in details`, `5-Star Review`, and `Payment Received`. This does not match Voyage’s flight/trip-shopping positioning. It reads like seeded content from a property-rental app and damages trust immediately.

**Repro Steps**

1. Open Profile.
2. Open `Notifications`.
3. Review the feed items and filter chips.
4. **Observe:** the feed describes villa bookings, guests, reviews, and host payouts instead of flight, fare, or itinerary events.

### ISSUE-005: Brand and system quality vary sharply between tabs

| Field | Value |
| --- | --- |
| **Severity** | medium |
| **Category** | visual / ux |
| **Screen / Route** | Cross-screen |
| **Evidence** | `screenshots/search-error.png`, `screenshots/tracked-empty.png`, `screenshots/trips-empty.png`, `screenshots/assistant-home.png`, `screenshots/profile-home.png` |

**Description**

Assistant and Profile feel like a premium editorial travel product, but Search, Tracked, and Trips feel much thinner and less intentional. The result is a product that changes tone and quality depending on the tab the user opens. That inconsistency makes the app feel unfinished even when individual screens are attractive.

**Repro Steps**

1. Compare Assistant and Profile against Search.
2. Compare the Tracked and Trips empty states against the richer Profile cards.
3. Compare the content model in Notifications against the core flight/trip positioning.
4. **Observe:** typography direction survives, but interaction quality, empty-state sophistication, and product voice do not.
