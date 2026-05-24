# Voyage — Manual Test Guide

End-to-end verification plan for the Duffel + AI Gateway travel app on iOS simulator.

## Prerequisites

1. `.env` at project root with:
   ```
   DUFFEL_ACCESS_TOKEN=duffel_test_...
   AI_GATEWAY_API_KEY=vck_...
   ```
2. Xcode + iOS 26 simulator runtime installed.
3. `npm install --legacy-peer-deps` has completed cleanly.
4. Native project regenerated: `npx expo prebuild --clean --platform ios`.

## Boot

```bash
npx expo run:ios --device <sim-udid>
```

Wait for "BUILD SUCCEEDED" + Metro bundler line `Bundled … Voyage (iOS)`. App auto-launches.

If you need to relaunch without rebuilding:
```bash
xcrun simctl launch <sim-udid> com.tocld.voyage
```

## API sanity checks (before UI testing)

With Metro running on `http://localhost:8081`:

```bash
# Flight search
curl -sS -X POST http://localhost:8081/api/flights/search \
  -H 'content-type: application/json' \
  -d '{"origin":"JFK","destination":"LAX","departureDate":"2026-05-01","passengers":1,"cabin":"economy"}' | jq '.offers | length'

# Offer detail (id from search response)
curl -sS -X POST http://localhost:8081/api/flights/offer \
  -H 'content-type: application/json' \
  -d '{"id":"off_..."}' | jq '.offer.id'

# Chat streaming
curl -sS -N -X POST http://localhost:8081/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","parts":[{"type":"text","text":"hi"}]}]}' | head -20
```

Expected: search returns a positive offer count, offer returns the same id, chat streams SSE lines with `data:` frames.

## TestFlight prerequisite

For EAS/TestFlight builds, `localhost:8081` is invalid. Set `EXPO_PUBLIC_API_BASE_URL` to your deployed Expo API routes host and verify these same endpoints against that hosted base URL before distributing the build.

## Flow A — Manual flight booking

1. Home tab → tap the search bar ("Where to?").
2. In "Where" sheet, tap "To" field, type `LAX`, tap the `LAX — Los Angeles` result. "From" defaults to JFK.
3. Tap "When", pick a departure date roughly 2 weeks out.
4. Leave passengers at 1 adult, cabin Economy. Tap "Search".
5. Verify: a card list of offers renders (airline name, price, nonstop/stops).
6. Tap the first offer.
7. Offer detail screen shows: airline, total price, each slice with segments (departure/arrival airports and times).
8. Tap "Reserve".
9. Step 1 (Passenger): fill First name `TEST`, Last name `USER`, DOB `1990-01-01`, email `test@example.com`, phone `+15551234567`. Tap Next.
10. Step 2 (Review): verify slices + total. Tap Next.
11. Step 3 (Confirm): tap "Complete".
12. Expect redirect to order detail with Duffel booking reference (e.g. `HTHWHC`).
13. Trips tab → new booking is listed with reference and price.

## Flow B — AI assistant

1. Chat tab.
2. Tap a quick prompt (e.g. "Cheapest NYC → Tokyo next month for 2 adults") or type your own and tap Send.
3. Expect:
   - "Thinking…" indicator.
   - Streaming assistant text appears progressively.
   - If the assistant calls `searchFlights`, a "Calling searchFlights…" bubble appears, followed by a "Found N offers" block with tappable flight cards.
4. Tap a flight card → navigates to offer detail screen (Flow A from step 7 onward).

Known RN streaming caveat: React Native's built-in `fetch` does not expose a streaming `ReadableStream` body, so the AI SDK reports "The response body is empty." The fix is to route the `DefaultChatTransport` through `expo/fetch` (WinterCG-compatible, supports streaming):

```ts
import { fetch as expoFetch } from 'expo/fetch';
// …
transport: new DefaultChatTransport({
  api: api('/api/chat'),
  fetch: expoFetch as unknown as typeof fetch,
}),
```

## Flow C — Price tracking + notifications

1. Do Flow A steps 1–5 (produce an offer list).
2. From the offer list, tap the heart on an offer (or navigate via saved search).
3. Favorites tab → the tracked route is listed with last known price and a "Check now" button.
4. Background the app for ~5 seconds, foreground it.
5. The `AppState` listener re-polls `/api/flights/search`. If the lowest price is lower than stored, a local notification fires.
6. To force a drop deterministically, edit `@voyage/tracked` via the debugger to set a stored price above the current search result, then foreground. Expect immediate local notification.
7. Grant notification permission when prompted (first run only).

## Regression checklist (after SDK/dep upgrades)

- [ ] `npx expo-doctor` — 16/17+ checks pass (icon dimension warning is the only acceptable miss).
- [ ] Cold boot: `npx expo run:ios` → app launches without red-box.
- [ ] Home tab renders searchbar + any placeholder destinations.
- [ ] Metro "Bundled" line appears within 60s.
- [ ] Each tab navigates without crash: Home / Favorites / Trips / Chat / Profile.
- [ ] API routes: `/api/flights/search`, `/api/flights/offer`, `/api/flights/order`, `/api/chat` return expected shapes (see curl block above).
- [ ] Flow A passes end-to-end → reference code shown.
- [ ] Flow B: at least one assistant reply streams to completion.
- [ ] Flow C: tracked entry persists across app restarts.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/api/flights/offer` returns HTML | Ensure route is `app/api/flights/offer+api.ts` (POST with id in body), not a dynamic `[id]+api.ts` — catch-all HTML routes intercept GET. |
| Chat shows "response body is empty" | Use `expo/fetch` (not the built-in RN `fetch`) in the `DefaultChatTransport`. See "Known RN streaming caveat" above. |
| Duffel 401 | `.env` missing or has a placeholder — must be a real `duffel_test_...` token. |
| AI Gateway 401 | `AI_GATEWAY_API_KEY` missing; restart Metro after editing `.env`. |
| Pods out of sync after RN bump | `cd ios && pod install --repo-update` or `npx expo prebuild --clean`. |
| Metro won't resolve `react-native-worklets` | Required by `react-native-reanimated` v4 on SDK 54+ — reinstall with `--legacy-peer-deps`. |

## argent-driven automation (reference)

For repeatable simulator runs, use discovery-first tapping — never guess coordinates:

```
describe → find element frame → gesture-tap x/y (normalized 0..1)
```

Typical flow recorder: `flow-start-recording` → walk Flow A → `flow-finish-recording` → `flow-execute` to replay post-upgrade.
