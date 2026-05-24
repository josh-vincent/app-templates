import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

// Hourly so sub-day bets (1-day step goals, market-shape bets that close at
// arbitrary times) settle within an hour of their endsAt. The settler is a
// no-op when nothing is due, so this is cheap.
crons.interval(
  'settle-due-bets',
  { hours: 1 },
  internal.settle.dailySettlement
);

// Watch alerts: scan unfired subscriptions every 15 minutes and push when
// the target's deadline is inside the user's alert window.
crons.interval(
  'fire-due-watches',
  { minutes: 15 },
  internal.watches.fireDue
);

// Bet-end reminders. Reads profile.notifyLeadHours (smart defaults per
// duration when unset) and fires pushes on the configured schedule.
crons.interval(
  'fire-bet-end-reminders',
  { minutes: 15 },
  internal.reminders.scheduleDueReminders
);

// Pay out any pool whose settlesAt has passed. Runs every minute as a
// backstop — the seedFriendsPoolDrama action also schedules a one-off
// runAt(settlesAt) so the demo's payout fires within seconds, but this
// catches anything missed (dev server off when settlesAt passed, etc).
crons.interval(
  'settle-due-pools',
  { minutes: 1 },
  internal.jackpot.settleDuePools
);

// Friend activity stream: fire at_risk / time_running_out events for friends
// whose stakes are slipping or about to close. Latched per (viewer, stake) so
// each viewer sees each signal at most once per stake.
crons.interval(
  'flag-friend-stakes-at-risk',
  { minutes: 30 },
  internal.friendEvents.scanActiveStakesForRisk
);

export default crons;
