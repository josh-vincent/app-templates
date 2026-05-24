# Voyage

Flight-booking travel app with an AI assistant.

- **Flights**: [Duffel](https://duffel.com) — real search + test-mode bookings (sandbox is free, live bookings are pay-per-order)
- **AI**: [Vercel AI Gateway](https://vercel.com/ai-gateway) via `ai` SDK v5 (model is env-configurable; dev/test defaults to a cheaper model) with tool-calls for `searchFlights`, `getOffer`, `trackPrice`, `planItinerary`
- **Alerts**: `expo-notifications` local notifications when tracked-route prices drop
- **Base**: forked from [`ExpoStartup/propia`](https://github.com/ExpoStartup/propia), then gutted

## Prerequisites

- Node 20
- iOS Simulator (Xcode) or Android emulator
- A **Duffel** test-access token (free) — `https://duffel.com` -> Developers
- A **Vercel AI Gateway** API key — `https://vercel.com/ai-gateway`

## Setup

```bash
bun install
cp .env.example .env
# edit .env with your two keys
bun run ios:dev
bun run start:dev-client
```

AI model selection:

- `AI_GATEWAY_MODEL`: explicit override in any environment (e.g. `anthropic/claude-sonnet-4`).
- `AI_GATEWAY_TEST_MODEL`: development/test fallback when `AI_GATEWAY_MODEL` is not set (default `openai/gpt-4.1-mini`).

For this project, prefer a development build over Expo Go. Build the iOS dev client once with `bun run ios:dev`, then run Metro with `bun run start:dev-client`.

## How it works

- `app/api/*+api.ts` — Expo Router API routes run on the Metro dev server. They hold `DUFFEL_ACCESS_TOKEN` and `AI_GATEWAY_API_KEY` so keys never reach the device.
- `app/(tabs)/(home)/index.tsx` — flight search + results (Duffel offers).
- `app/(tabs)/chat.tsx` — AI assistant with streaming + inline flight cards.
- `app/(tabs)/favorites.tsx` — tracked routes. Re-polled on app foreground.
- `app/(tabs)/trips.tsx` — created Duffel orders.

## EAS / TestFlight

Local Metro API routes are not reachable from a TestFlight build. Before building for EAS, deploy the Expo Router API routes and point the native app at that hosted URL.

1. Create production secrets for the hosted API routes:
   ```bash
   eas env:create --environment production --name DUFFEL_ACCESS_TOKEN --value duffel_test_...
   eas env:create --environment production --name AI_GATEWAY_API_KEY --value vck_...
   ```
2. Deploy the Expo Router API routes:
   ```bash
   eas deploy --environment production
   ```
3. Set the public API base URL used by the native app:
   ```bash
   eas env:create --environment production --name EXPO_PUBLIC_API_BASE_URL --value https://<your-deployment-host>
   ```
4. Create the iOS app record in App Store Connect for bundle id `com.tocld.voyage`.
5. Build and auto-submit to TestFlight:
   ```bash
   bun run eas:testflight
   ```

If you only want to create the build without submitting, use `bun run eas:build:ios`. To submit an existing build later, use `bun run eas:submit:ios`.

## Testing

On a physical device, either connect to the same LAN as your dev server or use `npx expo start --tunnel`.

The Duffel sandbox accepts real-shaped passenger data and returns real-shaped orders — no credit card needed (payment type `balance`).
