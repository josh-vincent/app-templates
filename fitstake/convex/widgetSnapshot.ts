// Read-only feed for the iOS widget / Live Activity / Watch app.
// Shape mirrors `WidgetSnapshot` in lib/widgetBridge.ts and the Swift
// FitStakeSnapshot in targets/widgets/SharedData.swift. Keep in sync.

import { query } from './_generated/server';
import { ensureProfileQuery, personaArgs } from './users';

const DAY_MS = 24 * 60 * 60 * 1000;

export const snapshot = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) {
      return {
        updatedAt: Date.now(),
        todaySteps: 0,
        stepGoal: 10000,
        walletBalance: 0,
        streakDays: 0,
        sparkline7d: [0, 0, 0, 0, 0, 0, 0],
        nextBet: null,
        activeBetCount: 0,
      };
    }

    const myParticipants = await ctx.db
      .query('participants')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', me._id).eq('status', 'active')
      )
      .collect();

    const challenges = await Promise.all(
      myParticipants.map(async (p) => ({
        p,
        c: await ctx.db.get(p.challengeId),
      }))
    );

    const liveChallenges = challenges
      .map((row) => row.c)
      .filter((c): c is NonNullable<typeof c> => !!c && c.status === 'running');

    // Pick the soonest-ending active bet as the "next bet".
    liveChallenges.sort((a, b) => a.endsAt - b.endsAt);
    const next = liveChallenges[0] ?? null;

    // Steps for today across all live challenges (sum).
    const todayStr = new Date().toISOString().slice(0, 10);
    let todaySteps = 0;
    for (const c of liveChallenges) {
      const entry = await ctx.db
        .query('stepEntries')
        .withIndex('by_user_date', (q) =>
          q.eq('userId', me._id).eq('date', todayStr)
        )
        .filter((q) => q.eq(q.field('challengeId'), c._id))
        .first();
      todaySteps += entry?.steps ?? 0;
    }

    // 7d sparkline: total steps per day across all live challenges.
    const sparkline7d: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
      let sum = 0;
      for (const c of liveChallenges) {
        const e = await ctx.db
          .query('stepEntries')
          .withIndex('by_user_date', (q) => q.eq('userId', me._id).eq('date', day))
          .filter((q) => q.eq(q.field('challengeId'), c._id))
          .first();
        sum += e?.steps ?? 0;
      }
      sparkline7d.push(sum);
    }

    // Streak: consecutive days from today backward where any live bet had steps.
    let streakDays = 0;
    for (let i = sparkline7d.length - 1; i >= 0; i--) {
      if ((sparkline7d[i] ?? 0) > 0) streakDays += 1;
      else break;
    }

    const nextBet = next
      ? {
          challengeId: next._id as unknown as string,
          title: next.title,
          stakeAmount: next.stakeAmount,
          endsAt: next.endsAt,
          stepGoal: next.stepGoal,
          currentProgress: todaySteps,
        }
      : null;

    return {
      updatedAt: Date.now(),
      todaySteps,
      stepGoal: next?.stepGoal ?? 10000,
      walletBalance: me.walletBalance ?? 0,
      streakDays,
      sparkline7d,
      nextBet,
      activeBetCount: liveChallenges.length,
    };
  },
});
