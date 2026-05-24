// Friend activity stream.
//
// Mutations elsewhere call emitFriendEvent(...) to record what an actor did;
// it fans the event out to every friend (one friendEvents row per viewer) and
// schedules a push for viewers who haven't opted out. Throttling (e.g. at_risk
// only fires once per stake per viewer) goes through friendEventLatches.
//
// scanActiveStakesForRisk is the cron entry — every 30 min it sweeps running
// challenges and fires at_risk / time_running_out where due. Wired in crons.ts.

import { getActivity } from '../lib/activities';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { computeProgressSnapshot, computeWhatsLeft } from './lib/whatsLeft';
import { schedulePushForUsers } from './notifications';

export type FriendEventKind =
  | 'stake_started'
  | 'session_completed'
  | 'at_risk'
  | 'just_won'
  | 'just_forfeited'
  | 'time_running_out'
  | 'h2h_invite'
  | 'h2h_overtaken';

// Kinds that schedule a push. In-app feed rows are always written.
const PUSH_KINDS: ReadonlySet<FriendEventKind> = new Set([
  'session_completed',
  'at_risk',
  'just_won',
  'just_forfeited',
  'time_running_out',
  'h2h_invite',
  'h2h_overtaken',
]);

type PushTemplate = (args: {
  actorName: string;
  stakeTitle: string;
  stakeAmount: number;
  hoursLeft: number;
}) => { title: string; body: string };

const PUSH_TEMPLATES: Record<FriendEventKind, PushTemplate> = {
  stake_started: ({ actorName, stakeAmount, stakeTitle }) => ({
    title: 'Friend started a stake',
    body: `${actorName} put $${stakeAmount} on ${stakeTitle}`,
  }),
  session_completed: ({ actorName, stakeTitle }) => ({
    title: 'Friend hit today’s goal',
    body: `${actorName} closed out ${stakeTitle} for today`,
  }),
  at_risk: ({ actorName, stakeTitle, hoursLeft }) => ({
    title: 'Friend stake is slipping',
    body: `${actorName} is behind on ${stakeTitle} — ${Math.max(1, Math.round(hoursLeft))}h left`,
  }),
  just_won: ({ actorName, stakeAmount, stakeTitle }) => ({
    title: 'Friend won',
    body: `${actorName} just won $${stakeAmount} on ${stakeTitle}`,
  }),
  just_forfeited: ({ actorName, stakeAmount, stakeTitle }) => ({
    title: 'Friend forfeited',
    body: `${actorName} forfeited $${stakeAmount} on ${stakeTitle}`,
  }),
  time_running_out: ({ actorName, stakeTitle, hoursLeft }) => ({
    title: 'Friend stake closing soon',
    body: `${actorName}’s ${stakeTitle} ends in ${Math.max(1, Math.round(hoursLeft))}h`,
  }),
  h2h_invite: ({ actorName, stakeAmount }) => ({
    title: 'Head-to-head invite',
    body: `${actorName} put up $${stakeAmount} — accept?`,
  }),
  h2h_overtaken: ({ actorName, stakeTitle }) => ({
    title: 'They passed you',
    body: `${actorName} passed you on ${stakeTitle}`,
  }),
};

async function actorFriendIds(
  ctx: MutationCtx,
  actorUserId: Id<'profiles'>
): Promise<Id<'profiles'>[]> {
  // Friendships are bidirectional pairs (see convex/friends.ts:addFriend).
  // Each actor row's toUserId is a viewer who has the actor as a friend.
  const rows = await ctx.db
    .query('friendships')
    .withIndex('by_from', (q) => q.eq('fromUserId', actorUserId))
    .collect();
  return rows.map((r) => r.toUserId);
}

async function checkAndSetLatch(
  ctx: MutationCtx,
  viewerUserId: Id<'profiles'>,
  challengeId: Id<'challenges'>,
  latchKey: string
): Promise<boolean> {
  const existing = await ctx.db
    .query('friendEventLatches')
    .withIndex('by_viewer_challenge_kind', (q) =>
      q.eq('viewerUserId', viewerUserId).eq('challengeId', challengeId).eq('kind', latchKey)
    )
    .first();
  if (existing) return false;
  await ctx.db.insert('friendEventLatches', {
    viewerUserId,
    challengeId,
    kind: latchKey,
    firedAt: Date.now(),
  });
  return true;
}

export type EmitFriendEventArgs = {
  actorUserId: Id<'profiles'>;
  kind: FriendEventKind;
  challengeId?: Id<'challenges'>;
  participantId?: Id<'participants'>;
  payload?: Record<string, unknown>;
  // Optional explicit audience. Defaults to all actor's friends.
  audience?: Id<'profiles'>[];
  // Throttle: if set, an event of this latchKey per (viewer, challenge) only
  // fires once. For per-day events, embed the date in latchKey (the caller
  // owns the format).
  latchKey?: string;
};

export async function emitFriendEvent(
  ctx: MutationCtx,
  args: EmitFriendEventArgs
): Promise<void> {
  const audience = args.audience ?? (await actorFriendIds(ctx, args.actorUserId));
  if (audience.length === 0) return;

  const actor = await ctx.db.get(args.actorUserId);
  const actorName = actor?.displayName ?? actor?.username ?? 'A friend';

  const eventGroupId = `${args.actorUserId}:${args.kind}:${Date.now()}`;
  const basePayload = {
    actorName,
    ...(args.payload ?? {}),
  };

  // Resolve push template inputs once (used per viewer, but data is the same).
  const pushInputs = {
    actorName,
    stakeTitle: String(args.payload?.stakeTitle ?? 'a stake'),
    stakeAmount: Number(args.payload?.stakeAmount ?? 0),
    hoursLeft: Number(args.payload?.hoursLeft ?? 0),
  };

  const pushViewers: Id<'profiles'>[] = [];

  for (const viewerUserId of audience) {
    if (args.latchKey) {
      const passed = await checkAndSetLatch(
        ctx,
        viewerUserId,
        args.challengeId!,
        args.latchKey
      );
      if (!passed) continue;
    }

    await ctx.db.insert('friendEvents', {
      actorUserId: args.actorUserId,
      viewerUserId,
      eventGroupId,
      challengeId: args.challengeId,
      participantId: args.participantId,
      kind: args.kind,
      payload: basePayload,
      createdAt: Date.now(),
    });

    if (PUSH_KINDS.has(args.kind)) {
      const viewer = await ctx.db.get(viewerUserId);
      if (viewer && viewer.friendActivityPushEnabled !== false) {
        pushViewers.push(viewerUserId);
      }
    }
  }

  if (pushViewers.length > 0) {
    const tpl = PUSH_TEMPLATES[args.kind](pushInputs);
    await schedulePushForUsers(ctx, pushViewers, {
      title: tpl.title,
      body: tpl.body,
      data: {
        kind: args.kind,
        challengeId: args.challengeId,
        actorUserId: args.actorUserId,
      },
    });
  }
}

// Clear all per-stake latches for a challenge when it settles, so future
// re-opens (rare but possible in dev) emit cleanly.
export async function clearLatchesForChallenge(
  ctx: MutationCtx,
  challengeId: Id<'challenges'>
): Promise<void> {
  const latches = await ctx.db
    .query('friendEventLatches')
    .filter((q) => q.eq(q.field('challengeId'), challengeId))
    .collect();
  for (const l of latches) await ctx.db.delete(l._id);
}

// ---- Cron: scan running stakes for at-risk / time-running-out ------------

const AT_RISK_HOURS_THRESHOLD = 12;
const TIME_RUNNING_OUT_HOURS_THRESHOLD = 6;

export const scanActiveStakesForRisk = internalMutation({
  args: {},
  handler: async (ctx) => {
    const running = await ctx.db
      .query('challenges')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();
    const now = Date.now();

    for (const challenge of running) {
      const hoursLeft = (challenge.endsAt - now) / 3_600_000;
      if (hoursLeft <= 0) continue;
      const activity = getActivity(challenge.activityKey);

      const participants = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', challenge._id))
        .filter((q) => q.eq(q.field('status'), 'active'))
        .collect();

      for (const participant of participants) {
        await emitRiskEventsForParticipant(ctx, challenge, participant, activity, hoursLeft);
      }
    }
    return null;
  },
});

async function emitRiskEventsForParticipant(
  ctx: MutationCtx,
  challenge: Doc<'challenges'>,
  participant: Doc<'participants'>,
  activity: ReturnType<typeof getActivity>,
  hoursLeft: number
): Promise<void> {
  const snapshot = await computeProgressSnapshot(ctx, challenge, participant);

  const payload = {
    stakeTitle: challenge.title,
    stakeAmount: participant.stakeAmount,
    activityKey: challenge.activityKey ?? 'steps',
    progress: snapshot.progress,
    goal: snapshot.goal,
    ratio: snapshot.ratio,
    hoursLeft,
  };

  // time_running_out: every running stake with < 6h left, latched per viewer/stake.
  if (hoursLeft < TIME_RUNNING_OUT_HOURS_THRESHOLD) {
    await emitFriendEvent(ctx, {
      actorUserId: participant.userId,
      kind: 'time_running_out',
      challengeId: challenge._id,
      participantId: participant._id,
      payload,
      latchKey: 'time_running_out',
    });
  }

  // at_risk: sensor-tracked stakes where pace is below the day fraction.
  // Mirrors the existing friends.progressNow heuristic so the cron's
  // definition of "at risk" matches the live strip on Today.
  if (
    (activity.goalKind === 'count' || activity.goalKind === 'distance') &&
    hoursLeft < AT_RISK_HOURS_THRESHOLD
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const dayStart = new Date(today + 'T00:00:00').getTime();
    const dayFraction = (Date.now() - dayStart) / (24 * 60 * 60 * 1000);
    const expected = Math.max(0.1, dayFraction - 0.15);
    if (snapshot.ratio < expected && snapshot.ratio < 1) {
      const whatsLeft = await computeWhatsLeft(ctx, challenge, participant);
      await emitFriendEvent(ctx, {
        actorUserId: participant.userId,
        kind: 'at_risk',
        challengeId: challenge._id,
        participantId: participant._id,
        payload: { ...payload, whatsLeft },
        latchKey: 'at_risk',
      });
    }
  }
}
