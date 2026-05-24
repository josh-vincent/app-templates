import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { type MutationCtx, type QueryCtx, mutation, query } from './_generated/server';

// Note: module is named `users` but operates on `profiles` — Convex Auth owns
// the `users` table.

export const personaArgs = { personaKey: v.optional(v.string()) };

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

export const setHomeCity = mutation({
  args: { ...personaArgs, homeCity: v.string() },
  handler: async (ctx, { personaKey, homeCity }) => {
    const profile = await ensureProfile(ctx, personaKey);
    await ctx.db.patch(profile._id, { homeCity });
    return null;
  },
});

export const completeOnboarding = mutation({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const profile = await ensureProfile(ctx, personaKey);
    await ctx.db.patch(profile._id, { onboardingComplete: true });
    return null;
  },
});

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
    const id = await ctx.db.insert('profiles', {
      personaKey,
      displayName: personaKey,
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
      createdAt: Date.now(),
    });
    const created = await ctx.db.get(id);
    if (!created) throw new Error('Failed to create profile.');
    return created;
  }

  // Dev fallback profile (no auth, no persona).
  const all = await ctx.db.query('profiles').collect();
  const dev = all.find((p) => !p.userId && !p.personaKey);
  if (dev) return dev;
  const id = await ctx.db.insert('profiles', {
    displayName: 'Traveler',
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
