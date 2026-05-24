// Bet-end reminder cron. Fires push notifications on the lead-time schedule
// each user picked (or smart defaults per duration when they haven't
// overridden).
//
// Invoked from convex/crons.ts every 15 minutes. Idempotent via the
// `reminderFires` table — each (participant, leadHoursIndex) is fired at
// most once.

import { internalMutation } from './_generated/server';
import { defaultLeadHoursForDuration } from '../lib/notifyDefaults';
import type { Doc, Id } from './_generated/dataModel';
import { schedulePushForUsers } from './notifications';

const CRON_WINDOW_MS = 15 * 60 * 1000; // matches the 15-min cron interval

function formatLead(h: number): string {
  if (h <= 0) return 'right now';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = h / 24;
  return Number.isInteger(d) ? `${d}d` : `${d.toFixed(1)}d`;
}

export const scheduleDueReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // All running challenges. Cheap when the table is small; index by
    // status lets us skip settled/open rows entirely.
    const running = await ctx.db
      .query('challenges')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .collect();

    let firedCount = 0;

    for (const c of running) {
      const parts = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
        .collect();

      for (const p of parts) {
        if (p.status !== 'active') continue;

        const profile = await ctx.db.get(p.userId);
        if (!profile) continue;
        if (profile.pushEnabled === false) continue;

        // Resolve the lead schedule. Empty array = mute-all.
        const leads =
          profile.notifyLeadHours ?? defaultLeadHoursForDuration(c.durationDays);
        if (leads.length === 0) continue;

        // Already-fired indices for this participant.
        const prior = await ctx.db
          .query('reminderFires')
          .withIndex('by_participant', (q) => q.eq('participantId', p._id))
          .collect();
        const firedIdx = new Set(prior.map((r) => r.leadHoursIndex));

        for (let i = 0; i < leads.length; i++) {
          if (firedIdx.has(i)) continue;
          const leadH = leads[i];
          const fireAt = c.endsAt - leadH * 3_600_000;
          // We're inside the window if `now` is in [fireAt, fireAt+CRON_WINDOW]
          // OR we're past fireAt but haven't yet fired (catch up for missed
          // cron ticks). Cap catch-up to 4× the cron window so we don't
          // fire a "4h before" reminder a day late.
          const sinceFire = now - fireAt;
          const inWindow = sinceFire >= 0 && sinceFire <= 4 * CRON_WINDOW_MS;
          if (!inWindow) continue;

          await schedulePushForUsers(ctx, [p.userId], {
            title: c.title,
            body: `${formatLead(leadH)} left · $${p.stakeAmount} on the line`,
            data: { betId: c._id },
          });
          await ctx.db.insert('reminderFires', {
            participantId: p._id,
            leadHoursIndex: i,
            leadHours: leadH,
            firedAt: now,
          });
          firedCount += 1;
        }
      }
    }

    return { firedCount };
  },
});
