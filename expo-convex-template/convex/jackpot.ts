import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, query } from './_generated/server';
import {
  type Tier,
  TIER_THRESHOLDS,
  eligibleTiersFor,
  resolveForfeitDestination,
} from './jackpotTiers';
import { schedulePushForUsers } from './notifications';
import { ensureProfileQuery, personaArgs } from './users';
import { applyDelta, recordTx } from './wallet';

const DAY_MS = 24 * 60 * 60 * 1000;

// Backwards-compatible single-pool query — used by the Home jackpot strip.
// Returns the highest-priority open pool the caller is in (friends > region
// > global) plus their estimated share.
export const current = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    const pools = await openPoolsForUser(ctx, me);
    const pick = pools.friends ?? pools.region ?? pools.global;

    if (!pick) {
      return {
        _id: null,
        total: 0,
        settlesAt: Date.now() + DAY_MS,
        eligibleCount: 0,
        myEstimatedShare: null,
      } as const;
    }

    const eligible = await eligibleUserCount(ctx, pick._id);
    const myShare = await myShareOf(ctx, pick, me);
    return {
      ...pick,
      eligibleCount: eligible,
      myEstimatedShare: myShare,
    };
  },
});

// New v3 query: returns the user's three pools side-by-side.
export const byScope = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    const pools = await openPoolsForUser(ctx, me);

    const enrich = async (
      p: Doc<'jackpotPools'> | null
    ): Promise<{
      pool: Doc<'jackpotPools'> | null;
      eligibleCount: number;
      myShare: number | null;
    }> => {
      if (!p) return { pool: null, eligibleCount: 0, myShare: null };
      return {
        pool: p,
        eligibleCount: await eligibleUserCount(ctx, p._id),
        myShare: await myShareOf(ctx, p, me),
      };
    };

    return {
      global: await enrich(pools.global),
      region: await enrich(pools.region),
      friends: await enrich(pools.friends),
      countryCode: me?.countryCode ?? null,
    };
  },
});

// v4: full 3×3 grid (scope × tier) so the Jackpot tab can render one
// card per pool. Each cell includes the pool's total, how many WINNERS
// in the lookback window are eligible, my eligibility flag, my share
// percentage (1/N for an even split), and a guaranteed nextSettlesAt
// so the UI can show a countdown even before the pool's first forfeit.
export const tierBoard = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    const eligibility = await eligibleTiersFor(ctx, me?._id ?? null);
    const preferred = me ? await resolveForfeitDestination(ctx, me) : 'global';

    const tiers: Tier[] = ['easy', 'medium', 'hard'];
    const scopes: Array<{
      scope: 'global' | 'region' | 'friends';
      scopeKey: string;
    }> = [{ scope: 'global', scopeKey: 'global' }];
    if (me?.countryCode) {
      scopes.push({ scope: 'region', scopeKey: me.countryCode });
    }
    if (me) {
      scopes.push({ scope: 'friends', scopeKey: me._id });
    }

    type Cell = {
      scope: 'global' | 'region' | 'friends';
      scopeKey: string;
      tier: Tier;
      pool: Doc<'jackpotPools'> | null;
      total: number;
      // Count of WINNERS in the lookback window who qualify for this tier.
      // This is the denominator of an even-split payout.
      eligibleWinners: number;
      // Pool contributors — kept for display ("N seeded the pot") but no
      // longer drives share math.
      contributorCount: number;
      // 1/eligibleWinners as a fraction; null if user not eligible.
      mySharePct: number | null;
      myShare: number | null;
      eligible: boolean;
      threshold: number;
      // When this pool (or its eventual next-period replacement) settles.
      nextSettlesAt: number;
    };
    const cells: Cell[] = [];

    const nextPeriodSettleAt = nextWeeklySettleAt();

    for (const { scope, scopeKey } of scopes) {
      for (const tier of tiers) {
        const pool = await ctx.db
          .query('jackpotPools')
          .withIndex('by_scope_tier', (q: any) =>
            q
              .eq('scope', scope)
              .eq('scopeKey', scopeKey)
              .eq('tier', tier)
              .eq('status', 'open')
          )
          .first();
        const eligible = eligibility.tiers[tier];
        const contributorCount = pool
          ? await contributorUserCount(ctx, pool._id)
          : 0;
        const eligibleWinners = await eligibleWinnerCount(
          ctx,
          scope,
          scopeKey,
          tier,
          me?._id ?? null
        );
        const mySharePct =
          eligible && eligibleWinners > 0 ? 1 / eligibleWinners : null;
        const myShare =
          pool && mySharePct != null ? pool.total * mySharePct : null;
        cells.push({
          scope,
          scopeKey,
          tier,
          pool,
          total: pool?.total ?? 0,
          eligibleWinners,
          contributorCount,
          mySharePct,
          myShare,
          eligible,
          threshold: TIER_THRESHOLDS[tier],
          nextSettlesAt: pool?.settlesAt ?? nextPeriodSettleAt,
        });
      }
    }

    return {
      cells,
      eligibility,
      forfeitDestination: preferred,
      countryCode: me?.countryCode ?? null,
    };
  },
});

export const history = query({
  args: { ...personaArgs },
  handler: async (ctx, _args) => {
    return await ctx.db
      .query('jackpotPools')
      .withIndex('by_status', (q) => q.eq('status', 'settled'))
      .order('desc')
      .take(10);
  },
});

// Live-feed: which active participants are about to forfeit. Defined as
// running bets whose endsAt is within the next 24h AND the participant's
// progress (sensor) is below pace OR they haven't submitted proof yet
// (non-sensor). Sorted by stake descending so the most dramatic shows first.
export const aboutToForfeit = query({
  args: { ...personaArgs },
  handler: async (ctx, _args) => {
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000;
    const running = await ctx.db
      .query('challenges')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();
    const dueSoon = running.filter((c) => c.endsAt < horizon);

    const out: Array<{
      challengeId: Id<'challenges'>;
      title: string;
      activityKey: string;
      participantId: Id<'participants'>;
      userId: Id<'profiles'>;
      displayName: string | null;
      stakeAmount: number;
      endsAt: number;
      shortReason: string;
    }> = [];

    for (const c of dueSoon) {
      const parts = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
        .collect();
      for (const p of parts) {
        if (p.status !== 'active') continue;
        let reason = 'time running out';
        let atRisk = true;
        if ((c.activityKey ?? 'steps') === 'steps' && p.finalSteps != null) {
          atRisk = p.finalSteps < c.stepGoal;
          if (atRisk) {
            reason = `${(c.stepGoal - p.finalSteps).toLocaleString()} steps short`;
          } else {
            atRisk = false;
          }
        } else {
          // Non-sensor: at risk unless a non-disputed proof exists.
          const proofs = await ctx.db
            .query('proofs')
            .withIndex('by_participant', (q) => q.eq('participantId', p._id))
            .collect();
          const latest = proofs.sort((a, b) => b.submittedAt - a.submittedAt)[0];
          atRisk = !latest || latest.status === 'disputed';
          if (atRisk) reason = 'no proof yet';
        }
        if (!atRisk) continue;
        const u = await ctx.db.get(p.userId);
        out.push({
          challengeId: c._id,
          title: c.title,
          activityKey: c.activityKey ?? 'steps',
          participantId: p._id,
          userId: p.userId,
          displayName: u?.displayName ?? null,
          stakeAmount: p.stakeAmount,
          endsAt: c.endsAt,
          shortReason: reason,
        });
      }
    }
    out.sort((a, b) => b.stakeAmount - a.stakeAmount);
    return out.slice(0, 20);
  },
});

// ---- Helpers --------------------------------------------------------------

async function openPoolsForUser(
  ctx: any,
  me: Doc<'profiles'> | null
): Promise<{
  global: Doc<'jackpotPools'> | null;
  region: Doc<'jackpotPools'> | null;
  friends: Doc<'jackpotPools'> | null;
}> {
  // Global: scope='global', scopeKey='global'.
  const global = await ctx.db
    .query('jackpotPools')
    .withIndex('by_scope', (q: any) =>
      q.eq('scope', 'global').eq('scopeKey', 'global').eq('status', 'open')
    )
    .first();

  // Pre-v3 rows have no scope; fall back to the legacy "first open" pool.
  let globalFallback: Doc<'jackpotPools'> | null = global ?? null;
  if (!globalFallback) {
    const legacy = await ctx.db
      .query('jackpotPools')
      .withIndex('by_status', (q: any) => q.eq('status', 'open'))
      .order('desc')
      .first();
    if (legacy && legacy.scope == null) globalFallback = legacy;
  }

  let region: Doc<'jackpotPools'> | null = null;
  if (me?.countryCode) {
    region = await ctx.db
      .query('jackpotPools')
      .withIndex('by_scope', (q: any) =>
        q
          .eq('scope', 'region')
          .eq('scopeKey', me.countryCode!)
          .eq('status', 'open')
      )
      .first();
  }

  let friends: Doc<'jackpotPools'> | null = null;
  if (me) {
    friends = await ctx.db
      .query('jackpotPools')
      .withIndex('by_scope', (q: any) =>
        q.eq('scope', 'friends').eq('scopeKey', me._id).eq('status', 'open')
      )
      .first();
  }

  return { global: globalFallback, region, friends };
}

// Legacy: counts users who forfeited INTO a pool. Kept for the (now
// unused-by-UI) `current` + `byScope` queries and for analytics. Pool
// SHARE eligibility no longer flows through this — see eligibleWinnerCount.
async function eligibleUserCount(
  ctx: any,
  poolId: Id<'jackpotPools'>
): Promise<number> {
  return contributorUserCount(ctx, poolId);
}

async function contributorUserCount(
  ctx: any,
  poolId: Id<'jackpotPools'>
): Promise<number> {
  const contributions = await ctx.db
    .query('poolContributions')
    .withIndex('by_pool', (q: any) => q.eq('poolId', poolId))
    .collect();
  const ids = new Set(contributions.map((c: any) => c.userId));
  return ids.size;
}

// Legacy: stake split among contributors. Kept for back-compat callers.
async function myShareOf(
  ctx: any,
  pool: Doc<'jackpotPools'>,
  me: Doc<'profiles'> | null
): Promise<number | null> {
  if (!me) return null;
  const myContribs = await ctx.db
    .query('poolContributions')
    .withIndex('by_pool', (q: any) => q.eq('poolId', pool._id))
    .filter((q: any) => q.eq(q.field('userId'), me._id))
    .first();
  if (!myContribs) return null;
  const eligible = await contributorUserCount(ctx, pool._id);
  return eligible > 0 ? pool.total / eligible : null;
}

const LOOKBACK_DAYS = 30;
const LOOKBACK_MS = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

// How many WINNERS in the pool's audience hit the tier threshold in the
// last 30 days. This is the denominator of an even-split payout — only
// successful participants share the pot.
async function eligibleWinnerCount(
  ctx: any,
  scope: 'global' | 'region' | 'friends',
  scopeKey: string,
  tier: Tier,
  _viewerId: Id<'profiles'> | null
): Promise<number> {
  const threshold = TIER_THRESHOLDS[tier];
  const audience = await audienceForScope(ctx, scope, scopeKey);
  if (audience.length === 0) return 0;
  const cutoff = Date.now() - LOOKBACK_MS;
  let count = 0;
  for (const userId of audience) {
    const rows = await ctx.db
      .query('participants')
      .withIndex('by_user_status', (q: any) =>
        q.eq('userId', userId).eq('status', 'won')
      )
      .collect();
    let wins = 0;
    for (const r of rows) {
      if (r.stakedAt < cutoff) continue;
      wins += 1;
      if (wins >= threshold) break;
    }
    if (wins >= threshold) count += 1;
  }
  return count;
}

// Resolve which profile ids are in a pool's audience.
//   global  → every profile in the system
//   region  → every profile whose countryCode matches
//   friends → the pool owner + everyone friends-with them (bidirectional)
async function audienceForScope(
  ctx: any,
  scope: 'global' | 'region' | 'friends',
  scopeKey: string
): Promise<Id<'profiles'>[]> {
  if (scope === 'global') {
    const profiles = await ctx.db.query('profiles').collect();
    return profiles.map((p: any) => p._id);
  }
  if (scope === 'region') {
    const profiles = await ctx.db.query('profiles').collect();
    return profiles
      .filter((p: any) => p.countryCode === scopeKey)
      .map((p: any) => p._id);
  }
  // friends: owner + bidirectional friendships
  const ownerId = scopeKey as unknown as Id<'profiles'>;
  const friendships = await ctx.db
    .query('friendships')
    .withIndex('by_from', (q: any) => q.eq('fromUserId', ownerId))
    .collect();
  const ids = new Set<Id<'profiles'>>([ownerId]);
  for (const f of friendships) ids.add(f.toUserId as Id<'profiles'>);
  return Array.from(ids);
}

// All open pools settle 7 days after their first contribution today.
// When a pool doesn't exist yet, this is the floor for the next one to
// arrive — gives the UI a real countdown instead of "—".
function nextWeeklySettleAt(): number {
  return Date.now() + 7 * 24 * 60 * 60 * 1000;
}

// Settle every open pool whose settlesAt is in the past. Even-split the
// pool's total across the audience members who hit the tier threshold in
// the lookback window. Cron + scheduler both call this — it's idempotent
// (only patches pools still status='open') and a no-op when nothing's due.
//
// On payout: jackpotWin transaction + wallet bump + push to each winner.
// Pool gets status='settled', settledAt=now, winnerCount=N.
//
// When eligibleWinners=0 the pool still settles (so it doesn't get re-tried
// forever) but the total rolls forward into a fresh same-scope pool the
// next time someone forfeits — stake doesn't vanish.
export const settleDuePools = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db
      .query('jackpotPools')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .collect();
    const due = all.filter((p) => p.settlesAt <= now);
    let paid = 0;
    let totalPayouts = 0;
    for (const pool of due) {
      const scope = pool.scope ?? 'global';
      const scopeKey = pool.scopeKey ?? 'global';
      const tier = pool.tier ?? 'medium';

      const audience = await audienceForScope(ctx, scope, scopeKey);
      const threshold = TIER_THRESHOLDS[tier];
      const cutoff = now - LOOKBACK_MS;

      const winners: Id<'profiles'>[] = [];
      for (const userId of audience) {
        const rows = await ctx.db
          .query('participants')
          .withIndex('by_user_status', (q) =>
            q.eq('userId', userId).eq('status', 'won')
          )
          .collect();
        let wins = 0;
        for (const r of rows) {
          if (r.stakedAt < cutoff) continue;
          wins += 1;
          if (wins >= threshold) break;
        }
        if (wins >= threshold) winners.push(userId);
      }

      if (winners.length === 0 || pool.total <= 0) {
        // Mark settled with zero winners. The pool's total stays as a
        // standalone settled record; new contributions create a fresh
        // open pool of the same (scope, scopeKey, tier).
        await ctx.db.patch(pool._id, {
          status: 'settled',
          settledAt: now,
          winnerCount: 0,
        });
        continue;
      }

      const perWinner = pool.total / winners.length;
      for (const wId of winners) {
        const w = await ctx.db.get(wId);
        if (!w) continue;
        await applyDelta(ctx, w, perWinner);
        await recordTx(ctx, w._id, 'jackpotWin', perWinner, undefined);
        await ctx.db.patch(w._id, { totalWon: w.totalWon + perWinner });
        await schedulePushForUsers(ctx, [w._id], {
          title: 'Jackpot payout',
          body: `+$${perWinner.toFixed(2)} from the ${scope === 'friends' ? 'friends' : scope} pool`,
          data: { poolId: pool._id },
        });
        totalPayouts += perWinner;
        paid += 1;
      }
      await ctx.db.patch(pool._id, {
        status: 'settled',
        settledAt: now,
        winnerCount: winners.length,
      });
    }
    return { settledPools: due.length, paid, totalPayouts };
  },
});
