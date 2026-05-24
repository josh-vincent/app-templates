// Location pings — backend half of the bet-window background tracking flow.
//
// The mobile client (lib/locationTracking.ts) gathers GPS pings while a
// non-sensor bet is active and POSTs batches via recordPings. Pings are
// scoped to a profile + challenge so disputes can pull just the relevant
// trail.
//
// Shape and indexes mirror schema.ts. Keep batch limits modest so the
// mutation runs cheaply.

import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

const MAX_BATCH = 50;

export const recordPings = mutation({
  args: {
    ...personaArgs,
    pings: v.array(
      v.object({
        challengeId: v.id('challenges'),
        lat: v.number(),
        lng: v.number(),
        accuracy: v.number(),
        recordedAt: v.number(),
        source: v.optional(
          v.union(v.literal('background'), v.literal('foreground'))
        ),
      })
    ),
  },
  handler: async (ctx, { personaKey, pings }) => {
    if (pings.length === 0) return { inserted: 0 };
    if (pings.length > MAX_BATCH) {
      throw new Error(`Batch exceeds ${MAX_BATCH} pings.`);
    }
    const me = await ensureProfile(ctx, personaKey);
    let inserted = 0;
    for (const p of pings) {
      // Quick sanity bounds — drop garbage rather than throw.
      if (
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lng) > 180 ||
        !Number.isFinite(p.accuracy) ||
        !Number.isFinite(p.recordedAt)
      ) {
        continue;
      }
      await ctx.db.insert('locationPings', {
        userId: me._id,
        challengeId: p.challengeId,
        lat: p.lat,
        lng: p.lng,
        accuracy: p.accuracy,
        recordedAt: p.recordedAt,
        source: p.source ?? 'background',
      });
      inserted += 1;
    }
    return { inserted };
  },
});

export const pingsForChallenge = query({
  args: { ...personaArgs, challengeId: v.id('challenges') },
  handler: async (ctx, { personaKey, challengeId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    const rows = await ctx.db
      .query('locationPings')
      .withIndex('by_user_challenge', (q) =>
        q.eq('userId', me._id).eq('challengeId', challengeId)
      )
      .collect();
    return rows.sort((a, b) => b.recordedAt - a.recordedAt);
  },
});

// Tiny summary: count + first/last timestamps. Useful in UI strips.
export const pingSummaryForChallenge = query({
  args: { ...personaArgs, challengeId: v.id('challenges') },
  handler: async (ctx, { personaKey, challengeId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return { count: 0, firstAt: null, lastAt: null };
    const rows = await ctx.db
      .query('locationPings')
      .withIndex('by_user_challenge', (q) =>
        q.eq('userId', me._id).eq('challengeId', challengeId)
      )
      .collect();
    if (rows.length === 0) return { count: 0, firstAt: null, lastAt: null };
    let first = rows[0].recordedAt;
    let last = rows[0].recordedAt;
    for (const r of rows) {
      if (r.recordedAt < first) first = r.recordedAt;
      if (r.recordedAt > last) last = r.recordedAt;
    }
    return { count: rows.length, firstAt: first, lastAt: last };
  },
});

export const latestPing = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return null;
    const rows = await ctx.db
      .query('locationPings')
      .withIndex('by_user_recorded', (q) => q.eq('userId', me._id))
      .order('desc')
      .take(1);
    return rows[0] ?? null;
  },
});
