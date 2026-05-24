import { v } from 'convex/values';

import { mutation } from './_generated/server';
import { emitFriendEvent } from './friendEvents';
import { ensureProfile, personaArgs } from './users';

export const submitDaily = mutation({
  args: {
    ...personaArgs,
    challengeId: v.id('challenges'),
    date: v.string(), // YYYY-MM-DD
    steps: v.number(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, { personaKey, challengeId, date, steps, source }) => {
    const me = await ensureProfile(ctx, personaKey);
    if (steps < 0) throw new Error('Step count cannot be negative.');

    // Replace any earlier submission for the same user+date+challenge.
    const existing = await ctx.db
      .query('stepEntries')
      .withIndex('by_user_date', (q) => q.eq('userId', me._id).eq('date', date))
      .filter((q) => q.eq(q.field('challengeId'), challengeId))
      .first();

    const priorSteps = existing?.steps ?? 0;
    let entryId;
    if (existing) {
      await ctx.db.patch(existing._id, { steps, submittedAt: Date.now() });
      entryId = existing._id;
    } else {
      entryId = await ctx.db.insert('stepEntries', {
        userId: me._id,
        challengeId,
        date,
        steps,
        submittedAt: Date.now(),
        source: source ?? 'healthkit',
      });
    }

    // Emit session_completed when today's count crosses the goal for the
    // first time. Latched per (viewer, challenge, date) so re-syncs don't
    // refire.
    const challenge = await ctx.db.get(challengeId);
    if (challenge && priorSteps < challenge.stepGoal && steps >= challenge.stepGoal) {
      const participant = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', challengeId))
        .filter((q) => q.eq(q.field('userId'), me._id))
        .first();
      if (participant && participant.status === 'active') {
        const hoursLeft = (challenge.endsAt - Date.now()) / 3_600_000;
        await emitFriendEvent(ctx, {
          actorUserId: me._id,
          kind: 'session_completed',
          challengeId: challenge._id,
          participantId: participant._id,
          payload: {
            stakeTitle: challenge.title,
            stakeAmount: participant.stakeAmount,
            activityKey: challenge.activityKey ?? 'steps',
            progress: steps,
            goal: challenge.stepGoal,
            hoursLeft,
          },
          latchKey: 'session_completed:' + date,
        });
      }
    }

    return entryId;
  },
});
