import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, internalMutation } from './_generated/server';
import { clearLatchesForChallenge, emitFriendEvent } from './friendEvents';
import {
  resolveForfeitDestination,
  tierFromStake,
} from './jackpotTiers';
import { schedulePushForUsers } from './notifications';
import { applyDelta, recordTx } from './wallet';

const DAY_MS = 24 * 60 * 60 * 1000;

// Activity-aware settlement.
//
// For each due challenge, decide who finished and who didn't. The finisher
// rule depends on the activity:
//   - Sensor activities (currently 'steps'): every day must hit goal,
//     pulled from stepEntries. Future sensor types (walk/run/bike/duration)
//     follow the same shape once their sources land.
//   - Non-sensor activities: a 'submitted' or 'acknowledged' proof counts
//     as a win (per the v2 "trust the submitter" rule). 'disputed' counts
//     as a forfeit. No proof = forfeit.
//
// Distribution depends on the bet shape:
//   - solo  (and undefined for legacy rows): finisher gets stake back,
//           forfeit feeds the open jackpot pool. Existing model.
//   - h2h:  zero-sum 1:1 between two participants. If both finish, both
//           refunded. If exactly one finishes, the loser's stake is paid
//           to the winner. If neither finishes, both stakes feed the pool.
//   - market: pots split by side. Subject's outcome (over/under the line)
//             names the winning side; the losing side's stakes are split
//             evenly among the winning side. If no clear outcome (no
//             entries) → all stakes refunded (void).
export const dailySettlement = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query('challenges')
      .withIndex('by_status', (q) => q.eq('status', 'running'))
      .filter((q) => q.lt(q.field('endsAt'), now))
      .collect();

    let totalForfeitedToPool = 0;
    let settledCount = 0;

    for (const c of due) {
      const parts = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
        .collect();
      const activeParts = parts.filter((p) => p.status === 'active');

      // Decide finishers / losers per participant.
      const finishers: Doc<'participants'>[] = [];
      const losers: Doc<'participants'>[] = [];
      for (const p of activeParts) {
        const finished = await participantFinished(ctx, c, p);
        (finished ? finishers : losers).push(p);
      }

      const shape = c.betShape ?? 'solo';
      // Shadow-naysayer: any active naysayer row routes through the
      // naysayer pot regardless of the bet's original shape. Lets a
      // friend stake against a solo goal without the creator having to
      // pick the naysayer shape upfront.
      const hasNaysayer = activeParts.some((p) => p.role === 'naysayer');
      let poolDelta = 0;

      if (hasNaysayer) {
        poolDelta = await settleNaysayer(ctx, c, activeParts);
      } else if (shape === 'h2h') {
        poolDelta = await settleH2H(ctx, c, finishers, losers);
      } else if (shape === 'market') {
        poolDelta = await settleMarket(ctx, c, activeParts);
      } else if (shape === 'naysayer') {
        poolDelta = await settleNaysayer(ctx, c, activeParts);
      } else {
        poolDelta = await settleSolo(ctx, c, finishers, losers);
      }

      // Route per-bet forfeits to the right scope-aware pool(s). Each
      // loser of this bet contributes their stake; the helper credits
      // global + (region or friends) per the bet's poolScope.
      if (poolDelta > 0) {
        for (const l of losers) {
          await creditPoolsForBet(ctx, c, l.stakeAmount, l.userId);
        }
      }

      totalForfeitedToPool += poolDelta;
      await ctx.db.patch(c._id, { status: 'settled' });
      settledCount += 1;

      // Push outcome + friend-stream emit per settled participant. Re-read
      // rows so the status reflects the patches above.
      const settled = await ctx.db
        .query('participants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
        .collect();
      for (const part of settled) {
        const outcome = part.status;
        if (outcome !== 'won' && outcome !== 'forfeit') continue;
        const body =
          outcome === 'won'
            ? `WON +$${part.stakeAmount}`
            : `FORFEIT −$${part.stakeAmount}`;
        await schedulePushForUsers(ctx, [part.userId], {
          title: c.title,
          body,
          data: { betId: c._id },
        });
        await emitFriendEvent(ctx, {
          actorUserId: part.userId,
          kind: outcome === 'won' ? 'just_won' : 'just_forfeited',
          challengeId: c._id,
          participantId: part._id,
          payload: {
            stakeTitle: c.title,
            stakeAmount: part.stakeAmount,
            activityKey: c.activityKey ?? 'steps',
          },
        });
      }
      // All participants on this challenge are now in terminal status, so
      // wipe the per-stake latches.
      await clearLatchesForChallenge(ctx, c._id);
    }

    // creditPoolsForBet handles per-bet pool credits inline above.
    // totalForfeitedToPool is kept only as a return-value summary.
    return { settledChallenges: settledCount, forfeited: totalForfeitedToPool };
  },
});

async function participantFinished(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  p: Doc<'participants'>
): Promise<boolean> {
  const activityKey = c.activityKey ?? 'steps';
  const isSensor = SENSOR_ACTIVITY_KEYS.has(activityKey);

  if (isSensor && activityKey === 'steps') {
    const days = Math.max(1, Math.ceil((c.endsAt - c.startsAt) / DAY_MS));
    for (let i = 0; i < days; i++) {
      const day = new Date(c.startsAt + i * DAY_MS).toISOString().slice(0, 10);
      const entry = await ctx.db
        .query('stepEntries')
        .withIndex('by_user_date', (q) => q.eq('userId', p.userId).eq('date', day))
        .filter((q) => q.eq(q.field('challengeId'), c._id))
        .first();
      if (!entry || entry.steps < c.stepGoal) return false;
    }
    return true;
  }

  // Non-sensor (or sensor activity without a wired data source yet):
  // settle on proofs. Trust the submitter.
  //
  // Single-session bets (stepGoal <= 1, the legacy shape): one non-disputed
  // proof is enough.
  //
  // Multi-session bets (binary activity with stepGoal > 1, e.g. "7 sessions
  // over 7 days"): need at least `stepGoal` distinct non-disputed check-ins.
  // We count by `forDate` so two check-ins on the same day don't double-count;
  // pre-multi-session rows without forDate still count once via their _id.
  const proofs = await ctx.db
    .query('proofs')
    .withIndex('by_participant', (q) => q.eq('participantId', p._id))
    .collect();
  if (proofs.length === 0) return false;

  const sessionGoal = Math.max(1, Math.floor(c.stepGoal));
  if (sessionGoal <= 1) {
    const latest = proofs.sort((a, b) => b.submittedAt - a.submittedAt)[0];
    return latest.status !== 'disputed';
  }

  const dates = new Set<string>();
  for (const proof of proofs) {
    if (proof.status === 'disputed') continue;
    dates.add(proof.forDate ?? `legacy:${proof._id}`);
  }
  return dates.size >= sessionGoal;
}

async function settleSolo(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  finishers: Doc<'participants'>[],
  losers: Doc<'participants'>[]
): Promise<number> {
  for (const f of finishers) {
    const u = await ctx.db.get(f.userId);
    if (!u) continue;
    await applyDelta(ctx, u, f.stakeAmount);
    await recordTx(ctx, u._id, 'refund', f.stakeAmount, c._id);
    await ctx.db.patch(f._id, { status: 'won' });
  }
  let pool = 0;
  for (const l of losers) {
    await ctx.db.patch(l._id, { status: 'forfeit' });
    await recordTx(ctx, l.userId, 'forfeit', 0, c._id);
    const u = await ctx.db.get(l.userId);
    if (u) {
      await ctx.db.patch(u._id, {
        totalForfeited: u.totalForfeited + l.stakeAmount,
      });
    }
    pool += l.stakeAmount;
  }
  return pool;
}

async function settleH2H(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  finishers: Doc<'participants'>[],
  losers: Doc<'participants'>[]
): Promise<number> {
  // Both finished → refund both. Exactly one → loser pays winner.
  // Neither → both forfeit to pool.
  if (finishers.length === losers.length) {
    // Either both 1+1 (both finished) or both 0+0 (handled separately).
  }
  if (losers.length === 0 && finishers.length > 0) {
    for (const f of finishers) {
      const u = await ctx.db.get(f.userId);
      if (!u) continue;
      await applyDelta(ctx, u, f.stakeAmount);
      await recordTx(ctx, u._id, 'refund', f.stakeAmount, c._id);
      await ctx.db.patch(f._id, { status: 'won' });
    }
    return 0;
  }
  if (finishers.length === 1 && losers.length === 1) {
    const winner = finishers[0];
    const loser = losers[0];
    const winU = await ctx.db.get(winner.userId);
    const loseU = await ctx.db.get(loser.userId);
    if (winU) {
      await applyDelta(ctx, winU, winner.stakeAmount + loser.stakeAmount);
      await recordTx(
        ctx,
        winU._id,
        'refund',
        winner.stakeAmount + loser.stakeAmount,
        c._id
      );
      await ctx.db.patch(winU._id, {
        totalWon: winU.totalWon + loser.stakeAmount,
      });
    }
    if (loseU) {
      await ctx.db.patch(loseU._id, {
        totalForfeited: loseU.totalForfeited + loser.stakeAmount,
      });
    }
    await recordTx(ctx, loser.userId, 'forfeit', 0, c._id);
    await ctx.db.patch(winner._id, { status: 'won' });
    await ctx.db.patch(loser._id, { status: 'forfeit' });
    return 0;
  }
  // Both lost → pool collects.
  let pool = 0;
  for (const l of losers) {
    await ctx.db.patch(l._id, { status: 'forfeit' });
    await recordTx(ctx, l.userId, 'forfeit', 0, c._id);
    const u = await ctx.db.get(l.userId);
    if (u) {
      await ctx.db.patch(u._id, {
        totalForfeited: u.totalForfeited + l.stakeAmount,
      });
    }
    pool += l.stakeAmount;
  }
  return pool;
}

async function settleMarket(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  parts: Doc<'participants'>[]
): Promise<number> {
  // The subject either hit the line or didn't. We only handle the
  // sensor-step subject case here today; expand as more sensor sources
  // light up. For non-sensor markets, settle by the subject's proof
  // (claimedValue if scored; presence-of-proof if binary).
  if (!c.subjectUserId || c.marketLine == null) {
    // Misconfigured market — refund all.
    return await refundAll(ctx, c, parts);
  }
  const activityKey = c.activityKey ?? 'steps';

  let measured: number | null = null;
  if (activityKey === 'steps') {
    // Sum step entries for the subject across the bet's day range.
    const days = Math.max(1, Math.ceil((c.endsAt - c.startsAt) / DAY_MS));
    let total = 0;
    for (let i = 0; i < days; i++) {
      const day = new Date(c.startsAt + i * DAY_MS).toISOString().slice(0, 10);
      const entry = await ctx.db
        .query('stepEntries')
        .withIndex('by_user_date', (q) =>
          q.eq('userId', c.subjectUserId!).eq('date', day)
        )
        .filter((q) => q.eq(q.field('challengeId'), c._id))
        .first();
      if (entry) total += entry.steps;
    }
    measured = total;
  } else {
    const subjectPart = parts.find((p) => p.userId === c.subjectUserId);
    if (subjectPart) {
      const proofs = await ctx.db
        .query('proofs')
        .withIndex('by_participant', (q) => q.eq('participantId', subjectPart._id))
        .collect();
      const latest = proofs.sort((a, b) => b.submittedAt - a.submittedAt)[0];
      if (latest && latest.status !== 'disputed') {
        measured = latest.claimedValue ?? c.marketLine + 1;
      }
    }
  }

  if (measured == null) return await refundAll(ctx, c, parts);

  const overWins = measured > c.marketLine;
  const winners = parts.filter((p) =>
    overWins ? p.side === 'over' : p.side === 'under'
  );
  const losers = parts.filter((p) =>
    overWins ? p.side === 'under' : p.side === 'over'
  );

  if (winners.length === 0) return await refundAll(ctx, c, parts);

  const losersPot = losers.reduce((s, l) => s + l.stakeAmount, 0);
  const perWinnerExtra = winners.length > 0 ? losersPot / winners.length : 0;

  for (const w of winners) {
    const u = await ctx.db.get(w.userId);
    if (!u) continue;
    const payout = w.stakeAmount + perWinnerExtra;
    await applyDelta(ctx, u, payout);
    await recordTx(ctx, u._id, 'refund', payout, c._id);
    await ctx.db.patch(u._id, {
      totalWon: u.totalWon + perWinnerExtra,
    });
    await ctx.db.patch(w._id, { status: 'won' });
  }
  for (const l of losers) {
    const u = await ctx.db.get(l.userId);
    if (u) {
      await ctx.db.patch(u._id, {
        totalForfeited: u.totalForfeited + l.stakeAmount,
      });
    }
    await recordTx(ctx, l.userId, 'forfeit', 0, c._id);
    await ctx.db.patch(l._id, { status: 'forfeit' });
  }
  return 0;
}

// Naysayer:
//   subject (creator) hit the goal → subject takes all naysayer stakes.
//   subject missed → naysayers each get back own stake + equal share of
//     subject's stake; subject's stake also routes a forfeit row to the
//     subject's chosen pool if any portion remained (it doesn't here —
//     naysayers absorb the subject's forfeit, no pool credit). If there
//     are zero naysayers and subject missed, subject's stake feeds the
//     pool the standard way.
async function settleNaysayer(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  parts: Doc<'participants'>[]
): Promise<number> {
  const subject = parts.find((p) => p.role === 'subject');
  const naysayers = parts.filter((p) => p.role === 'naysayer');
  if (!subject) {
    return await refundAll(ctx, c, parts);
  }
  const subjectFinished = await participantFinished(ctx, c, subject);
  const subjectU = await ctx.db.get(subject.userId);

  if (subjectFinished) {
    // Subject won: take own stake back + each naysayer's stake.
    const naysayerPot = naysayers.reduce((s, n) => s + n.stakeAmount, 0);
    if (subjectU) {
      const payout = subject.stakeAmount + naysayerPot;
      await applyDelta(ctx, subjectU, payout);
      await recordTx(ctx, subjectU._id, 'refund', payout, c._id);
      await ctx.db.patch(subjectU._id, {
        totalWon: subjectU.totalWon + naysayerPot,
      });
    }
    await ctx.db.patch(subject._id, { status: 'won' });
    for (const n of naysayers) {
      const nu = await ctx.db.get(n.userId);
      if (nu) {
        await ctx.db.patch(nu._id, {
          totalForfeited: nu.totalForfeited + n.stakeAmount,
        });
      }
      await recordTx(ctx, n.userId, 'forfeit', 0, c._id);
      await ctx.db.patch(n._id, { status: 'forfeit' });
    }
    return 0;
  }

  // Subject missed.
  if (naysayers.length === 0) {
    // No takers — subject's stake feeds the pool the regular way.
    if (subjectU) {
      await ctx.db.patch(subjectU._id, {
        totalForfeited: subjectU.totalForfeited + subject.stakeAmount,
      });
    }
    await recordTx(ctx, subject.userId, 'forfeit', 0, c._id);
    await ctx.db.patch(subject._id, { status: 'forfeit' });
    return subject.stakeAmount;
  }

  // Split subject's stake equally among naysayers; each also gets own stake.
  const perNaysayerExtra = subject.stakeAmount / naysayers.length;
  for (const n of naysayers) {
    const nu = await ctx.db.get(n.userId);
    if (!nu) continue;
    const payout = n.stakeAmount + perNaysayerExtra;
    await applyDelta(ctx, nu, payout);
    await recordTx(ctx, nu._id, 'refund', payout, c._id);
    await ctx.db.patch(nu._id, {
      totalWon: nu.totalWon + perNaysayerExtra,
    });
    await ctx.db.patch(n._id, { status: 'won' });
  }
  if (subjectU) {
    await ctx.db.patch(subjectU._id, {
      totalForfeited: subjectU.totalForfeited + subject.stakeAmount,
    });
  }
  await recordTx(ctx, subject.userId, 'forfeit', 0, c._id);
  await ctx.db.patch(subject._id, { status: 'forfeit' });
  return 0;
}

async function refundAll(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  parts: Doc<'participants'>[]
): Promise<number> {
  for (const p of parts) {
    const u = await ctx.db.get(p.userId);
    if (!u) continue;
    await applyDelta(ctx, u, p.stakeAmount);
    await recordTx(ctx, u._id, 'refund', p.stakeAmount, c._id);
    await ctx.db.patch(p._id, { status: 'won' });
  }
  return 0;
}

const POOL_PERIOD_MS = 7 * DAY_MS;

// Resolve (or create) the open pool for a given (scope, scopeKey, tier).
// Tiered pools are the v4 model. Legacy untiered open pools (no tier
// field) are picked up by the scope-only resolver below for backwards
// compat with old contributions but never created fresh.
async function resolveOpenTierPool(
  ctx: MutationCtx,
  scope: 'global' | 'region' | 'friends',
  scopeKey: string,
  tier: 'easy' | 'medium' | 'hard'
): Promise<Doc<'jackpotPools'>> {
  const existing = await ctx.db
    .query('jackpotPools')
    .withIndex('by_scope_tier', (q) =>
      q.eq('scope', scope).eq('scopeKey', scopeKey).eq('tier', tier).eq('status', 'open')
    )
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert('jackpotPools', {
    period: new Date().toISOString().slice(0, 10),
    scope,
    scopeKey,
    tier,
    total: 0,
    status: 'open',
    settlesAt: Date.now() + POOL_PERIOD_MS,
    winnerCount: 0,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error('Failed to create pool.');
  return created;
}

// Route a forfeit to the right (scope, tier) pool.
//
// Scope: the user who's losing the stake picks where their forfeits go via
// profile.forfeitDestination. Smart fallback: friends → region → global
// when nothing's set (see jackpotTiers.resolveForfeitDestination). The
// bet's own poolScope is used as a tiebreaker so the creator can pin
// a bet at 'global' even if their joiners default to 'friends'.
//
// Tier: derived from the bet's stake (tierFromStake). Easy ≤ $9,
// medium ≤ $24, hard ≥ $25. Eligibility to share is tier-aware too —
// see jackpotTiers.eligibleTiersFor.
//
// Every forfeit always feeds the global pool of its tier in addition to
// the contributor's preferred (region/friends) pool — keeps the global
// jackpot meaningful while still letting users invest in their own
// ecosystem.
async function creditPoolsForBet(
  ctx: MutationCtx,
  c: Doc<'challenges'>,
  amount: number,
  contributorId: Id<'profiles'>
) {
  if (amount <= 0) return;
  const tier = tierFromStake(c.stakeAmount);

  // Always feed the global pool of this tier — that's the universal
  // backstop everyone competes for.
  await creditPool(ctx, 'global', 'global', tier, amount, contributorId);

  const contributor = await ctx.db.get(contributorId);
  if (!contributor) return;

  const preferred = await resolveForfeitDestination(ctx as any, contributor);
  if (preferred === 'global') return; // already credited above
  if (preferred === 'region' && contributor.countryCode) {
    await creditPool(
      ctx,
      'region',
      contributor.countryCode,
      tier,
      amount,
      contributorId
    );
    return;
  }
  if (preferred === 'friends') {
    await creditPool(ctx, 'friends', contributorId, tier, amount, contributorId);
  }
}

async function creditPool(
  ctx: MutationCtx,
  scope: 'global' | 'region' | 'friends',
  scopeKey: string,
  tier: 'easy' | 'medium' | 'hard',
  amount: number,
  contributorId: Id<'profiles'>
) {
  const pool = await resolveOpenTierPool(ctx, scope, scopeKey, tier);
  await ctx.db.patch(pool._id, { total: pool.total + amount });
  await ctx.db.insert('poolContributions', {
    poolId: pool._id,
    userId: contributorId,
    amount,
    at: Date.now(),
  });
}

// Mirror of lib/activities.ts. Server-side enum kept tight; non-sensor
// activities settle via proofs regardless of registry membership.
const SENSOR_ACTIVITY_KEYS = new Set<string>([
  'steps',
  'walk',
  'run',
  'bike',
]);
