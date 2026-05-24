import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Convex Auth tables — owns the `users` table. Do not redefine.
  ...authTables,

  // App-side per-user data. One row per authenticated Convex Auth user.
  profiles: defineTable({
    // userId is the Convex Auth user id when present. Optional so a dev
    // fallback profile can exist without a real auth session (v0 testing).
    userId: v.optional(v.id('users')),
    displayName: v.optional(v.string()),
    // Stable handle for friend search. Lowercase, [a-z0-9_], 3-20.
    // Optional during the migration window; the onboarding flow blocks
    // until it's claimed.
    username: v.optional(v.string()),
    walletBalance: v.number(),
    totalWon: v.number(),
    totalForfeited: v.number(),
    createdAt: v.number(),
    // Push: opt-out toggle. Defaults to enabled (true) when undefined so
    // newly-installed users get pushes by default. Explicit false suppresses
    // all sends server-side regardless of registered tokens.
    pushEnabled: v.optional(v.boolean()),
    // Custom lead-time overrides for bet-end reminders (hours before endsAt).
    // When null/undefined the cron uses defaultLeadHoursForDuration from
    // lib/notifyDefaults.ts based on each bet's duration bucket.
    notifyLeadHours: v.optional(v.array(v.number())),
    // ISO-3166 alpha-2 country code, used to scope regional jackpot pools.
    countryCode: v.optional(v.string()),
    // Dev-only fixed persona key (e.g. 'josh', 'jeff'). When the client
    // passes personaKey on a call, ensureProfile looks up this row instead
    // of the auth-backed profile, so two simulators can act as two users
    // without needing real auth identities.
    personaKey: v.optional(v.string()),
    // Set once the user has finished the onboarding flow (Welcome → Health
    // permission → Notification permission → first bet). Onboarding gate in
    // app/index.tsx redirects to /onboarding/welcome until this is true.
    onboardingComplete: v.optional(v.boolean()),
    // Set once when claimed via a healthpulse://join/<username> deep link.
    // Immutable after first claim — see users.claimReferral.
    referredBy: v.optional(v.id('profiles')),
    // Default destination for stake forfeits. 'friends' feeds the
    // friend-of-subject pool; 'region' feeds the country pool; 'global'
    // feeds the world pool. When unset, the resolver picks the most
    // specific available (friends if I have any, then region if I have a
    // countryCode, then global). Users can override in Profile.
    forfeitDestination: v.optional(
      v.union(v.literal('friends'), v.literal('region'), v.literal('global'))
    ),
    // Per-profile opt-out for the friend-activity event stream (push only;
    // the in-app feed still renders regardless). Defaults to enabled when
    // undefined, same shape as `pushEnabled`.
    friendActivityPushEnabled: v.optional(v.boolean()),
  })
    .index('by_userId', ['userId'])
    .index('by_username', ['username'])
    .index('by_persona', ['personaKey']),

  // One row per device per profile. installationId comes from
  // expo-application so re-installs / OS updates don't fragment.
  pushTokens: defineTable({
    userId: v.id('profiles'),
    token: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android')),
    installationId: v.string(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_token', ['token'])
    .index('by_installation', ['installationId']),

  challenges: defineTable({
    creatorId: v.id('profiles'),
    title: v.string(),
    description: v.optional(v.string()),
    // Free-form key into lib/activities.ts ACTIVITY_REGISTRY. Optional for
    // backwards compat with pre-v2 rows; readers fall back to 'steps'.
    activityKey: v.optional(v.string()),
    // Generic numeric goal: count for steps, km for distance, sessions for
    // binary, etc. Per-activity meaning lives in the registry.
    // `stepGoal` retained as alias for older code paths still reading it.
    stepGoal: v.number(),
    stakeAmount: v.number(),
    durationDays: v.number(),
    startsAt: v.number(),
    endsAt: v.number(),
    status: v.union(v.literal('open'), v.literal('running'), v.literal('settled')),
    jackpotPoolId: v.optional(v.id('jackpotPools')),
    // v2/v3 bet shape.
    //   solo     — you vs the house; forfeits feed your chosen pool.
    //   h2h      — one-vs-one with an invited counterparty (same activity).
    //   market   — over/under against a numeric line; subject is the goal-doer.
    //   naysayer — friends-only "I bet you don't"; subject pledges, friends stake against.
    betShape: v.optional(
      v.union(
        v.literal('solo'),
        v.literal('h2h'),
        v.literal('market'),
        v.literal('naysayer')
      )
    ),
    marketLine: v.optional(v.number()),
    subjectUserId: v.optional(v.id('profiles')),
    // Where forfeits go on settle. 'global' is the default for back-compat.
    poolScope: v.optional(
      v.union(
        v.literal('global'),
        v.literal('region'),
        v.literal('friends')
      )
    ),
  })
    .index('by_status', ['status'])
    .index('by_creator', ['creatorId']),

  participants: defineTable({
    challengeId: v.id('challenges'),
    userId: v.id('profiles'),
    stakeAmount: v.number(),
    stakedAt: v.number(),
    status: v.union(
      v.literal('active'),
      v.literal('won'),
      v.literal('forfeit'),
      // 'pending' = invited but not yet accepted (h2h flow)
      v.literal('pending')
    ),
    finalSteps: v.optional(v.number()),
    // For market bets: which side this participant took.
    side: v.optional(v.union(v.literal('over'), v.literal('under'))),
    // For naysayer bets: 'subject' is the goal-doer, 'naysayer' is a friend
    // who staked the subject won't make it. Other shapes leave this null.
    role: v.optional(v.union(v.literal('subject'), v.literal('naysayer'))),
  })
    .index('by_challenge', ['challengeId'])
    .index('by_user', ['userId'])
    .index('by_user_status', ['userId', 'status']),

  // Submitter-trusted proof rows for non-sensor activities.
  // The participant uploads photo/GPS/scorecard; status starts 'submitted'.
  // Counterparty can flip to 'disputed' or 'acknowledged' (or auto-ack on
  // a timer outside this brief).
  //
  // Two GPS sources land here:
  //   gpsLat/Lng       — device fix at the moment of submission
  //   photoExifLat/Lng — coordinates extracted from the chosen photo's EXIF
  //                       (library uploads only; iOS strips GPS from camera
  //                       captures by design)
  // Mismatched sources are not an error — both are kept so disputes have the
  // full picture.
  proofs: defineTable({
    participantId: v.id('participants'),
    challengeId: v.id('challenges'),
    submittedAt: v.number(),
    // Legacy single-photo field. Kept for back-compat with rows submitted
    // before multi-photo proofs landed; new submissions also write into
    // imageStorageIds[0] so readers can ignore this.
    imageStorageId: v.optional(v.id('_storage')),
    // Multi-photo proof support. Order is the order the user picked them.
    // Empty / undefined means image-less (back-fill from background pings
    // or score-only).
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
    scorecardStorageId: v.optional(v.id('_storage')),
    gpsLat: v.optional(v.number()),
    gpsLng: v.optional(v.number()),
    photoExifLat: v.optional(v.number()),
    photoExifLng: v.optional(v.number()),
    // Epoch ms parsed from EXIF DateTimeOriginal so settle / dispute can
    // verify the photo was taken inside the bet window.
    photoTakenAt: v.optional(v.number()),
    // For score-based activities (golf strokes, tennis sets won).
    claimedValue: v.optional(v.number()),
    note: v.optional(v.string()),
    status: v.union(v.literal('submitted'), v.literal('acknowledged'), v.literal('disputed')),
    // Multi-session bets: which session (1..N) this check-in represents.
    // Together with forDate, lets settlement count distinct sessions toward
    // a "7 sessions over 7 days" style goal.
    sessionIndex: v.optional(v.number()),
    // Calendar day this check-in covers, ISO 'YYYY-MM-DD' in the user's
    // local clock at submit time. Used for de-dup and progress display.
    forDate: v.optional(v.string()),
    // True when the row was synthesised from locationPings (the user
    // forgot to check in but the background tracker has GPS evidence).
    // No photo; gpsLat/Lng are the centroid of that day's pings.
    derivedFromPings: v.optional(v.boolean()),
  })
    .index('by_participant', ['participantId'])
    .index('by_challenge', ['challengeId'])
    .index('by_participant_date', ['participantId', 'forDate']),

  // Background location pings recorded during a non-sensor bet's window.
  // Distance-gated client-side (~50m) to keep volume low. Used as
  // corroborating evidence when EXIF/photo proof is weak (stripped GPS,
  // user forgot to open the app at the location, etc).
  locationPings: defineTable({
    userId: v.id('profiles'),
    challengeId: v.id('challenges'),
    lat: v.number(),
    lng: v.number(),
    accuracy: v.number(),
    recordedAt: v.number(),
    source: v.union(v.literal('background'), v.literal('foreground')),
  })
    .index('by_user_challenge', ['userId', 'challengeId'])
    .index('by_user_recorded', ['userId', 'recordedAt']),

  // Bare friends graph: a one-row-per-direction record; bi-directional is
  // a pair of rows. Enough to power the v2 "friends-first" invite flow.
  friendships: defineTable({
    fromUserId: v.id('profiles'),
    toUserId: v.id('profiles'),
    createdAt: v.number(),
  })
    .index('by_from', ['fromUserId'])
    .index('by_to', ['toUserId']),

  stepEntries: defineTable({
    userId: v.id('profiles'),
    challengeId: v.id('challenges'),
    date: v.string(),
    steps: v.number(),
    submittedAt: v.number(),
    source: v.string(),
  })
    .index('by_user_date', ['userId', 'date'])
    .index('by_challenge_date', ['challengeId', 'date']),

  jackpotPools: defineTable({
    period: v.string(),
    // v3 scope axis: where this pool draws from.
    //   global         — everyone (scopeKey = 'global')
    //   region         — country code (scopeKey = ISO alpha-2)
    //   friends        — friends-of (scopeKey = profileId of pool owner)
    // Optional during migration; old rows are treated as global.
    scope: v.optional(
      v.union(
        v.literal('global'),
        v.literal('region'),
        v.literal('friends')
      )
    ),
    scopeKey: v.optional(v.string()),
    // v4 tier axis: difficulty grouping. Determined by the forfeiting
    // bet's stake (tierFromStake in jackpotTiers.ts). Eligibility to win
    // a share is gated on the user's settled-bet count (eligibleTiersFor).
    // Optional during migration; old rows are treated as 'medium'.
    tier: v.optional(
      v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))
    ),
    total: v.number(),
    status: v.union(v.literal('open'), v.literal('settled')),
    settledAt: v.optional(v.number()),
    settlesAt: v.number(),
    winnerCount: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_scope', ['scope', 'scopeKey', 'status'])
    .index('by_scope_tier', ['scope', 'scopeKey', 'tier', 'status']),

  // Forfeit-into-pool ledger. Used to determine eligibility for share —
  // a user qualifies for a pool's payout only if they contributed at least
  // one forfeit during the pool's open period.
  poolContributions: defineTable({
    poolId: v.id('jackpotPools'),
    userId: v.id('profiles'),
    amount: v.number(),
    at: v.number(),
  })
    .index('by_pool', ['poolId'])
    .index('by_user', ['userId']),

  // Subscription rows. fireDue cron checks each unfired row's target end
  // time and pushes when it's within alertMinutesBefore of the deadline.
  watches: defineTable({
    userId: v.id('profiles'),
    targetKind: v.union(v.literal('pool'), v.literal('bet')),
    poolId: v.optional(v.id('jackpotPools')),
    challengeId: v.optional(v.id('challenges')),
    alertMinutesBefore: v.number(),
    fired: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_pool', ['poolId'])
    .index('by_challenge', ['challengeId']),

  transactions: defineTable({
    userId: v.id('profiles'),
    type: v.union(
      v.literal('topup'),
      v.literal('stake'),
      v.literal('refund'),
      v.literal('forfeit'),
      v.literal('jackpotWin')
    ),
    amount: v.number(),
    ref: v.optional(v.string()),
    // Explicit timestamp for display. Lets seed data backdate entries since
    // _creationTime is set by Convex and not overridable.
    at: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_ref', ['ref']),

  // One row per (participant, leadHoursIndex) pair the reminders cron has
  // already fired for. Lets the cron be idempotent: it can run every 15min
  // without spamming the user. Keyed by participantId + index so even a
  // schema change to leadHours (e.g. user toggles smart defaults → custom)
  // doesn't re-fire previously-sent reminders.
  reminderFires: defineTable({
    participantId: v.id('participants'),
    leadHoursIndex: v.number(),
    leadHours: v.number(),
    firedAt: v.number(),
  }).index('by_participant', ['participantId']),

  // Sub-second social ping. One row per emoji flung at a friend.
  // sendPoke validates friendship; the recipient sees a floating-emoji
  // burst the next time the app is foregrounded, and a push if not.
  // seenAt is set when the burst overlay animates the row → keeps it
  // from re-firing on every reload.
  pokes: defineTable({
    fromUserId: v.id('profiles'),
    toUserId: v.id('profiles'),
    emoji: v.string(),
    createdAt: v.number(),
    seenAt: v.optional(v.number()),
  }).index('by_to_user', ['toUserId', 'createdAt']),

  // Progress-driven friend activity stream. One row per (event, viewer) so
  // the by_viewer_created index is a plain single-key lookup — Convex array
  // indexes are avoided here to keep query semantics obvious. `eventGroupId`
  // ties together all viewer rows produced by the same emit call so the feed
  // can deduplicate / batch them client-side if needed.
  //
  // TODO(visibility): stakes are currently fully-public-to-friends. When
  // per-stake visibility lands, add `challenges.visibility` and filter at
  // emit-time so private stakes never produce friendEvents rows.
  friendEvents: defineTable({
    actorUserId: v.id('profiles'),
    viewerUserId: v.id('profiles'),
    eventGroupId: v.string(),
    challengeId: v.optional(v.id('challenges')),
    participantId: v.optional(v.id('participants')),
    kind: v.union(
      v.literal('stake_started'),
      v.literal('session_completed'),
      v.literal('at_risk'),
      v.literal('just_won'),
      v.literal('just_forfeited'),
      v.literal('time_running_out'),
      v.literal('h2h_invite'),
      v.literal('h2h_overtaken')
    ),
    // Small payload for feed rendering — actor display name snapshot,
    // stake title/amount, progress snapshot, hoursLeft, etc. Frozen at
    // emit time so feed reads don't re-resolve linked rows.
    payload: v.any(),
    createdAt: v.number(),
    // Set when the viewer has rendered this row in the feed (parity with
    // pokes.seenAt). Unset = unread, used for the tab badge.
    seenAt: v.optional(v.number()),
  })
    .index('by_viewer_created', ['viewerUserId', 'createdAt'])
    .index('by_actor', ['actorUserId'])
    .index('by_challenge', ['challengeId'])
    .index('by_event_group', ['eventGroupId']),

  // Per-(viewer, challenge, kind) latch that throttles repeat events
  // (e.g. at_risk fires once per stake per viewer, not every cron pass).
  // Latch keys for daily events embed the YYYY-MM-DD in `kind`.
  friendEventLatches: defineTable({
    viewerUserId: v.id('profiles'),
    challengeId: v.id('challenges'),
    kind: v.string(),
    firedAt: v.number(),
  }).index('by_viewer_challenge_kind', ['viewerUserId', 'challengeId', 'kind']),
});
