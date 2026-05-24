// Home tab queries — the friend-prediction-market feed.
//
// friendsLive: every running bet whose subject (creator for solo /
//   subjectUserId for market+naysayer) is in the caller's friends graph.
//   Each row carries today's progress, pace state, time-left, and a flag
//   for whether the caller has already taken a side.
//
// friendsJustStarted: friend bets opened in the last 24h. Optimistic
//   discovery — see what your circle just committed to.

import type { Doc, Id } from './_generated/dataModel';
import { query } from './_generated/server';
import { TIER_THRESHOLDS } from './jackpotTiers';
import { ensureProfileQuery, personaArgs } from './users';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const LOOKBACK_MS = 30 * DAY_MS;

type LiveRow = {
  challengeId: Id<'challenges'>;
  title: string;
  activityKey: string;
  betShape: 'solo' | 'h2h' | 'market' | 'naysayer';
  subjectUserId: Id<'profiles'>;
  subjectDisplayName: string | null;
  subjectUsername: string | null;
  stakeAmount: number;
  stepGoal: number;
  startsAt: number;
  endsAt: number;
  // Today's progress for the subject on this bet (steps activities only).
  // Null when activity isn't sensor-tracked or no entries yet.
  progress: number | null;
  // What pace the subject is on RIGHT NOW. Null when progress is null.
  pace: 'ahead' | 'on_pace' | 'behind' | null;
  // True if the caller already took a side (any role) on this bet.
  iAlreadyStaked: boolean;
  // Whether the caller is allowed to take the under (friendship + status
  // gate, not the creator).
  canTakeUnder: boolean;
};

export const friendsLive = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [] as LiveRow[];

    const friendIds = await getFriendIds(ctx, me._id);
    if (friendIds.size === 0) return [] as LiveRow[];

    const running = await ctx.db
      .query('challenges')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();

    const out: LiveRow[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const c of running) {
      const subjectId = c.subjectUserId ?? c.creatorId;
      if (!friendIds.has(subjectId)) continue;
      const subject = await ctx.db.get(subjectId);
      if (!subject) continue;

      // Today's step entry for the subject on this bet.
      let progress: number | null = null;
      if ((c.activityKey ?? 'steps') === 'steps') {
        const entry = await ctx.db
          .query('stepEntries')
          .withIndex('by_user_date', (q) =>
            q.eq('userId', subjectId).eq('date', todayStr)
          )
          .filter((q) => q.eq(q.field('challengeId'), c._id))
          .first();
        progress = entry?.steps ?? 0;
      }

      const pace = computePace(c, progress);
      const myParticipant = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
        .filter((q) => q.eq(q.field('userId'), me._id))
        .first();

      out.push({
        challengeId: c._id,
        title: c.title,
        activityKey: c.activityKey ?? 'steps',
        betShape: (c.betShape ?? 'solo') as LiveRow['betShape'],
        subjectUserId: subjectId,
        subjectDisplayName: subject.displayName ?? null,
        subjectUsername: subject.username ?? null,
        stakeAmount: c.stakeAmount,
        stepGoal: c.stepGoal,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        progress,
        pace,
        iAlreadyStaked: !!myParticipant && myParticipant.status !== 'pending',
        // Subject can't bet against themselves; existing-stake guard.
        canTakeUnder: subjectId !== me._id && !myParticipant,
      });
    }

    // Sort: bets I haven't taken first, then by closest to ending.
    out.sort((a, b) => {
      if (a.iAlreadyStaked !== b.iAlreadyStaked) {
        return a.iAlreadyStaked ? 1 : -1;
      }
      return a.endsAt - b.endsAt;
    });
    return out;
  },
});

export const friendsJustStarted = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];

    const friendIds = await getFriendIds(ctx, me._id);
    if (friendIds.size === 0) return [];

    const cutoff = Date.now() - DAY_MS;
    // Open AND running, started recently.
    const recent: Doc<'challenges'>[] = [];
    for (const status of ['open', 'running'] as const) {
      const rows = await ctx.db
        .query('challenges')
        .withIndex('by_status', (q) => q.eq('status', status))
        .collect();
      for (const r of rows) if (r.startsAt >= cutoff) recent.push(r);
    }

    const out = await Promise.all(
      recent.map(async (c) => {
        const subjectId = c.subjectUserId ?? c.creatorId;
        if (!friendIds.has(subjectId)) return null;
        const subject = await ctx.db.get(subjectId);
        if (!subject) return null;
        return {
          challengeId: c._id,
          title: c.title,
          activityKey: c.activityKey ?? 'steps',
          betShape: (c.betShape ?? 'solo') as LiveRow['betShape'],
          subjectUserId: subjectId,
          subjectDisplayName: subject.displayName ?? null,
          subjectUsername: subject.username ?? null,
          stakeAmount: c.stakeAmount,
          stepGoal: c.stepGoal,
          startedAt: c.startsAt,
        };
      })
    );

    return out
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 6);
  },
});

// Friends-pool teaser for the gold strip on Home.
//
// Returns the aggregate $ across the caller's open friends pools, the
// nearest settle timestamp, distinct contributor count, AND the caller's
// live share — both as a percentage and a dollar estimate.
//
// Share math: even split across audience members who hit the tier
// threshold in the last 30 days. If you're not eligible, share is null
// (UI shows "—%"). When eligibleWinners is 0 the share is null too.
export const friendsPoolSummary = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return null;

    const pools = await ctx.db
      .query('jackpotPools')
      .withIndex('by_scope', (q) =>
        q.eq('scope', 'friends').eq('scopeKey', me._id).eq('status', 'open')
      )
      .collect();

    if (pools.length === 0) {
      return {
        total: 0,
        nextSettlesAt: Date.now() + 7 * DAY_MS,
        contributorCount: 0,
        eligibleWinners: 0,
        playersCount: 0,
        myShare: null as number | null,
        mySharePct: null as number | null,
        amIEligible: false,
      };
    }

    const total = pools.reduce((s, p) => s + p.total, 0);
    const nextSettlesAt = pools.reduce(
      (min, p) => (min == null || p.settlesAt < min ? p.settlesAt : min),
      Date.now() + 7 * DAY_MS
    );

    const ids = new Set<string>();
    for (const p of pools) {
      const rows = await ctx.db
        .query('poolContributions')
        .withIndex('by_pool', (q) => q.eq('poolId', p._id))
        .collect();
      for (const c of rows) ids.add(c.userId as unknown as string);
    }

    // Audience for me-as-pool-owner: me + bidirectional friends. Then
    // count how many of them hit the soonest-settling pool's tier.
    const audience = await audienceForFriendsScope(ctx, me._id);
    const tier =
      pools.find((p) => p.settlesAt === nextSettlesAt)?.tier ?? 'medium';
    const threshold = TIER_THRESHOLDS[tier];
    const cutoff = Date.now() - LOOKBACK_MS;

    let eligibleWinners = 0;
    let amIEligible = false;
    for (const userId of audience) {
      const wins = await countWinsSince(ctx, userId, cutoff, threshold);
      if (wins >= threshold) {
        eligibleWinners += 1;
        if (userId === me._id) amIEligible = true;
      }
    }

    const myShare = amIEligible && eligibleWinners > 0 ? total / eligibleWinners : null;
    const mySharePct = amIEligible && eligibleWinners > 0 ? 1 / eligibleWinners : null;

    return {
      total,
      nextSettlesAt,
      contributorCount: ids.size,
      eligibleWinners,
      playersCount: audience.length,
      myShare,
      mySharePct,
      amIEligible,
    };
  },
});

// ---- Helpers --------------------------------------------------------------

async function getFriendIds(
  ctx: any,
  myId: Id<'profiles'>
): Promise<Set<Id<'profiles'>>> {
  const rows = await ctx.db
    .query('friendships')
    .withIndex('by_from', (q: any) => q.eq('fromUserId', myId))
    .collect();
  const set = new Set<Id<'profiles'>>();
  for (const r of rows) set.add(r.toUserId as Id<'profiles'>);
  return set;
}

async function audienceForFriendsScope(
  ctx: any,
  ownerId: Id<'profiles'>
): Promise<Id<'profiles'>[]> {
  const friendships = await ctx.db
    .query('friendships')
    .withIndex('by_from', (q: any) => q.eq('fromUserId', ownerId))
    .collect();
  const ids = new Set<Id<'profiles'>>([ownerId]);
  for (const f of friendships) ids.add(f.toUserId as Id<'profiles'>);
  return Array.from(ids);
}

async function countWinsSince(
  ctx: any,
  userId: Id<'profiles'>,
  cutoff: number,
  cap: number
): Promise<number> {
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
    if (wins >= cap) break;
  }
  return wins;
}

// Pace state: ahead if progress% beats time% by 10pp; behind if it
// trails by 10pp; on-pace otherwise. For sensor activities only.
function computePace(
  c: Doc<'challenges'>,
  progress: number | null
): 'ahead' | 'on_pace' | 'behind' | null {
  if (progress == null || c.stepGoal <= 0) return null;
  const now = Date.now();
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const dayEnd = dayStart + DAY_MS;
  const timeFraction = Math.max(
    0,
    Math.min(1, (now - dayStart) / (dayEnd - dayStart))
  );
  const goalFraction = Math.max(0, Math.min(1, progress / c.stepGoal));
  const delta = goalFraction - timeFraction;
  if (delta > 0.1) return 'ahead';
  if (delta < -0.1) return 'behind';
  return 'on_pace';
}
