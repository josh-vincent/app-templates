/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as challenges from "../challenges.js";
import type * as crons from "../crons.js";
import type * as friendEvents from "../friendEvents.js";
import type * as friends from "../friends.js";
import type * as home from "../home.js";
import type * as http from "../http.js";
import type * as iap from "../iap.js";
import type * as iapHttp from "../iapHttp.js";
import type * as iapSkus from "../iapSkus.js";
import type * as jackpot from "../jackpot.js";
import type * as jackpotTiers from "../jackpotTiers.js";
import type * as lib_whatsLeft from "../lib/whatsLeft.js";
import type * as location from "../location.js";
import type * as notifications from "../notifications.js";
import type * as pokes from "../pokes.js";
import type * as proofs from "../proofs.js";
import type * as reminders from "../reminders.js";
import type * as seed from "../seed.js";
import type * as settle from "../settle.js";
import type * as steps from "../steps.js";
import type * as users from "../users.js";
import type * as wallet from "../wallet.js";
import type * as watches from "../watches.js";
import type * as widgetSnapshot from "../widgetSnapshot.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  challenges: typeof challenges;
  crons: typeof crons;
  friendEvents: typeof friendEvents;
  friends: typeof friends;
  home: typeof home;
  http: typeof http;
  iap: typeof iap;
  iapHttp: typeof iapHttp;
  iapSkus: typeof iapSkus;
  jackpot: typeof jackpot;
  jackpotTiers: typeof jackpotTiers;
  "lib/whatsLeft": typeof lib_whatsLeft;
  location: typeof location;
  notifications: typeof notifications;
  pokes: typeof pokes;
  proofs: typeof proofs;
  reminders: typeof reminders;
  seed: typeof seed;
  settle: typeof settle;
  steps: typeof steps;
  users: typeof users;
  wallet: typeof wallet;
  watches: typeof watches;
  widgetSnapshot: typeof widgetSnapshot;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
