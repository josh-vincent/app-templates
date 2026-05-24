import { v } from 'convex/values';

import { getActivity } from '../lib/activities';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { computeProgressSnapshot, computeWhatsLeft } from './lib/whatsLeft';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

export const list = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    const out = await ctx.db
      .query('friendships')
      .withIndex('by_from', (q) => q.eq('fromUserId', me._id))
      .collect();
    const friends = await Promise.all(
      out.map(async (f) => {
        const u = await ctx.db.get(f.toUserId);
        return u ? mapFriend(u, f.createdAt) : null;
      })
    );
    return friends.filter(<T,>(x: T | null): x is T => x !== null);
  },
});

// Search by username (when q starts with @ or matches the username regex)
// OR substring of displayName. Excludes the caller and existing friends.
// Linear scan is fine at v0 scale; promote to a search index later.
export const searchByName = query({
  args: { ...personaArgs, q: v.string() },
  handler: async (ctx, { personaKey, q }) => {
    const raw = q.trim();
    if (raw.length === 0) return [];
    const term = raw.toLowerCase();
    const usernameTerm = term.startsWith('@') ? term.slice(1) : term;

    const me = await ensureProfileQuery(ctx, personaKey);
    const myId = me?._id ?? null;

    const existingFriends = me
      ? new Set(
          (
            await ctx.db
              .query('friendships')
              .withIndex('by_from', (qq) => qq.eq('fromUserId', me._id))
              .collect()
          ).map((f) => f.toUserId)
        )
      : new Set();

    const profiles = await ctx.db.query('profiles').collect();
    const matches = profiles.filter((p) => {
      if (myId && p._id === myId) return false;
      if (existingFriends.has(p._id)) return false;
      const name = (p.displayName ?? '').toLowerCase();
      const handle = (p.username ?? '').toLowerCase();
      // @-prefixed search restricts to username matches (prefix or substring).
      if (term.startsWith('@')) {
        return handle.includes(usernameTerm);
      }
      return name.includes(term) || handle.includes(term);
    });

    return matches.slice(0, 10).map((p) => ({
      profileId: p._id,
      displayName: p.displayName ?? null,
      username: p.username ?? null,
      totalWon: p.totalWon,
      totalForfeited: p.totalForfeited,
    }));
  },
});

export const addFriend = mutation({
  args: { ...personaArgs, profileId: v.id('profiles') },
  handler: async (ctx, { personaKey, profileId }) => {
    const me = await ensureProfile(ctx, personaKey);
    if (profileId === me._id) {
      throw new Error("You can't add yourself.");
    }
    const target = await ctx.db.get(profileId);
    if (!target) throw new Error('Profile not found.');

    // Insert both directions; idempotent.
    const existingForward = await ctx.db
      .query('friendships')
      .withIndex('by_from', (q) => q.eq('fromUserId', me._id))
      .filter((q) => q.eq(q.field('toUserId'), profileId))
      .first();
    if (!existingForward) {
      await ctx.db.insert('friendships', {
        fromUserId: me._id,
        toUserId: profileId,
        createdAt: Date.now(),
      });
    }
    const existingReverse = await ctx.db
      .query('friendships')
      .withIndex('by_from', (q) => q.eq('fromUserId', profileId))
      .filter((q) => q.eq(q.field('toUserId'), me._id))
      .first();
    if (!existingReverse) {
      await ctx.db.insert('friendships', {
        fromUserId: profileId,
        toUserId: me._id,
        createdAt: Date.now(),
      });
    }
    return mapFriend(target, Date.now());
  },
});

function mapFriend(u: Doc<'profiles'>, since: number) {
  return {
    profileId: u._id,
    displayName: u.displayName ?? null,
    username: u.username ?? null,
    totalWon: u.totalWon,
    totalForfeited: u.totalForfeited,
    since,
  };
}

// Live "what are my friends doing right now?" — drives the FRIENDS' PROGRESS
// strip on Today. For each friend, picks their soonest-ending active stake
// and computes today's progress against goal so the UI can render a ring +
// urgency hint without N+1 client queries.
export const progressNow = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    const fs = await ctx.db
      .query('friendships')
      .withIndex('by_from', (q) => q.eq('fromUserId', me._id))
      .collect();

    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();

    const rows = await Promise.all(
      fs.map(async (f) => {
        const profile = await ctx.db.get(f.toUserId);
        if (!profile) return null;
        const parts = await ctx.db
          .query('participants')
          .withIndex('by_user_status', (q) =>
            q.eq('userId', f.toUserId).eq('status', 'active')
          )
          .collect();
        if (parts.length === 0) {
          return {
            profileId: profile._id,
            displayName: profile.displayName ?? null,
            username: profile.username ?? null,
            stakeAmount: 0,
            activeCount: 0,
            challengeId: null,
            challengeTitle: null,
            activityKey: 'steps',
            goal: 0,
            progress: 0,
            hoursLeft: null,
            atRisk: false,
            ahead: false,
          };
        }
        // Pick the soonest-ending active bet.
        const challenges = await Promise.all(parts.map((p) => ctx.db.get(p.challengeId)));
        const pairs = parts
          .map((p, i) => ({ p, c: challenges[i] }))
          .filter((x): x is { p: typeof parts[number]; c: NonNullable<typeof challenges[number]> } => !!x.c);
        if (pairs.length === 0) return null;
        const focus = pairs.slice().sort((a, b) => a.c.endsAt - b.c.endsAt)[0];

        // Sensor-tracked: sum today's stepEntries for this user+challenge.
        let progress = focus.p.finalSteps ?? 0;
        if ((focus.c.activityKey ?? 'steps') === 'steps') {
          const entry = await ctx.db
            .query('stepEntries')
            .withIndex('by_user_date', (q) =>
              q.eq('userId', f.toUserId).eq('date', today)
            )
            .filter((q) => q.eq(q.field('challengeId'), focus.c._id))
            .first();
          progress = entry?.steps ?? 0;
        }

        const hoursLeft = (focus.c.endsAt - now) / 3_600_000;
        const totalStake = parts.reduce((sum, p) => sum + p.stakeAmount, 0);
        const goal = focus.c.stepGoal;
        const ratio = goal > 0 ? progress / goal : 0;
        // At-risk if past pace: less than expected fraction of the goal given
        // how much of the day has elapsed (steps only — non-sensor falls back
        // to proof submission state).
        const dayFraction =
          (now -
            new Date(today + 'T00:00:00').getTime()) /
          (24 * 60 * 60 * 1000);
        const atRisk =
          (focus.c.activityKey ?? 'steps') === 'steps' &&
          ratio < Math.max(0.1, dayFraction - 0.15);
        const ahead = ratio >= 1;

        return {
          profileId: profile._id,
          displayName: profile.displayName ?? null,
          username: profile.username ?? null,
          stakeAmount: totalStake,
          activeCount: parts.length,
          challengeId: focus.c._id,
          challengeTitle: focus.c.title,
          activityKey: focus.c.activityKey ?? 'steps',
          goal,
          progress,
          hoursLeft,
          atRisk,
          ahead,
        };
      })
    );

    return rows.filter(<T,>(x: T | null): x is T => x !== null);
  },
});

// Aggregate head-to-head record between the caller and `otherUserId`.
// Returns counts + lifetime $ flow + the actual shared challenges so the
// friend-detail screen can render both the summary line and the list.
//
// "Shared" = both me and them are participants on the same challenge.
// Outcomes considered: status 'won' or 'forfeit' (settled). 'active' bets
// count toward the openCount only.
export const headToHeadRecord = query({
  args: { ...personaArgs, otherUserId: v.id('profiles') },
  handler: async (ctx, { personaKey, otherUserId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) {
      return {
        meWon: 0,
        themWon: 0,
        openCount: 0,
        netToMe: 0,
        shared: [] as Array<{
          challengeId: any;
          title: string;
          stakeAmount: number;
          endsAt: number;
          meStatus: string;
          themStatus: string;
        }>,
      };
    }

    // Find their participations, then check which of those challenges I'm
    // also in. Indexed-only scan on the smaller side first.
    const theirs = await ctx.db
      .query('participants')
      .withIndex('by_user', (q) => q.eq('userId', otherUserId))
      .collect();

    let meWon = 0;
    let themWon = 0;
    let openCount = 0;
    let netToMe = 0;
    const shared: Array<{
      challengeId: any;
      title: string;
      stakeAmount: number;
      endsAt: number;
      meStatus: string;
      themStatus: string;
    }> = [];

    for (const t of theirs) {
      const myRow = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', t.challengeId))
        .filter((q) => q.eq(q.field('userId'), me._id))
        .first();
      if (!myRow) continue;
      const c = await ctx.db.get(t.challengeId);
      if (!c) continue;

      shared.push({
        challengeId: c._id,
        title: c.title,
        stakeAmount: t.stakeAmount,
        endsAt: c.endsAt,
        meStatus: myRow.status,
        themStatus: t.status,
      });

      if (myRow.status === 'active' || t.status === 'active') openCount += 1;
      if (myRow.status === 'won' && t.status === 'forfeit') {
        meWon += 1;
        netToMe += t.stakeAmount;
      }
      if (myRow.status === 'forfeit' && t.status === 'won') {
        themWon += 1;
        netToMe -= myRow.stakeAmount;
      }
    }

    // Most-recent first.
    shared.sort((a, b) => b.endsAt - a.endsAt);

    return { meWon, themWon, openCount, netToMe, shared };
  },
});

// Per-friend, per-stake breakdown for the friends progress hub. When
// `friendId` is set, returns just that friend; otherwise loads every
// friend's active stakes in parallel. Stake math (progress, ratio,
// hoursLeft, atRisk, ahead) mirrors `progressNow` so the strip and the
// detail page agree on whether someone's slipping.
export const progressDetail = query({
  args: { ...personaArgs, friendId: v.optional(v.id('profiles')) },
  handler: async (ctx, { personaKey, friendId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return friendId ? null : [];

    const friendIds: Id<'profiles'>[] = friendId
      ? [friendId]
      : (
          await ctx.db
            .query('friendships')
            .withIndex('by_from', (q) => q.eq('fromUserId', me._id))
            .collect()
        ).map((f) => f.toUserId);

    const today = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(today + 'T00:00:00').getTime();
    const now = Date.now();
    const dayFraction = (now - dayStart) / (24 * 60 * 60 * 1000);
    const expected = Math.max(0.1, dayFraction - 0.15);

    const rows = await Promise.all(
      friendIds.map(async (uid) => {
        const friendProfile = await ctx.db.get(uid);
        if (!friendProfile) return null;

        const parts = await ctx.db
          .query('participants')
          .withIndex('by_user_status', (q) =>
            q.eq('userId', uid).eq('status', 'active')
          )
          .collect();
        const challenges = await Promise.all(
          parts.map((p) => ctx.db.get(p.challengeId))
        );
        const pairs = parts
          .map((p, i) => ({ p, c: challenges[i] }))
          .filter(
            (
              x
            ): x is { p: Doc<'participants'>; c: Doc<'challenges'> } => !!x.c
          )
          .sort((a, b) => a.c.endsAt - b.c.endsAt);

        const stakes = await Promise.all(
          pairs.map(async ({ p, c }) => {
            const snapshot = await computeProgressSnapshot(ctx, c, p);
            const whatsLeft = await computeWhatsLeft(ctx, c, p);
            const activity = getActivity(c.activityKey);
            const hoursLeft = (c.endsAt - now) / 3_600_000;
            const isPaceTracked =
              activity.goalKind === 'count' || activity.goalKind === 'distance';
            const atRisk =
              isPaceTracked && snapshot.ratio < expected && snapshot.ratio < 1;
            const ahead = snapshot.ratio >= 1;
            return {
              challengeId: c._id,
              title: c.title,
              activityKey: c.activityKey ?? 'steps',
              betShape: c.betShape ?? 'solo',
              stakeAmount: p.stakeAmount,
              goal: snapshot.goal,
              progress: snapshot.progress,
              progressRatio: snapshot.ratio,
              hoursLeft,
              atRisk,
              ahead,
              whatsLeft,
            };
          })
        );

        return {
          friendProfile: {
            profileId: friendProfile._id,
            displayName: friendProfile.displayName ?? null,
            username: friendProfile.username ?? null,
          },
          stakes,
        };
      })
    );

    const filtered = rows.filter(<T,>(x: T | null): x is T => x !== null);
    return friendId ? (filtered[0] ?? null) : filtered;
  },
});

// Chronological friend-activity feed. Single page; cursor is a createdAt
// epoch upper bound (exclusive), so paging is "older than this".
export const activityFeed = query({
  args: {
    ...personaArgs,
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { personaKey, limit, cursor }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return { items: [], nextCursor: null as number | null };
    const take = Math.min(100, Math.max(1, limit ?? 30));

    let q = ctx.db
      .query('friendEvents')
      .withIndex('by_viewer_created', (qq) => qq.eq('viewerUserId', me._id))
      .order('desc');
    if (cursor != null) {
      q = ctx.db
        .query('friendEvents')
        .withIndex('by_viewer_created', (qq) =>
          qq.eq('viewerUserId', me._id).lt('createdAt', cursor)
        )
        .order('desc');
    }
    const rows = await q.take(take);

    const items = await Promise.all(
      rows.map(async (r) => {
        const actor = await ctx.db.get(r.actorUserId);
        return {
          ...r,
          actorProfile: actor
            ? {
                profileId: actor._id,
                displayName: actor.displayName ?? null,
                username: actor.username ?? null,
              }
            : null,
        };
      })
    );

    const nextCursor =
      rows.length === take ? rows[rows.length - 1].createdAt : null;
    return { items, nextCursor };
  },
});

// Side-by-side snapshot for a single h2h challenge. Renders the "you vs
// them" panel on the friend detail screen — the caller doesn't have to
// be a participant; for shared-but-not-mine h2h bets we still surface
// the two sides via subject/opponent labels.
export const h2hProgressSnapshot = query({
  args: { ...personaArgs, challengeId: v.id('challenges') },
  handler: async (ctx, { personaKey, challengeId }) => {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) return null;
    if (challenge.betShape !== 'h2h') return null;

    const parts = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', challengeId))
      .collect();
    if (parts.length < 2) return null;

    const me = await ensureProfileQuery(ctx, personaKey);
    const myRow = me ? parts.find((p) => p.userId === me._id) : undefined;
    const [aPart, bPart] = myRow
      ? [myRow, parts.find((p) => p.userId !== me!._id)!]
      : [parts[0], parts[1]];

    const [aProfile, bProfile] = await Promise.all([
      ctx.db.get(aPart.userId),
      ctx.db.get(bPart.userId),
    ]);
    const [aSnap, bSnap] = await Promise.all([
      computeProgressSnapshot(ctx, challenge, aPart),
      computeProgressSnapshot(ctx, challenge, bPart),
    ]);

    const leader: 'me' | 'them' | 'tied' =
      aSnap.ratio === bSnap.ratio
        ? 'tied'
        : aSnap.ratio > bSnap.ratio
          ? 'me'
          : 'them';

    const profileShape = (u: Doc<'profiles'> | null) =>
      u
        ? {
            profileId: u._id,
            displayName: u.displayName ?? null,
            username: u.username ?? null,
          }
        : null;

    return {
      me: {
        profile: profileShape(aProfile),
        progress: aSnap.progress,
        goal: aSnap.goal,
        ratio: aSnap.ratio,
      },
      opponent: {
        profile: profileShape(bProfile),
        progress: bSnap.progress,
        goal: bSnap.goal,
        ratio: bSnap.ratio,
      },
      endsAt: challenge.endsAt,
      leader,
    };
  },
});

// Friend-network leaderboard by net $ won/forfeited within a timeframe.
// 'weekly' = last 7d of bet endsAt, 'monthly' = 30d, 'all' = no cutoff.
// Caller is always included so they see their own rank in-place.
export const leaderboard = query({
  args: {
    ...personaArgs,
    activityKey: v.optional(v.string()),
    timeframe: v.union(
      v.literal('weekly'),
      v.literal('monthly'),
      v.literal('all')
    ),
  },
  handler: async (ctx, { personaKey, activityKey, timeframe }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];

    const cutoff =
      timeframe === 'weekly'
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : timeframe === 'monthly'
          ? Date.now() - 30 * 24 * 60 * 60 * 1000
          : 0;

    const friendships = await ctx.db
      .query('friendships')
      .withIndex('by_from', (q) => q.eq('fromUserId', me._id))
      .collect();
    const userIds: Id<'profiles'>[] = [me._id, ...friendships.map((f) => f.toUserId)];

    const rows = await Promise.all(
      userIds.map(async (uid) => {
        const profile = await ctx.db.get(uid);
        if (!profile) return null;
        const ps = await ctx.db
          .query('participants')
          .withIndex('by_user', (q) => q.eq('userId', uid))
          .collect();

        let won = 0;
        let forfeited = 0;
        let stakesSettled = 0;
        for (const p of ps) {
          if (p.status !== 'won' && p.status !== 'forfeit') continue;
          const c = await ctx.db.get(p.challengeId);
          if (!c) continue;
          if (c.endsAt < cutoff) continue;
          if (activityKey && (c.activityKey ?? 'steps') !== activityKey) continue;
          if (p.status === 'won') won += p.stakeAmount;
          else forfeited += p.stakeAmount;
          stakesSettled += 1;
        }
        return {
          profile: {
            profileId: profile._id,
            displayName: profile.displayName ?? null,
            username: profile.username ?? null,
          },
          won,
          forfeited,
          net: won - forfeited,
          stakesSettled,
          isMe: uid === me._id,
        };
      })
    );

    return rows
      .filter(<T,>(x: T | null): x is T => x !== null)
      .sort((a, b) => b.net - a.net);
  },
});

// Used by createBet to enforce the "naysayer is friends-only" rule.
export async function isFriendOf(
  ctx: { db: { query: any } },
  fromUserId: any,
  toUserId: any
): Promise<boolean> {
  const row = await ctx.db
    .query('friendships')
    .withIndex('by_from', (qq: any) => qq.eq('fromUserId', fromUserId))
    .filter((qq: any) => qq.eq(qq.field('toUserId'), toUserId))
    .first();
  return !!row;
}
