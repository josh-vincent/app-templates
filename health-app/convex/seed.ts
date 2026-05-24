// Dev seed — wipes all challenges / participants / step entries / jackpots /
// transactions and reinserts a realistic-looking demo dataset:
//
//   - A handful of fake players with lifetime stats, two connected as friends
//   - 2 settled challenges within the last 36h (so the Home "yesterday strip"
//     has content: dev won one and forfeited one)
//   - 2 running challenges (dev is mid-flight in both)
//   - 2 open challenges (others have joined; ready to be tapped)
//   - Per-day step entries for the running challenges so progress varies
//   - An open jackpot pool plus 4 settled historical pools
//   - A mixed transaction ledger for the dev profile spanning the last 2 weeks
//
// Idempotent: re-running wipes the prior seed before writing fresh data.
// The current dev profile is kept (its _id is preserved) but its name +
// wallet stats are reset.

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';
import { ensureProfile, personaArgs } from './users';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const FAKE_PLAYERS: {
  displayName: string;
  username: string;
  walletBalance: number;
  totalWon: number;
  totalForfeited: number;
}[] = [
  { displayName: 'Alex K.', username: 'alex', walletBalance: 47, totalWon: 145, totalForfeited: 80 },
  { displayName: 'Sam D.', username: 'sam', walletBalance: 12, totalWon: 60, totalForfeited: 120 },
  { displayName: 'Jess M.', username: 'jess', walletBalance: 105, totalWon: 220, totalForfeited: 35 },
  { displayName: 'Mo T.', username: 'mo', walletBalance: 3, totalWon: 25, totalForfeited: 95 },
  { displayName: 'Riley P.', username: 'riley', walletBalance: 88, totalWon: 180, totalForfeited: 70 },
  { displayName: 'Kai L.', username: 'kai', walletBalance: 32, totalWon: 95, totalForfeited: 110 },
];

function dateStr(t: number) {
  return new Date(t).toISOString().slice(0, 10);
}

export const seedDevData = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1) Wipe non-profile tables first.
    for (const t of [
      'transactions',
      'stepEntries',
      'participants',
      'challenges',
      'jackpotPools',
      'friendships',
    ] as const) {
      const rows = await ctx.db.query(t).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }

    // 2) Wipe all profiles, then recreate dev + josh + jeff fresh so each
    // simulator picks the right one via DevPersonaContext.
    const allProfiles = await ctx.db.query('profiles').collect();
    for (const p of allProfiles) {
      await ctx.db.delete(p._id);
    }

    // Dev profile — the fallback when no persona is selected.
    const devId = await ctx.db.insert('profiles', {
      displayName: 'You',
      walletBalance: 50,
      totalWon: 85,
      totalForfeited: 35,
      createdAt: now - 30 * DAY,
    });

    // Persona profiles — one per dev simulator. usernames are baked in so
    // healthpulse://join/<name> deep links resolve immediately after seeding.
    const joshId = await ctx.db.insert('profiles', {
      personaKey: 'josh',
      displayName: 'Josh',
      username: 'josh',
      walletBalance: 120,
      totalWon: 130,
      totalForfeited: 40,
      createdAt: now - 30 * DAY,
    });
    const jeffId = await ctx.db.insert('profiles', {
      personaKey: 'jeff',
      displayName: 'Jeff',
      username: 'jeff',
      walletBalance: 80,
      totalWon: 65,
      totalForfeited: 75,
      createdAt: now - 30 * DAY,
    });

    // Mutual friendship Josh <-> Jeff (so they see each other's bets in the
    // friends-first feed).
    for (const [a, b] of [
      [joshId, jeffId],
      [jeffId, joshId],
    ] as const) {
      await ctx.db.insert('friendships', {
        fromUserId: a,
        toUserId: b,
        createdAt: now - 14 * DAY,
      });
    }

    // 3) Insert fake players.
    const fakes: Id<'profiles'>[] = [];
    for (const fp of FAKE_PLAYERS) {
      const id = await ctx.db.insert('profiles', {
        displayName: fp.displayName,
        username: fp.username,
        walletBalance: fp.walletBalance,
        totalWon: fp.totalWon,
        totalForfeited: fp.totalForfeited,
        createdAt: now - 30 * DAY,
      });
      fakes.push(id);
    }

    // Friends-first discovery: each persona is friended with two fake
    // players so their open stakes surface in FRIENDS' STAKES. We DON'T
    // friend the dev profile here — it's the fallback shared identity,
    // not a real player. Otherwise personas see 'You' in their friends list.
    for (const persona of [joshId, jeffId]) {
      for (const friendId of [fakes[0], fakes[2]]) {
        await ctx.db.insert('friendships', {
          fromUserId: persona,
          toUserId: friendId,
          createdAt: now - 14 * DAY,
        });
        await ctx.db.insert('friendships', {
          fromUserId: friendId,
          toUserId: persona,
          createdAt: now - 14 * DAY,
        });
      }
    }

    // 4) Settled challenges within last 36h — drive the "yesterday strip".
    const wonId = await ctx.db.insert('challenges', {
      creatorId: fakes[0],
      title: 'Sunday Sweat',
      description: '10k a day. Easy points for the early risers.',
      stepGoal: 10_000,
      stakeAmount: 10,
      durationDays: 1,
      startsAt: now - 2 * DAY,
      endsAt: now - 18 * HOUR,
      status: 'settled',
    });
    await ctx.db.insert('participants', {
      challengeId: wonId,
      userId: devId,
      stakeAmount: 10,
      stakedAt: now - 2 * DAY,
      status: 'won',
      finalSteps: 11_240,
    });
    await ctx.db.insert('participants', {
      challengeId: wonId,
      userId: fakes[0],
      stakeAmount: 10,
      stakedAt: now - 2 * DAY,
      status: 'won',
      finalSteps: 10_810,
    });
    await ctx.db.insert('participants', {
      challengeId: wonId,
      userId: fakes[3],
      stakeAmount: 10,
      stakedAt: now - 2 * DAY,
      status: 'forfeit',
      finalSteps: 6_410,
    });

    const lostId = await ctx.db.insert('challenges', {
      creatorId: fakes[1],
      title: 'Easy Eights',
      description: '8k. Should have been a layup.',
      stepGoal: 8_000,
      stakeAmount: 5,
      durationDays: 1,
      startsAt: now - 3 * DAY,
      endsAt: now - 30 * HOUR,
      status: 'settled',
    });
    await ctx.db.insert('participants', {
      challengeId: lostId,
      userId: devId,
      stakeAmount: 5,
      stakedAt: now - 3 * DAY,
      status: 'forfeit',
      finalSteps: 5_420,
    });
    await ctx.db.insert('participants', {
      challengeId: lostId,
      userId: fakes[1],
      stakeAmount: 5,
      stakedAt: now - 3 * DAY,
      status: 'won',
      finalSteps: 8_910,
    });
    await ctx.db.insert('participants', {
      challengeId: lostId,
      userId: fakes[4],
      stakeAmount: 5,
      stakedAt: now - 3 * DAY,
      status: 'won',
      finalSteps: 9_240,
    });

    // 4b) Persona participation in settled challenges (drives the yesterday
    //     strip for both sims with different outcomes).
    await ctx.db.insert('participants', {
      challengeId: wonId, userId: joshId, stakeAmount: 10,
      stakedAt: now - 2 * DAY, status: 'won', finalSteps: 12_100,
    });
    await ctx.db.insert('participants', {
      challengeId: wonId, userId: jeffId, stakeAmount: 10,
      stakedAt: now - 2 * DAY, status: 'won', finalSteps: 10_320,
    });
    await ctx.db.insert('participants', {
      challengeId: lostId, userId: joshId, stakeAmount: 5,
      stakedAt: now - 3 * DAY, status: 'won', finalSteps: 9_100,
    });
    await ctx.db.insert('participants', {
      challengeId: lostId, userId: jeffId, stakeAmount: 5,
      stakedAt: now - 3 * DAY, status: 'forfeit', finalSteps: 5_900,
    });

    // 5) Running challenges.
    const run1Id = await ctx.db.insert('challenges', {
      creatorId: devId,
      title: 'Morning Steppers',
      description: '10k every morning for a week. No excuses.',
      stepGoal: 10_000,
      stakeAmount: 10,
      durationDays: 7,
      startsAt: now - 3 * DAY,
      endsAt: now + 4 * DAY,
      status: 'running',
    });
    for (const u of [devId, joshId, jeffId, fakes[0], fakes[2], fakes[4]]) {
      await ctx.db.insert('participants', {
        challengeId: run1Id,
        userId: u,
        stakeAmount: 10,
        stakedAt: now - 3 * DAY,
        status: 'active',
      });
    }

    const run2Id = await ctx.db.insert('challenges', {
      creatorId: fakes[2],
      title: 'Weekend Warriors',
      description: '12.5k a day for 3 days. Stakes are higher.',
      stepGoal: 12_500,
      stakeAmount: 20,
      durationDays: 3,
      startsAt: now - 1 * DAY,
      endsAt: now + 2 * DAY,
      status: 'running',
    });
    for (const u of [devId, joshId, fakes[1], fakes[2], fakes[4], fakes[5]]) {
      await ctx.db.insert('participants', {
        challengeId: run2Id,
        userId: u,
        stakeAmount: 20,
        stakedAt: now - 1 * DAY,
        status: 'active',
      });
    }

    // 6) Open challenges — others are in, waiting for you.
    // Mix activity types so the v2 registry visibly works in the feed.
    const open1Id = await ctx.db.insert('challenges', {
      creatorId: fakes[5],
      title: 'Saturday Ride',
      description: '20km loop. Bring the pace.',
      activityKey: 'bike',
      stepGoal: 20, // distance km in the v2 generic-goal column
      stakeAmount: 25,
      durationDays: 1,
      startsAt: now + 6 * HOUR,
      endsAt: now + 30 * HOUR,
      status: 'open',
    });
    for (const u of [fakes[5], fakes[3]]) {
      await ctx.db.insert('participants', {
        challengeId: open1Id,
        userId: u,
        stakeAmount: 25,
        stakedAt: now - HOUR,
        status: 'active',
      });
    }

    const open2Id = await ctx.db.insert('challenges', {
      creatorId: fakes[0],
      title: 'Gym Streak',
      description: 'One session a day for a week. Photo + GPS to settle.',
      activityKey: 'strength',
      stepGoal: 7, // 7 sessions
      stakeAmount: 15,
      durationDays: 7,
      startsAt: now + 12 * HOUR,
      endsAt: now + 7.5 * DAY,
      status: 'open',
    });
    for (const u of [fakes[0], fakes[1], fakes[4]]) {
      await ctx.db.insert('participants', {
        challengeId: open2Id,
        userId: u,
        stakeAmount: 15,
        stakedAt: now - HOUR,
        status: 'active',
      });
    }

    const open3Id = await ctx.db.insert('challenges', {
      creatorId: fakes[2],
      title: 'Sunday Round',
      description: 'Break 90 at any course. Scorecard + GPS to settle.',
      activityKey: 'golf',
      stepGoal: 89,
      stakeAmount: 30,
      durationDays: 2,
      startsAt: now + 18 * HOUR,
      endsAt: now + 2 * DAY,
      status: 'open',
    });
    for (const u of [fakes[2]]) {
      await ctx.db.insert('participants', {
        challengeId: open3Id,
        userId: u,
        stakeAmount: 30,
        stakedAt: now - HOUR,
        status: 'active',
      });
    }

    // 7) Step entries — varied per participant per day.
    const run1Days = [3, 2, 1, 0] as const;
    const run1Pattern: [Id<'profiles'>, number[]][] = [
      [devId, [10_500, 11_200, 9_800, 6_200]], // missed today so far
      [joshId, [10_800, 11_900, 12_200, 9_400]], // on track, slightly behind today
      [jeffId, [10_200, 8_400, 9_600, 4_100]], // already missed day 2; in trouble today
      [fakes[0], [10_100, 10_300, 10_000, 10_800]],
      [fakes[2], [12_000, 11_000, 9_000, 7_500]],
      [fakes[4], [10_100, 10_500, 11_000, 10_200]],
    ];
    for (const [u, pattern] of run1Pattern) {
      for (let i = 0; i < run1Days.length; i++) {
        const t = now - run1Days[i] * DAY;
        await ctx.db.insert('stepEntries', {
          userId: u,
          challengeId: run1Id,
          date: dateStr(t),
          steps: pattern[i],
          submittedAt: t + 23 * HOUR,
          source: 'healthkit',
        });
      }
    }

    const run2Days = [1, 0] as const;
    const run2Pattern: [Id<'profiles'>, number[]][] = [
      [devId, [12_700, 8_200]],
      [joshId, [13_400, 11_900]],
      [fakes[1], [13_000, 12_800]],
      [fakes[2], [11_000, 13_000]],
      [fakes[4], [12_600, 12_700]],
      [fakes[5], [9_000, 14_000]],
    ];
    for (const [u, pattern] of run2Pattern) {
      for (let i = 0; i < run2Days.length; i++) {
        const t = now - run2Days[i] * DAY;
        await ctx.db.insert('stepEntries', {
          userId: u,
          challengeId: run2Id,
          date: dateStr(t),
          steps: pattern[i],
          submittedAt: t + 23 * HOUR,
          source: 'healthkit',
        });
      }
    }

    // 8) Jackpot pools — current open + history.
    await ctx.db.insert('jackpotPools', {
      period: dateStr(now),
      total: 420,
      status: 'open',
      settlesAt: now + 7 * DAY,
      winnerCount: 0,
    });
    const history: [number, number, number][] = [
      [7, 390, 4],
      [14, 310, 3],
      [21, 260, 5],
      [28, 180, 2],
    ];
    for (const [daysAgo, total, winnerCount] of history) {
      const settledAt = now - daysAgo * DAY;
      await ctx.db.insert('jackpotPools', {
        period: dateStr(settledAt),
        total,
        status: 'settled',
        settledAt,
        settlesAt: settledAt,
        winnerCount,
      });
    }

    // 9) Transactions for dev — wallet ledger.
    const ledger: {
      type: 'topup' | 'stake' | 'refund' | 'forfeit' | 'jackpotWin';
      amount: number;
      ref?: string;
      ageHours: number;
    }[] = [
      { type: 'topup', amount: 100, ageHours: 14 * 24 },
      { type: 'stake', amount: -10, ageHours: 7 * 24, ref: 'morning-steppers' },
      { type: 'stake', amount: -5, ageHours: 5 * 24, ref: 'easy-eights' },
      { type: 'forfeit', amount: -5, ageHours: 3 * 24, ref: 'easy-eights' },
      { type: 'topup', amount: 50, ageHours: 2 * 24 + 6 },
      { type: 'stake', amount: -20, ageHours: 2 * 24, ref: 'weekend-warriors' },
      { type: 'refund', amount: 10, ageHours: 18, ref: 'sunday-sweat' },
      { type: 'jackpotWin', amount: 35, ageHours: 17, ref: 'pool-2026-05-07' },
      { type: 'topup', amount: 25, ageHours: 2 },
    ];
    for (const t of ledger) {
      await ctx.db.insert('transactions', {
        userId: devId,
        type: t.type,
        amount: t.amount,
        ref: t.ref,
        at: now - t.ageHours * HOUR,
      });
    }

    // 10) Per-persona ledgers so each simulator's Wallet screen has history.
    const personaLedgers: { uid: Id<'profiles'>; entries: typeof ledger }[] = [
      {
        uid: joshId,
        entries: [
          { type: 'topup', amount: 150, ageHours: 12 * 24 },
          { type: 'stake', amount: -10, ageHours: 7 * 24, ref: 'morning-steppers' },
          { type: 'stake', amount: -5, ageHours: 5 * 24, ref: 'easy-eights' },
          { type: 'refund', amount: 5, ageHours: 30, ref: 'easy-eights' },
          { type: 'refund', amount: 10, ageHours: 18, ref: 'sunday-sweat' },
          { type: 'stake', amount: -20, ageHours: 2 * 24, ref: 'weekend-warriors' },
        ],
      },
      {
        uid: jeffId,
        entries: [
          { type: 'topup', amount: 100, ageHours: 10 * 24 },
          { type: 'stake', amount: -10, ageHours: 7 * 24, ref: 'morning-steppers' },
          { type: 'stake', amount: -5, ageHours: 5 * 24, ref: 'easy-eights' },
          { type: 'forfeit', amount: -5, ageHours: 30, ref: 'easy-eights' },
          { type: 'refund', amount: 10, ageHours: 18, ref: 'sunday-sweat' },
        ],
      },
    ];
    let personaTxCount = 0;
    for (const pl of personaLedgers) {
      for (const t of pl.entries) {
        await ctx.db.insert('transactions', {
          userId: pl.uid,
          type: t.type,
          amount: t.amount,
          ref: t.ref,
          at: now - t.ageHours * HOUR,
        });
        personaTxCount += 1;
      }
    }

    // 11) Seed a few unseen pokes so the burst overlay has something to
    //     play on first reload. Mix it up — friends + emojis + ages.
    const POKE_SEEDS: { from: Id<'profiles'>; to: Id<'profiles'>; emoji: string; ageMin: number }[] = [
      { from: fakes[0], to: joshId, emoji: '🔥', ageMin: 2 },
      { from: fakes[2], to: joshId, emoji: '👋', ageMin: 11 },
      { from: jeffId, to: joshId, emoji: '😈', ageMin: 27 },
      { from: fakes[0], to: jeffId, emoji: '💪', ageMin: 5 },
      { from: joshId, to: jeffId, emoji: '🎯', ageMin: 22 },
    ];
    let pokeCount = 0;
    for (const p of POKE_SEEDS) {
      await ctx.db.insert('pokes', {
        fromUserId: p.from,
        toUserId: p.to,
        emoji: p.emoji,
        createdAt: now - p.ageMin * 60_000,
      });
      pokeCount += 1;
    }

    return {
      ok: true,
      devProfileId: devId,
      personas: { josh: joshId, jeff: jeffId },
      fakePlayers: fakes.length,
      challenges: { settled: 2, running: 2, open: 3 },
      friendships: 6,
      jackpotPools: 5,
      transactions: ledger.length + personaTxCount,
      pokes: pokeCount,
    };
  },
});

// Demo: load a friends pool with cash, schedule it to settle in 5 min, and
// kick off three live friend bets that resolve in the next few minutes —
// each forfeit feeds the pool. Lets the demo show the gold strip ticking
// down, the share number recomputing, and the success push when the pool
// pays out.
//
// Idempotent in the sense that re-running clears the demo's pools + the
// drama bets it created (matched by title prefix) before re-seeding. Other
// data (the regular dev seed) stays put.
export const seedFriendsPoolDrama = mutation({
  args: { ...personaArgs },
  handler: async (ctx) => {
    const now = Date.now();
    const SETTLE_IN_MS = 8 * 60 * 1000; // pool pays out in 8 minutes
    const POOL_TIER = 'medium' as const;

    // Locate personas + their friend graphs. If they don't exist yet,
    // bail with an instructive error — caller should run seedDevData first.
    const personas = await ctx.db
      .query('profiles')
      .withIndex('by_persona')
      .collect();
    const josh = personas.find((p) => p.personaKey === 'josh');
    const jeff = personas.find((p) => p.personaKey === 'jeff');
    if (!josh || !jeff) {
      throw new Error(
        'Run "Seed dev data" first — drama needs the Josh + Jeff personas.'
      );
    }

    // Wipe prior demo: clear friends pools owned by either persona AND any
    // running drama bets we previously created (title prefix match).
    const oldPools = await ctx.db.query('jackpotPools').collect();
    for (const p of oldPools) {
      if (p.scope === 'friends' && (p.scopeKey === josh._id || p.scopeKey === jeff._id)) {
        const contribs = await ctx.db
          .query('poolContributions')
          .withIndex('by_pool', (q) => q.eq('poolId', p._id))
          .collect();
        for (const c of contribs) await ctx.db.delete(c._id);
        await ctx.db.delete(p._id);
      }
    }
    const allChallenges = await ctx.db.query('challenges').collect();
    for (const c of allChallenges) {
      if (c.title.startsWith('DEMO · ')) {
        const parts = await ctx.db
          .query('participants')
          .withIndex('by_challenge', (q) => q.eq('challengeId', c._id))
          .collect();
        for (const p of parts) await ctx.db.delete(p._id);
        const steps = await ctx.db
          .query('stepEntries')
          .withIndex('by_challenge_date', (q) => q.eq('challengeId', c._id))
          .collect();
        for (const s of steps) await ctx.db.delete(s._id);
        await ctx.db.delete(c._id);
      }
    }

    // Pick a small cast of pool contributors so the gold hero says
    // "N feeding it" and the audience math has real winners.
    const fakes = await ctx.db.query('profiles').collect();
    const cast = fakes
      .filter((p) => p.username && ['alex', 'jess', 'sam', 'mo'].includes(p.username))
      .slice(0, 4);

    // For both personas: create a friends-scope pool seeded with $145 across
    // 4 contributions. settlesAt = now + 5 minutes.
    const settlesAt = now + SETTLE_IN_MS;
    for (const persona of [josh, jeff]) {
      const poolId = await ctx.db.insert('jackpotPools', {
        period: dateStr(now),
        scope: 'friends',
        scopeKey: persona._id as unknown as string,
        tier: POOL_TIER,
        total: 145,
        status: 'open',
        settlesAt,
        winnerCount: 0,
      });
      // Seed contributions (so the pool has provenance).
      const seedContribs: { user: Id<'profiles'>; amount: number }[] = [
        { user: persona._id, amount: 25 },
        ...cast.slice(0, 3).map((c, i) => ({
          user: c._id,
          amount: [40, 50, 30][i] ?? 30,
        })),
      ];
      for (const sc of seedContribs) {
        await ctx.db.insert('poolContributions', {
          poolId,
          userId: sc.user,
          amount: sc.amount,
          at: now - (60 + 60 * 60) * 1000, // ~1h ago
        });
      }
    }

    // Three drama bets, each with a friend as subject + the persona as
    // naysayer. Vary stake + minutes-left so the UI has a clear narrative:
    //   1) Alex K — 3 min left, behind pace (will likely forfeit → +$15 pool)
    //   2) Jess M — 2 min left, just barely behind (suspenseful)
    //   3) Mo T   — 4 min left, way behind (clean forfeit)
    const dramaSpecs: {
      title: string;
      subjectUsername: string;
      stake: number;
      goal: number;
      progress: number;
      endsInMs: number;
    }[] = [
      {
        title: 'DEMO · Alex 5k push',
        subjectUsername: 'alex',
        stake: 15,
        goal: 5_000,
        progress: 4_400,
        endsInMs: 4 * 60_000,
      },
      {
        title: 'DEMO · Jess sprint',
        subjectUsername: 'jess',
        stake: 20,
        goal: 8_000,
        progress: 6_800,
        endsInMs: 5 * 60_000,
      },
      {
        title: 'DEMO · Mo last-mile',
        subjectUsername: 'mo',
        stake: 10,
        goal: 6_000,
        progress: 1_600,
        endsInMs: 6 * 60_000,
      },
    ];

    const todayStr = dateStr(now);
    let dramaCount = 0;
    for (const d of dramaSpecs) {
      const subject = fakes.find((p) => p.username === d.subjectUsername);
      if (!subject) continue;
      const cId = await ctx.db.insert('challenges', {
        creatorId: subject._id,
        title: d.title,
        description: 'Demo bet — settles fast so the pool ticks live.',
        activityKey: 'steps',
        stepGoal: d.goal,
        stakeAmount: d.stake,
        durationDays: 1,
        startsAt: now - 20 * 60_000, // looks like it started ~20m ago
        endsAt: now + d.endsInMs,
        status: 'running',
        betShape: 'solo',
        // Forfeits route to the friends pool of the SUBJECT — but the
        // subject is a fake without forfeitDestination set, so the
        // smart-fallback routes their forfeits to global. To force the
        // demo into a *friends* pool, override poolScope here.
        poolScope: 'friends',
      });
      await ctx.db.insert('participants', {
        challengeId: cId,
        userId: subject._id,
        stakeAmount: d.stake,
        stakedAt: now - 20 * 60_000,
        status: 'active',
        role: 'subject',
      });
      // Today's progress entry — feeds Home's friendsLive query.
      await ctx.db.insert('stepEntries', {
        userId: subject._id,
        challengeId: cId,
        date: todayStr,
        steps: d.progress,
        submittedAt: now - 60_000,
        source: 'demo',
      });
      dramaCount += 1;
    }

    // Backfill historical wins for both personas so they qualify for the
    // medium tier (3 wins / 30 days) immediately. Without these, the demo
    // pool's "YOUR SHARE" reads "Win 3 to qualify" — fine for first-run
    // but blunts the demo since the share number stays at "—".
    for (const persona of [josh, jeff]) {
      // Each persona gets two synthetic wins on a tiny throwaway "DEMO ·
      // history" challenge so the eligibleTiersFor count clears the
      // medium threshold (combined with the existing 'wonId' from the base
      // seed they end up at 3+).
      const histId = await ctx.db.insert('challenges', {
        creatorId: persona._id,
        title: `DEMO · history ${persona.displayName ?? ''}`,
        activityKey: 'steps',
        stepGoal: 5_000,
        stakeAmount: 10,
        durationDays: 1,
        startsAt: now - 5 * 24 * 60 * 60 * 1000,
        endsAt: now - 4 * 24 * 60 * 60 * 1000,
        status: 'settled',
      });
      for (let i = 0; i < 2; i++) {
        await ctx.db.insert('participants', {
          challengeId: histId,
          userId: persona._id,
          stakeAmount: 5,
          stakedAt: now - (5 - i) * 24 * 60 * 60 * 1000,
          status: 'won',
          finalSteps: 5_400,
        });
      }
    }

    // Schedule the pool payout. Convex scheduler fires once at the exact
    // time. Cron backstop in convex/crons.ts will catch it if the scheduler
    // missed (e.g. dev server was off when settlesAt passed).
    await ctx.scheduler.runAt(settlesAt, internal.jackpot.settleDuePools, {});
    // Also settle bets shortly after each one ends so the pool sees the
    // forfeits before the payout fires.
    for (const d of dramaSpecs) {
      await ctx.scheduler.runAt(
        now + d.endsInMs + 5_000,
        internal.settle.dailySettlement,
        {}
      );
    }

    return {
      ok: true,
      poolsSeeded: 2,
      dramaBets: dramaCount,
      settlesAt,
      settlesInSec: Math.round(SETTLE_IN_MS / 1000),
    };
  },
});
