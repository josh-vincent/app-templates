// Jackpot tier rules — shared by settlement (forfeit routing) and
// jackpot queries (eligibility / display).
//
// Tier intent: a bet's STAKE picks which pool absorbs its forfeit, and a
// user's recent SETTLED-BET COUNT picks which pools they can take a
// share from. Cumulative — hit hard, you also qualify for medium + easy.
// Keep this file pure: imported by Convex mutations + queries + the
// client UI for label sync.

import type { QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

export type Tier = 'easy' | 'medium' | 'hard';

const TIER_BREAKS = { easyMax: 10, mediumMax: 25 } as const;

// Stake-driven tier the bet's forfeit feeds. Legacy bets without a
// stake fall back to 'medium' so they still settle into a real pool.
export function tierFromStake(stake: number | undefined | null): Tier {
  if (stake == null) return 'medium';
  if (stake < TIER_BREAKS.easyMax) return 'easy';
  if (stake < TIER_BREAKS.mediumMax) return 'medium';
  return 'hard';
}

// How many SETTLED participations a user needs (in the last
// `LOOKBACK_DAYS` days) to be eligible for a share of each tier. The
// gates are cumulative — if you cleared the hard threshold you're
// eligible for all three. Numbers are intentionally low for v1 so the
// system feels reachable; we can crank them up once volume grows.
const LOOKBACK_DAYS = 30;
export const TIER_THRESHOLDS: Record<Tier, number> = {
  easy: 1,
  medium: 3,
  hard: 7,
};

// Count WON participations for a user in the last 30 days. Forfeits don't
// qualify — only people who hit their goals earn share rights in a pool.
// Caps at the hard threshold so a power user doesn't slow the query as
// their history grows.
async function settledCountInWindow(
  ctx: QueryCtx,
  userId: Id<'profiles'>,
  now: number
): Promise<number> {
  const cutoff = now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const rows = await ctx.db
    .query('participants')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  let count = 0;
  for (const r of rows) {
    if (r.status !== 'won') continue;
    if (r.stakedAt < cutoff) continue;
    count += 1;
    if (count >= TIER_THRESHOLDS.hard) break;
  }
  return count;
}

export async function eligibleTiersFor(
  ctx: QueryCtx,
  userId: Id<'profiles'> | null,
  now: number = Date.now()
): Promise<{
  settledCount: number;
  tiers: Record<Tier, boolean>;
}> {
  if (!userId) {
    return {
      settledCount: 0,
      tiers: { easy: false, medium: false, hard: false },
    };
  }
  const count = await settledCountInWindow(ctx, userId, now);
  return {
    settledCount: count,
    tiers: {
      easy: count >= TIER_THRESHOLDS.easy,
      medium: count >= TIER_THRESHOLDS.medium,
      hard: count >= TIER_THRESHOLDS.hard,
    },
  };
}

// Resolve a user's preferred forfeit destination with smart fallback:
//   - their explicit profile.forfeitDestination when set
//   - 'friends' when they have at least one friendship row
//   - 'region' when they have a countryCode but no friends
//   - 'global' otherwise
export async function resolveForfeitDestination(
  ctx: QueryCtx,
  profile: Doc<'profiles'>
): Promise<'friends' | 'region' | 'global'> {
  if (profile.forfeitDestination) return profile.forfeitDestination;
  const anyFriend = await ctx.db
    .query('friendships')
    .withIndex('by_from', (q) => q.eq('fromUserId', profile._id))
    .first();
  if (anyFriend) return 'friends';
  if (profile.countryCode) return 'region';
  return 'global';
}
