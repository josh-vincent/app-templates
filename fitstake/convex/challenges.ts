import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, mutation, query } from './_generated/server';
import { emitFriendEvent } from './friendEvents';
import { isFriendOf } from './friends';
import { schedulePushForUsers } from './notifications';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';
import { applyDelta, recordTx } from './wallet';

const DAY_MS = 24 * 60 * 60 * 1000;

// New entries must arrive at least JOIN_LOCK_MS before the bet's deadline.
// Stops late piling-on where someone watches the doer fall short and
// rushes in with a sure-win naysayer / under stake. Sub-day bets clamp
// to the start time so the rule still does the right thing on intra-day
// challenges (you have to commit at the start or not at all).
const JOIN_LOCK_MS = 24 * 60 * 60 * 1000;

function joinClosesAt(c: { startsAt: number; endsAt: number }): number {
  return Math.max(c.startsAt, c.endsAt - JOIN_LOCK_MS);
}

function joinLockReason(c: { startsAt: number; endsAt: number; durationDays: number }): string {
  const closesAt = joinClosesAt(c);
  const now = Date.now();
  if (now > closesAt) {
    if (c.durationDays >= 1) {
      return 'Closed to new bets — last 24h.';
    }
    return 'Closed to new bets — the window has shut.';
  }
  return '';
}

export const listOpen = query({
  args: { ...personaArgs },
  handler: async (ctx, _args) => {
    const rows = await ctx.db
      .query('challenges')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .order('desc')
      .take(50);
    return Promise.all(
      rows.map(async (c) => ({
        ...c,
        participantCount: (
          await ctx.db
            .query('participants')
            .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
            .collect()
        ).length,
      }))
    );
  },
});

export const discover = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return { friends: [], market: [] };

    const [friendships, myParticipants, openRows] = await Promise.all([
      ctx.db
        .query('friendships')
        .withIndex('by_from', (q) => q.eq('fromUserId', me._id))
        .collect(),
      ctx.db
        .query('participants')
        .withIndex('by_user', (q) => q.eq('userId', me._id))
        .collect(),
      ctx.db
        .query('challenges')
        .withIndex('by_status', (q) => q.eq('status', 'open'))
        .order('desc')
        .take(50),
    ]);

    const friendIds = new Set(friendships.map((f) => f.toUserId));
    const joinedChallengeIds = new Set(myParticipants.map((p) => p.challengeId));
    const candidates = openRows.filter(
      (c) => c.creatorId !== me._id && !joinedChallengeIds.has(c._id)
    );

    const rows = await Promise.all(
      candidates.map(async (c) => {
        const [creator, participants] = await Promise.all([
          ctx.db.get(c.creatorId),
          ctx.db
            .query('participants')
            .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
            .collect(),
        ]);
        const participantProfiles = await Promise.all(
          participants.slice(0, 3).map((p) => ctx.db.get(p.userId))
        );
        return {
          ...c,
          creatorDisplayName: creator?.displayName ?? 'Someone',
          isFriend: friendIds.has(c.creatorId),
          participantCount: participants.length,
          participantNames: participantProfiles
            .map((p) => p?.displayName ?? null)
            .filter(<T>(x: T | null): x is T => x !== null),
        };
      })
    );

    const friends = rows
      .filter((r) => r.isFriend)
      .sort((a, b) => a.endsAt - b.endsAt)
      .slice(0, 6);
    const market = rows
      .filter((r) => !r.isFriend)
      .sort((a, b) => b.stakeAmount - a.stakeAmount || a.endsAt - b.endsAt)
      .slice(0, 6);

    return { friends, market };
  },
});

export const myActive = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    return await activeForUserInternal(ctx, me._id);
  },
});

// Friend-scoped variant: list a specific user's active bets. Used by the
// friend detail screen.
export const activeForUser = query({
  args: { ...personaArgs, userId: v.id('profiles') },
  handler: async (ctx, { userId }) => {
    return await activeForUserInternal(ctx, userId);
  },
});

async function activeForUserInternal(
  ctx: any,
  userId: Id<'profiles'>
): Promise<Doc<'challenges'>[]> {
  const ps = await ctx.db
    .query('participants')
    .withIndex('by_user_status', (q: any) =>
      q.eq('userId', userId).eq('status', 'active')
    )
    .collect();
  const challenges = await Promise.all(
    ps.map((p: Doc<'participants'>) => ctx.db.get(p.challengeId))
  );
  return challenges.filter((c: any): c is Doc<'challenges'> => !!c);
}

// Settlements (won/forfeit) whose underlying challenge ended within the last
// ~36h. Backs the "yesterday strip" on Home.
export const myRecentSettlements = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    return await recentSettlementsForUserInternal(ctx, me._id, 36 * 60 * 60 * 1000);
  },
});

// Friend-scoped variant: any user's last settled bets within `horizonMs`.
// Used by the friend detail screen's HISTORY section. Default horizon 14
// days so we get more than the home-screen yesterday-strip window.
export const recentSettlementsForUser = query({
  args: {
    ...personaArgs,
    userId: v.id('profiles'),
    horizonMs: v.optional(v.number()),
  },
  handler: async (ctx, { userId, horizonMs }) => {
    return await recentSettlementsForUserInternal(
      ctx,
      userId,
      horizonMs ?? 14 * 24 * 60 * 60 * 1000
    );
  },
});

async function recentSettlementsForUserInternal(
  ctx: any,
  userId: Id<'profiles'>,
  horizonMs: number
) {
  const cutoff = Date.now() - horizonMs;
  const ps = await ctx.db
    .query('participants')
    .withIndex('by_user', (q: any) => q.eq('userId', userId))
    .collect();
  const settled = ps.filter(
    (p: Doc<'participants'>) => p.status === 'won' || p.status === 'forfeit'
  );
  const rows = await Promise.all(
    settled.map(async (p: Doc<'participants'>) => {
      const c = await ctx.db.get(p.challengeId);
      if (!c) return null;
      if (c.endsAt < cutoff) return null;
      return {
        participantId: p._id,
        status: p.status as 'won' | 'forfeit',
        stakeAmount: p.stakeAmount,
        finalSteps: p.finalSteps ?? null,
        challengeTitle: c.title,
        activityKey: c.activityKey ?? 'steps',
        stepGoal: c.stepGoal,
        endsAt: c.endsAt,
      };
    })
  );
  return rows.filter(<T,>(x: T | null): x is T => x !== null);
}

// Lightweight participant lookup that joins through to the challenge so the
// proof screen can render the correct activity context. Includes the bet
// window so the client can decide when to stop background tracking.
export const getParticipant = query({
  args: { ...personaArgs, id: v.id('participants') },
  handler: async (ctx, { id }) => {
    const p = await ctx.db.get(id);
    if (!p) return null;
    const c = await ctx.db.get(p.challengeId);
    if (!c) return null;
    return {
      participant: p,
      challenge: c,
      activityKey: c.activityKey ?? 'steps',
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    };
  },
});

export const get = query({
  args: { ...personaArgs, id: v.id('challenges') },
  handler: async (ctx, { personaKey, id }) => {
    const c = await ctx.db.get(id);
    if (!c) return null;
    const me = await ensureProfileQuery(ctx, personaKey);
    const ps = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', id))
      .collect();

    // For sensor-tracked step bets, compute each participant's progress
    // for today so the detail UI can render a live ring per person. We
    // also keep finalSteps (set on settlement) as the source of truth for
    // settled bets — when both are present, finalSteps wins.
    const isStepBet = (c.activityKey ?? 'steps') === 'steps';
    const todayISO = new Date().toISOString().slice(0, 10);

    const participants = await Promise.all(
      ps.map(async (p) => {
        const u = await ctx.db.get(p.userId);
        const proofs = await ctx.db
          .query('proofs')
          .withIndex('by_participant', (q) => q.eq('participantId', p._id))
          .collect();

        let todaySteps = 0;
        if (isStepBet) {
          const entry = await ctx.db
            .query('stepEntries')
            .withIndex('by_user_date', (q) =>
              q.eq('userId', p.userId).eq('date', todayISO)
            )
            .filter((q) => q.eq(q.field('challengeId'), id))
            .first();
          todaySteps = entry?.steps ?? 0;
        }

        const liveProgress =
          p.finalSteps != null && p.finalSteps > 0 ? p.finalSteps : todaySteps;
        const ratio =
          isStepBet && c.stepGoal > 0
            ? Math.min(1, liveProgress / c.stepGoal)
            : 0;

        return {
          ...p,
          displayName: u?.displayName ?? null,
          username: u?.username ?? null,
          proofCount: proofs.length,
          latestProofStatus:
            proofs.sort((a, b) => b.submittedAt - a.submittedAt)[0]?.status ?? null,
          isMe: me ? p.userId === me._id : false,
          // New live fields
          liveProgress,
          progressRatio: ratio,
          isStepBet,
        };
      })
    );
    // Expose the join-lock deadline so the UI can render a countdown
    // chip + disable counter-stake CTAs once it's passed. Mirrors the
    // server-side rule enforced in join + takeSide.
    return { ...c, participants, joinClosesAt: joinClosesAt(c) };
  },
});

// Unified create. Dispatches by shape:
//   solo     — creator stakes, joins, opens for others (or stays solo).
//   h2h      — creator stakes, sends an invite link (counterparty joins via accept).
//   market   — creator posts a claim about subjectUserId; others take over/under.
//   naysayer — friends-only "I bet you don't"; subject auto-stakes; friends
//              counter-stake to the other side.
export const createBet = mutation({
  args: {
    ...personaArgs,
    title: v.string(),
    activityKey: v.string(),
    goal: v.number(),
    stakeAmount: v.number(),
    durationDays: v.number(),
    betShape: v.optional(
      v.union(
        v.literal('solo'),
        v.literal('h2h'),
        v.literal('market'),
        v.literal('naysayer')
      )
    ),
    marketLine: v.optional(v.number()),
    side: v.optional(v.union(v.literal('over'), v.literal('under'))),
    poolScope: v.optional(
      v.union(
        v.literal('global'),
        v.literal('region'),
        v.literal('friends')
      )
    ),
    // h2h: when set, inserts a pending participant row for the invitee and
    // emits an h2h_invite event addressed only to them. They flip to active
    // by calling `join` with this challenge id.
    inviteUserId: v.optional(v.id('profiles')),
  },
  handler: async (
    ctx,
    {
      personaKey,
      title,
      activityKey,
      goal,
      stakeAmount,
      durationDays,
      betShape,
      marketLine,
      side,
      poolScope,
      inviteUserId,
    }
  ) => {
    if (stakeAmount <= 0 || stakeAmount > 500) {
      throw new Error('Stake must be between $1 and $500.');
    }
    if (goal <= 0) throw new Error('Goal must be positive.');
    if (durationDays < 1 || durationDays > 90) {
      throw new Error('Duration out of range (1–90 days).');
    }
    const shape = betShape ?? 'solo';
    if (shape === 'market' && marketLine == null) {
      throw new Error('Market bets need a line.');
    }
    if (shape === 'market' && !side) {
      throw new Error('Pick a side (over/under) when posting a market bet.');
    }

    const me = await ensureProfile(ctx, personaKey);
    if (me.walletBalance < stakeAmount) {
      throw new Error('Insufficient wallet balance.');
    }

    const startsAt = Date.now();
    const endsAt = startsAt + durationDays * DAY_MS;

    const id = await ctx.db.insert('challenges', {
      creatorId: me._id,
      title,
      activityKey,
      stepGoal: goal,
      stakeAmount,
      durationDays,
      startsAt,
      endsAt,
      status: 'open',
      betShape: shape,
      marketLine,
      // Subject is the goal-doer for both market and naysayer shapes.
      subjectUserId:
        shape === 'market' || shape === 'naysayer' ? me._id : undefined,
      poolScope: poolScope ?? 'global',
    });

    // Creator stakes. Naysayer creators are also tagged with role='subject'
    // so settle and the UI can dispatch correctly.
    await applyDelta(ctx, me, -stakeAmount);
    await recordTx(ctx, me._id, 'stake', -stakeAmount, id);
    const creatorPartId = await ctx.db.insert('participants', {
      challengeId: id,
      userId: me._id,
      stakeAmount,
      stakedAt: startsAt,
      status: 'active',
      side: shape === 'market' ? side : undefined,
      role: shape === 'naysayer' ? 'subject' : undefined,
    });

    await emitFriendEvent(ctx, {
      actorUserId: me._id,
      kind: 'stake_started',
      challengeId: id,
      participantId: creatorPartId,
      payload: { stakeTitle: title, stakeAmount, activityKey },
    });

    // h2h pending invite. Inserts a participant row in `pending` so the
    // invitee accepts via `join` (which flips it to active). h2h_invite
    // push goes only to the invitee.
    if (shape === 'h2h' && inviteUserId && inviteUserId !== me._id) {
      const pendingId = await ctx.db.insert('participants', {
        challengeId: id,
        userId: inviteUserId,
        stakeAmount,
        stakedAt: startsAt,
        status: 'pending',
      });
      await emitFriendEvent(ctx, {
        actorUserId: me._id,
        kind: 'h2h_invite',
        challengeId: id,
        participantId: pendingId,
        audience: [inviteUserId],
        payload: { stakeTitle: title, stakeAmount, activityKey },
      });
    }

    return id;
  },
});

// Legacy create — preserved so older callers (steps-only quick create)
// keep compiling. Internally just defers to createBet.
export const create = mutation({
  args: {
    ...personaArgs,
    title: v.string(),
    stepGoal: v.number(),
    stakeAmount: v.number(),
    durationDays: v.number(),
  },
  handler: async (ctx, { personaKey, title, stepGoal, stakeAmount, durationDays }) => {
    if (stepGoal < 1_000) throw new Error('Step goal too low.');
    return await createBetInternal(ctx, {
      personaKey,
      title,
      activityKey: 'steps',
      goal: stepGoal,
      stakeAmount,
      durationDays,
      betShape: 'solo',
    });
  },
});

export const join = mutation({
  args: { ...personaArgs, id: v.id('challenges') },
  handler: async (ctx, { personaKey, id }) => {
    const c = await ctx.db.get(id);
    if (!c) throw new Error('Bet not found.');
    if (c.status !== 'open') throw new Error('Bet is not open.');

    // Enforce the 24h-before-end join lock. Allow h2h invitee accepts
    // (existing.status === 'pending') to bypass since they were already
    // committed to before the lock window — but only if the bet hasn't
    // already settled past endsAt.
    const me = await ensureProfile(ctx, personaKey);
    const closesAt = joinClosesAt(c);
    const now = Date.now();
    const existingForLock = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', id))
      .filter((q) => q.eq(q.field('userId'), me._id))
      .first();
    const isInviteAccept = existingForLock?.status === 'pending';
    if (!isInviteAccept && now > closesAt) {
      throw new Error(joinLockReason(c));
    }

    const existing = existingForLock;
    if (existing && existing.status !== 'pending') {
      throw new Error('Already in this bet.');
    }
    if (me.walletBalance < c.stakeAmount) {
      throw new Error('Insufficient wallet balance.');
    }

    // Naysayer joiners must be friends of the subject. Subject can never join
    // their own naysayer bet (they're already auto-staked as the subject).
    if (c.betShape === 'naysayer') {
      if (c.creatorId === me._id) {
        throw new Error("You can't naysay your own bet.");
      }
      const friend = await isFriendOf(ctx, c.creatorId, me._id);
      if (!friend) {
        throw new Error('Naysayer bets are friends-only.');
      }
    }

    let joinedParticipantId: Id<'participants'>;
    if (existing && existing.status === 'pending') {
      // h2h accept-invite path.
      await applyDelta(ctx, me, -c.stakeAmount);
      await recordTx(ctx, me._id, 'stake', -c.stakeAmount, id);
      await ctx.db.patch(existing._id, { status: 'active', stakedAt: Date.now() });
      joinedParticipantId = existing._id;
    } else {
      await applyDelta(ctx, me, -c.stakeAmount);
      await recordTx(ctx, me._id, 'stake', -c.stakeAmount, id);
      joinedParticipantId = await ctx.db.insert('participants', {
        challengeId: id,
        userId: me._id,
        stakeAmount: c.stakeAmount,
        stakedAt: Date.now(),
        status: 'active',
        role: c.betShape === 'naysayer' ? 'naysayer' : undefined,
      });
    }

    await emitFriendEvent(ctx, {
      actorUserId: me._id,
      kind: 'stake_started',
      challengeId: id,
      participantId: joinedParticipantId,
      payload: {
        stakeTitle: c.title,
        stakeAmount: c.stakeAmount,
        activityKey: c.activityKey ?? 'steps',
      },
    });

    // Push: tell the bet's creator someone joined. Skip if I am the creator.
    if (c.creatorId !== me._id) {
      const body =
        c.betShape === 'naysayer'
          ? `${me.displayName ?? 'A friend'} bet $${c.stakeAmount} against you on ${c.title}`
          : `${me.displayName ?? 'Someone'} joined your $${c.stakeAmount} bet`;
      await schedulePushForUsers(ctx, [c.creatorId], {
        title: c.title,
        body,
        data: { betId: id },
      });
    }
    return null;
  },
});

// Take a side on an existing market bet.
export const takeSide = mutation({
  args: {
    ...personaArgs,
    id: v.id('challenges'),
    side: v.union(v.literal('over'), v.literal('under')),
  },
  handler: async (ctx, { personaKey, id, side }) => {
    const c = await ctx.db.get(id);
    if (!c) throw new Error('Bet not found.');
    if (c.betShape !== 'market') throw new Error('Not a market bet.');
    if (c.status !== 'open' && c.status !== 'running') {
      throw new Error('Market is closed.');
    }
    // Same 24h-before-end lock as `join`. Stops late piling-on after the
    // doer's pace is obvious.
    if (Date.now() > joinClosesAt(c)) {
      throw new Error(joinLockReason(c));
    }
    const me = await ensureProfile(ctx, personaKey);
    if (me.walletBalance < c.stakeAmount) {
      throw new Error('Insufficient wallet balance.');
    }
    const existing = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', id))
      .filter((q) => q.eq(q.field('userId'), me._id))
      .first();
    if (existing) throw new Error("You've already taken a side.");

    await applyDelta(ctx, me, -c.stakeAmount);
    await recordTx(ctx, me._id, 'stake', -c.stakeAmount, id);
    const sidePartId = await ctx.db.insert('participants', {
      challengeId: id,
      userId: me._id,
      stakeAmount: c.stakeAmount,
      stakedAt: Date.now(),
      status: 'active',
      side,
    });

    await emitFriendEvent(ctx, {
      actorUserId: me._id,
      kind: 'stake_started',
      challengeId: id,
      participantId: sidePartId,
      payload: {
        stakeTitle: c.title,
        stakeAmount: c.stakeAmount,
        activityKey: c.activityKey ?? 'steps',
      },
    });

    // Push: tell every other current taker that the line moved.
    const others = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', id))
      .collect();
    const recipients = others
      .filter((p) => p.userId !== me._id && p.status === 'active')
      .map((p) => p.userId);
    if (recipients.length > 0) {
      await schedulePushForUsers(ctx, recipients, {
        title: c.title,
        body: `${me.displayName ?? 'Someone'} took the ${side.toUpperCase()} on ${c.marketLine}`,
        data: { betId: id },
      });
    }
    return null;
  },
});

// Shadow-naysayer attach. Lets a friend stake against ANY running friend
// bet — solo, naysayer, or otherwise — by inserting a naysayer
// participant row at parity with the subject's stake. If the bet was
// originally a solo, the creator's existing row is upgraded to
// role='subject' so settle dispatch routes through the naysayer pot
// instead of the regular solo path.
//
// Same friendship + status guards as join. Idempotent: returns null if
// the caller already has a participant row on the bet.
export const stakeAgainst = mutation({
  args: { ...personaArgs, id: v.id('challenges') },
  handler: async (ctx, { personaKey, id }) => {
    const c = await ctx.db.get(id);
    if (!c) throw new Error('Bet not found.');
    if (c.status !== 'open' && c.status !== 'running') {
      throw new Error('This bet has already settled.');
    }
    // stakeAgainst is the "shadow naysayer" path — by design, you can take
    // the under up until the bet actually ends. The 24h join lock used by
    // join/takeSide doesn't apply here; that lock exists to prevent late
    // piling-on after the doer's pace is obvious, but the entire point of
    // shadow naysayer is to react to that pace. Sub-day demo bets would
    // otherwise be uncountable since their endsAt is < 24h from now.
    if (Date.now() >= c.endsAt) {
      throw new Error('This bet has already ended.');
    }

    const me = await ensureProfile(ctx, personaKey);
    const subjectId = c.subjectUserId ?? c.creatorId;
    if (subjectId === me._id) {
      throw new Error("You can't bet against yourself.");
    }

    // Friendship guard mirrors the naysayer rule. Both directions count.
    const friend = await isFriendOf(ctx, subjectId, me._id);
    if (!friend) {
      throw new Error("You're not friends with this player.");
    }

    if (me.walletBalance < c.stakeAmount) {
      throw new Error('Insufficient wallet balance.');
    }

    const existing = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', id))
      .filter((q) => q.eq(q.field('userId'), me._id))
      .first();
    if (existing) return null;

    // Upgrade the subject's row to role='subject' (idempotent — only
    // patches when role is missing). Solo bets created before shadow
    // naysayer existed have no role tag.
    const subjectPart = await ctx.db
      .query('participants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', id))
      .filter((q) => q.eq(q.field('userId'), subjectId))
      .first();
    if (subjectPart && !subjectPart.role) {
      await ctx.db.patch(subjectPart._id, { role: 'subject' });
    }

    await applyDelta(ctx, me, -c.stakeAmount);
    await recordTx(ctx, me._id, 'stake', -c.stakeAmount, id);
    const nayPartId = await ctx.db.insert('participants', {
      challengeId: id,
      userId: me._id,
      stakeAmount: c.stakeAmount,
      stakedAt: Date.now(),
      status: 'active',
      role: 'naysayer',
    });

    await emitFriendEvent(ctx, {
      actorUserId: me._id,
      kind: 'stake_started',
      challengeId: id,
      participantId: nayPartId,
      payload: {
        stakeTitle: c.title,
        stakeAmount: c.stakeAmount,
        activityKey: c.activityKey ?? 'steps',
      },
    });

    await schedulePushForUsers(ctx, [subjectId], {
      title: c.title,
      body: `${me.displayName ?? 'A friend'} bet $${c.stakeAmount} you won't make it`,
      data: { betId: id },
    });

    return null;
  },
});

// Generate a one-shot upload URL the proof screen POSTs an image to.
// Convex returns a storageId that we attach to the proof row.
export const generateUploadUrl = mutation({
  args: { ...personaArgs },
  handler: async (ctx, _args) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Submit proof for a participant (the caller's row only).
//
// Two GPS sources are accepted:
//   gpsLat/Lng       — device's current fix at submit
//   photoExifLat/Lng — coordinates parsed from the chosen photo's EXIF
// Both are independently optional. photoTakenAt is the EXIF DateTimeOriginal
// converted to epoch ms, which lets disputes verify the photo was taken
// inside the bet window.
export const submitProof = mutation({
  args: {
    ...personaArgs,
    participantId: v.id('participants'),
    imageStorageId: v.optional(v.id('_storage')),
    // New: multiple photos per check-in. First image is also written to
    // imageStorageId for back-compat with readers that haven't been updated.
    imageStorageIds: v.optional(v.array(v.id('_storage'))),
    scorecardStorageId: v.optional(v.id('_storage')),
    gpsLat: v.optional(v.number()),
    gpsLng: v.optional(v.number()),
    photoExifLat: v.optional(v.number()),
    photoExifLng: v.optional(v.number()),
    photoTakenAt: v.optional(v.number()),
    claimedValue: v.optional(v.number()),
    note: v.optional(v.string()),
    // Multi-session bets: which calendar day this proof covers. If
    // omitted, defaults to today in UTC. Duplicates per (participant,
    // forDate) overwrite by updating the existing row, so re-submitting
    // for the same day doesn't pad the session count.
    forDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await ensureProfile(ctx, args.personaKey);
    const p = await ctx.db.get(args.participantId);
    if (!p) throw new Error('Participant not found.');
    if (p.userId !== me._id) throw new Error('Not your row.');

    // Normalise the photo set: imageStorageIds[] is canonical, but write
    // the first one to imageStorageId for back-compat readers.
    const imageStorageIds =
      args.imageStorageIds && args.imageStorageIds.length > 0
        ? args.imageStorageIds
        : args.imageStorageId
          ? [args.imageStorageId]
          : undefined;
    const primaryImage =
      imageStorageIds && imageStorageIds.length > 0 ? imageStorageIds[0] : undefined;

    // forDate defaults to today in UTC ('YYYY-MM-DD'). Settlement reads
    // distinct forDate values to count sessions, so a stable string is
    // enough.
    const forDate = args.forDate ?? new Date().toISOString().slice(0, 10);

    // Compute session index = ordinal of this date among all distinct
    // dates already covered by non-disputed check-ins.
    const existing = await ctx.db
      .query('proofs')
      .withIndex('by_participant', (q) => q.eq('participantId', p._id))
      .collect();
    const sameDay = existing.find((row) => row.forDate === forDate);
    const distinctDates = new Set(
      existing
        .filter((row) => row.forDate && row.status !== 'disputed')
        .map((row) => row.forDate!)
    );
    if (!sameDay && !distinctDates.has(forDate)) distinctDates.add(forDate);
    const sessionIndex = Array.from(distinctDates).sort().indexOf(forDate) + 1;

    if (sameDay) {
      await ctx.db.patch(sameDay._id, {
        submittedAt: Date.now(),
        imageStorageId: primaryImage ?? sameDay.imageStorageId,
        imageStorageIds: imageStorageIds ?? sameDay.imageStorageIds,
        scorecardStorageId: args.scorecardStorageId ?? sameDay.scorecardStorageId,
        gpsLat: args.gpsLat ?? sameDay.gpsLat,
        gpsLng: args.gpsLng ?? sameDay.gpsLng,
        photoExifLat: args.photoExifLat ?? sameDay.photoExifLat,
        photoExifLng: args.photoExifLng ?? sameDay.photoExifLng,
        photoTakenAt: args.photoTakenAt ?? sameDay.photoTakenAt,
        claimedValue: args.claimedValue ?? sameDay.claimedValue,
        note: args.note ?? sameDay.note,
        // Re-submitting clears a prior dispute back to submitted.
        status: 'submitted',
        // If a user check-in updates a previously-derived row, drop the flag.
        derivedFromPings: false,
        sessionIndex,
      });
    } else {
      await ctx.db.insert('proofs', {
        participantId: p._id,
        challengeId: p.challengeId,
        submittedAt: Date.now(),
        imageStorageId: primaryImage,
        imageStorageIds,
        scorecardStorageId: args.scorecardStorageId,
        gpsLat: args.gpsLat,
        gpsLng: args.gpsLng,
        photoExifLat: args.photoExifLat,
        photoExifLng: args.photoExifLng,
        photoTakenAt: args.photoTakenAt,
        claimedValue: args.claimedValue,
        note: args.note,
        status: 'submitted',
        forDate,
        sessionIndex,
        derivedFromPings: false,
      });
    }

    // Push: tell other active participants (the counterparty / market takers).
    const c = await ctx.db.get(p.challengeId);
    if (c) {
      const others = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', p.challengeId))
        .collect();
      const recipients = others
        .filter((other) => other.userId !== me._id && other.status === 'active')
        .map((other) => other.userId);
      if (recipients.length > 0) {
        await schedulePushForUsers(ctx, recipients, {
          title: c.title,
          body: `${me.displayName ?? 'Someone'} submitted proof`,
          data: { betId: p.challengeId },
        });
      }

      // Friend stream: session_completed once a forDate-bearing non-disputed
      // proof exists. Counts distinct dates post-write; latched per date.
      if (p.status === 'active') {
        const refreshedProofs = await ctx.db
          .query('proofs')
          .withIndex('by_participant', (q) => q.eq('participantId', p._id))
          .collect();
        const progress = new Set(
          refreshedProofs
            .filter((row) => row.status !== 'disputed' && row.forDate)
            .map((row) => row.forDate!)
        ).size;
        const hoursLeft = (c.endsAt - Date.now()) / 3_600_000;
        await emitFriendEvent(ctx, {
          actorUserId: me._id,
          kind: 'session_completed',
          challengeId: c._id,
          participantId: p._id,
          payload: {
            stakeTitle: c.title,
            stakeAmount: p.stakeAmount,
            activityKey: c.activityKey ?? 'steps',
            progress,
            goal: c.stepGoal,
            hoursLeft,
          },
          latchKey: 'session_completed:' + forDate,
        });
      }
    }
    return null;
  },
});

// Counterparty acknowledges or disputes a submitted proof.
export const reviewProof = mutation({
  args: {
    ...personaArgs,
    proofId: v.id('proofs'),
    decision: v.union(v.literal('acknowledged'), v.literal('disputed')),
  },
  handler: async (ctx, { personaKey, proofId, decision }) => {
    const me = await ensureProfile(ctx, personaKey);
    const proof = await ctx.db.get(proofId);
    if (!proof) throw new Error('Proof not found.');
    const submitter = await ctx.db.get(proof.participantId);
    if (!submitter) throw new Error('Submitter row gone.');
    if (submitter.userId === me._id) {
      throw new Error("You can't review your own proof.");
    }
    await ctx.db.patch(proofId, { status: decision });

    // Push: tell the proof submitter the decision.
    const c = await ctx.db.get(proof.challengeId);
    if (c) {
      await schedulePushForUsers(ctx, [submitter.userId], {
        title: c.title,
        body:
          decision === 'acknowledged'
            ? 'Proof acknowledged'
            : 'Proof disputed',
        data: { betId: proof.challengeId },
      });
    }
    return null;
  },
});

// Internal helper used by both create and createBet.
async function createBetInternal(
  ctx: MutationCtx,
  args: {
    personaKey?: string;
    title: string;
    activityKey: string;
    goal: number;
    stakeAmount: number;
    durationDays: number;
    betShape: 'solo' | 'h2h' | 'market';
    marketLine?: number;
    side?: 'over' | 'under';
  }
): Promise<Id<'challenges'>> {
  if (args.stakeAmount <= 0 || args.stakeAmount > 500) {
    throw new Error('Stake must be between $1 and $500.');
  }
  if (args.goal <= 0) throw new Error('Goal must be positive.');
  if (args.durationDays < 1 || args.durationDays > 90) {
    throw new Error('Duration out of range (1–90 days).');
  }
  const me = await ensureProfile(ctx, args.personaKey);
  if (me.walletBalance < args.stakeAmount) {
    throw new Error('Insufficient wallet balance.');
  }
  const startsAt = Date.now();
  const endsAt = startsAt + args.durationDays * DAY_MS;
  const id = await ctx.db.insert('challenges', {
    creatorId: me._id,
    title: args.title,
    activityKey: args.activityKey,
    stepGoal: args.goal,
    stakeAmount: args.stakeAmount,
    durationDays: args.durationDays,
    startsAt,
    endsAt,
    status: 'open',
    betShape: args.betShape,
    marketLine: args.marketLine,
    subjectUserId: args.betShape === 'market' ? me._id : undefined,
  });
  await applyDelta(ctx, me, -args.stakeAmount);
  await recordTx(ctx, me._id, 'stake', -args.stakeAmount, id);
  const partId = await ctx.db.insert('participants', {
    challengeId: id,
    userId: me._id,
    stakeAmount: args.stakeAmount,
    stakedAt: startsAt,
    status: 'active',
    side: args.betShape === 'market' ? args.side : undefined,
  });
  await emitFriendEvent(ctx, {
    actorUserId: me._id,
    kind: 'stake_started',
    challengeId: id,
    participantId: partId,
    payload: {
      stakeTitle: args.title,
      stakeAmount: args.stakeAmount,
      activityKey: args.activityKey,
    },
  });
  return id;
}
