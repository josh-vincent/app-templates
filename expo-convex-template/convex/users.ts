import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';

// Note: the module is named `users` for client-facing readability
// (`api.users.me`), but it operates on the `profiles` table — Convex Auth
// owns the `users` table.

// Shared arg validator. Spread into every public function that depends on
// who's calling, so the dev persona switch on a second simulator routes to
// the right profile.
export const personaArgs = { personaKey: v.optional(v.string()) };

const PERSONA_DEFAULTS: Record<
  string,
  { displayName: string; walletBalance: number; totalWon: number; totalForfeited: number }
> = {
  josh: { displayName: 'Josh', walletBalance: 100, totalWon: 0, totalForfeited: 0 },
  jeff: { displayName: 'Jeff', walletBalance: 100, totalWon: 0, totalForfeited: 0 },
};

export const me = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    return ensureProfileQuery(ctx, personaKey);
  },
});

export const setDisplayName = mutation({
  args: { ...personaArgs, displayName: v.string() },
  handler: async (ctx, { personaKey, displayName }) => {
    const profile = await ensureProfile(ctx, personaKey);
    await ctx.db.patch(profile._id, { displayName });
    return null;
  },
});

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const claimUsername = mutation({
  args: { ...personaArgs, username: v.string() },
  handler: async (ctx, { personaKey, username }) => {
    const handle = username.trim().toLowerCase();
    if (!USERNAME_RE.test(handle)) {
      throw new Error('Username must be 3–20 characters, lowercase letters, digits, or underscore.');
    }
    const profile = await ensureProfile(ctx, personaKey);
    if (profile.username === handle) return handle;

    const taken = await ctx.db
      .query('profiles')
      .withIndex('by_username', (q) => q.eq('username', handle))
      .first();
    if (taken && taken._id !== profile._id) {
      throw new Error('That username is taken.');
    }
    await ctx.db.patch(profile._id, { username: handle });
    return handle;
  },
});

export const setRegion = mutation({
  args: { ...personaArgs, countryCode: v.string() },
  handler: async (ctx, { personaKey, countryCode }) => {
    const code = countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new Error('countryCode must be a 2-letter ISO code.');
    }
    const profile = await ensureProfile(ctx, personaKey);
    await ctx.db.patch(profile._id, { countryCode: code });
    return code;
  },
});

// Claim a referrer via a fitstake://join/<username> deep link. One-shot —
// once set, it's immutable so a user can't swap their referrer later.
// Self-referrals rejected. Unknown username → no-op (don't blow up the
// onboarding flow).
export const claimReferral = mutation({
  args: { ...personaArgs, referrerUsername: v.string() },
  handler: async (ctx, { personaKey, referrerUsername }) => {
    const handle = referrerUsername.trim().toLowerCase();
    if (!handle) return { claimed: false, reason: 'empty' as const };

    const me = await ensureProfile(ctx, personaKey);
    if (me.referredBy) return { claimed: false, reason: 'already' as const };

    const referrer = await ctx.db
      .query('profiles')
      .withIndex('by_username', (q) => q.eq('username', handle))
      .first();
    if (!referrer) return { claimed: false, reason: 'unknown' as const };
    if (referrer._id === me._id) {
      return { claimed: false, reason: 'self' as const };
    }
    await ctx.db.patch(me._id, { referredBy: referrer._id });
    return { claimed: true, referrerId: referrer._id };
  },
});

// Read-only profile snapshot for a referral landing page. Public — no auth
// gate beyond persona arg routing. Returns null if the username is unknown.
export const profileByUsername = query({
  args: { ...personaArgs, username: v.string() },
  handler: async (ctx, { username }) => {
    const handle = username.trim().toLowerCase();
    if (!handle) return null;
    const p = await ctx.db
      .query('profiles')
      .withIndex('by_username', (q) => q.eq('username', handle))
      .first();
    if (!p) return null;
    return {
      profileId: p._id,
      displayName: p.displayName ?? null,
      username: p.username ?? null,
      totalWon: p.totalWon,
      totalForfeited: p.totalForfeited,
    };
  },
});

// Set the user's default forfeit destination. Reads back via api.users.me.
// Pass null to clear the override and fall back to smart-resolve in
// jackpotTiers.ts:resolveForfeitDestination.
export const setForfeitDestination = mutation({
  args: {
    ...personaArgs,
    destination: v.union(
      v.literal('friends'),
      v.literal('region'),
      v.literal('global'),
      v.null()
    ),
  },
  handler: async (ctx, { personaKey, destination }) => {
    const profile = await ensureProfile(ctx, personaKey);
    if (destination === null) {
      await ctx.db.patch(profile._id, { forfeitDestination: undefined });
      return null;
    }
    await ctx.db.patch(profile._id, { forfeitDestination: destination });
    return destination;
  },
});

// Mark the onboarding flow finished. Called from the last onboarding step.
export const completeOnboarding = mutation({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const profile = await ensureProfile(ctx, personaKey);
    await ctx.db.patch(profile._id, { onboardingComplete: true });
    return null;
  },
});

// Set or clear the global notification lead-time override (hours before endsAt
// at which a reminder fires). Pass an empty array to disable all reminders,
// or null to restore smart defaults per bet duration.
export const setNotifyLeads = mutation({
  args: {
    ...personaArgs,
    leadHours: v.union(v.array(v.number()), v.null()),
  },
  handler: async (ctx, { personaKey, leadHours }) => {
    const profile = await ensureProfile(ctx, personaKey);
    if (leadHours === null) {
      await ctx.db.patch(profile._id, { notifyLeadHours: undefined });
      return null;
    }
    const clean = leadHours
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 24 * 14)
      .sort((a, b) => b - a);
    await ctx.db.patch(profile._id, { notifyLeadHours: clean });
    return clean;
  },
});

// Resolution order:
//   1. personaKey (dev multi-sim override)
//   2. authUserId (Convex Auth)
//   3. shared dev fallback profile (no userId, no personaKey)
export async function ensureProfile(
  ctx: MutationCtx,
  personaKey?: string
): Promise<Doc<'profiles'>> {
  if (personaKey) {
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_persona', (q) => q.eq('personaKey', personaKey))
      .first();
    if (existing) return existing;
    const defaults =
      PERSONA_DEFAULTS[personaKey] ?? {
        displayName: personaKey,
        walletBalance: 100,
        totalWon: 0,
        totalForfeited: 0,
      };
    const id = await ctx.db.insert('profiles', {
      personaKey,
      displayName: defaults.displayName,
      walletBalance: defaults.walletBalance,
      totalWon: defaults.totalWon,
      totalForfeited: defaults.totalForfeited,
      createdAt: Date.now(),
    });
    const created = await ctx.db.get(id);
    if (!created) throw new Error('Failed to create persona profile.');
    return created;
  }

  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', authUserId))
      .first();
    if (existing) return existing;
    const id = await ctx.db.insert('profiles', {
      userId: authUserId,
      walletBalance: 0,
      totalWon: 0,
      totalForfeited: 0,
      createdAt: Date.now(),
    });
    const created = await ctx.db.get(id);
    if (!created) throw new Error('Failed to create profile.');
    return created;
  }

  // Dev fallback — pick the first profile that's neither auth- nor persona-bound.
  const all = await ctx.db.query('profiles').collect();
  const dev = all.find((p) => !p.userId && !p.personaKey);
  if (dev) return dev;
  const id = await ctx.db.insert('profiles', {
    displayName: 'Dev user',
    walletBalance: 0,
    totalWon: 0,
    totalForfeited: 0,
    createdAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error('Failed to create dev profile.');
  return created;
}

export async function ensureProfileQuery(
  ctx: QueryCtx,
  personaKey?: string
): Promise<Doc<'profiles'> | null> {
  if (personaKey) {
    return await ctx.db
      .query('profiles')
      .withIndex('by_persona', (q) => q.eq('personaKey', personaKey))
      .first();
  }
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    const found = await ctx.db
      .query('profiles')
      .withIndex('by_userId', (q) => q.eq('userId', authUserId))
      .first();
    if (found) return found;
  }
  const all = await ctx.db.query('profiles').collect();
  return all.find((p) => !p.userId && !p.personaKey) ?? null;
}
