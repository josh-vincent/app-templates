import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Voyager — travel planning / itinerary app.
//
// Domain:
//   profiles    — per-user info (display name + home city)
//   trips       — top-level trip rows (destination, dates, travelers)
//   tripDays    — day-by-day itinerary, one row per (trip, dayIndex)
//   savedPlaces — bookmarked destinations a user wants to visit later
//   pushTokens  — kept from template so push scaffolding still compiles
export default defineSchema({
  ...authTables,

  profiles: defineTable({
    userId: v.optional(v.id('users')),
    displayName: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    createdAt: v.number(),
    onboardingComplete: v.optional(v.boolean()),
    pushEnabled: v.optional(v.boolean()),
    personaKey: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_persona', ['personaKey']),

  trips: defineTable({
    userId: v.id('profiles'),
    title: v.string(),
    destination: v.string(),
    // Epoch ms — inclusive start, inclusive end.
    startsAt: v.number(),
    endsAt: v.number(),
    travelerCount: v.number(),
    coverEmoji: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_starts', ['userId', 'startsAt']),

  tripDays: defineTable({
    tripId: v.id('trips'),
    userId: v.id('profiles'),
    dayIndex: v.number(),
    // ISO 'YYYY-MM-DD' for display anchoring.
    date: v.string(),
    title: v.optional(v.string()),
    // Free-form list of activities for that day.
    activities: v.array(
      v.object({
        time: v.optional(v.string()),
        label: v.string(),
        location: v.optional(v.string()),
        icon: v.optional(v.string()),
      })
    ),
  })
    .index('by_trip', ['tripId'])
    .index('by_trip_day', ['tripId', 'dayIndex']),

  savedPlaces: defineTable({
    userId: v.id('profiles'),
    name: v.string(),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    note: v.optional(v.string()),
    emoji: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_user', ['userId']),

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
});
