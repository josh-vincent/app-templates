// Watch subscriptions on pools and bets.
//
// A "watch" pings the user before a target's deadline. The fireDue cron
// runs hourly: any watch with `fired === false` whose target's settle/end
// time falls inside the alert window is pushed and marked fired.

import { v } from 'convex/values';

import { internalMutation, mutation, query } from './_generated/server';
import { schedulePushForUsers } from './notifications';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

// ---- Public API -----------------------------------------------------------

export const list = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    return await ctx.db
      .query('watches')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .collect();
  },
});

export const setForPool = mutation({
  args: {
    ...personaArgs,
    poolId: v.id('jackpotPools'),
    alertMinutesBefore: v.number(),
  },
  handler: async (ctx, { personaKey, poolId, alertMinutesBefore }) => {
    const me = await ensureProfile(ctx, personaKey);
    const existing = await ctx.db
      .query('watches')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .filter((q) => q.eq(q.field('poolId'), poolId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        alertMinutesBefore,
        fired: false,
      });
      return existing._id;
    }
    return await ctx.db.insert('watches', {
      userId: me._id,
      targetKind: 'pool',
      poolId,
      alertMinutesBefore,
      fired: false,
      createdAt: Date.now(),
    });
  },
});

export const setForBet = mutation({
  args: {
    ...personaArgs,
    challengeId: v.id('challenges'),
    alertMinutesBefore: v.number(),
  },
  handler: async (ctx, { personaKey, challengeId, alertMinutesBefore }) => {
    const me = await ensureProfile(ctx, personaKey);
    const existing = await ctx.db
      .query('watches')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .filter((q) => q.eq(q.field('challengeId'), challengeId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        alertMinutesBefore,
        fired: false,
      });
      return existing._id;
    }
    return await ctx.db.insert('watches', {
      userId: me._id,
      targetKind: 'bet',
      challengeId,
      alertMinutesBefore,
      fired: false,
      createdAt: Date.now(),
    });
  },
});

export const clear = mutation({
  args: { ...personaArgs, id: v.id('watches') },
  handler: async (ctx, { personaKey, id }) => {
    const me = await ensureProfile(ctx, personaKey);
    const row = await ctx.db.get(id);
    if (!row) return null;
    if (row.userId !== me._id) throw new Error('Not yours.');
    await ctx.db.delete(id);
    return null;
  },
});

// ---- Cron-driven fan-out --------------------------------------------------

export const fireDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Cheap scan — `fired === false` is rare. Switch to an index when
    // unfired counts grow.
    const all = await ctx.db.query('watches').collect();
    const due = all.filter((w) => !w.fired);
    let fired = 0;
    for (const w of due) {
      let target: { settlesAt: number; title: string } | null = null;
      if (w.targetKind === 'pool' && w.poolId) {
        const pool = await ctx.db.get(w.poolId);
        if (pool && pool.status === 'open') {
          const label =
            pool.scope === 'region' && pool.scopeKey
              ? `${pool.scopeKey} pool`
              : pool.scope === 'friends'
                ? 'friends pool'
                : 'global jackpot';
          target = { settlesAt: pool.settlesAt, title: label };
        }
      } else if (w.targetKind === 'bet' && w.challengeId) {
        const c = await ctx.db.get(w.challengeId);
        if (c && c.status === 'running') {
          target = { settlesAt: c.endsAt, title: c.title };
        }
      }
      if (!target) continue;
      const minutesUntil = (target.settlesAt - now) / 60_000;
      if (minutesUntil > w.alertMinutesBefore || minutesUntil < 0) continue;
      await schedulePushForUsers(ctx, [w.userId], {
        title: target.title,
        body: `Ends in ${Math.max(1, Math.round(minutesUntil))} min`,
        data:
          w.targetKind === 'bet' && w.challengeId
            ? { betId: w.challengeId }
            : { poolId: w.poolId },
      });
      await ctx.db.patch(w._id, { fired: true });
      fired += 1;
    }
    return { fired };
  },
});

