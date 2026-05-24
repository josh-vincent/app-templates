// Multi-session check-in helpers.
//
// A "check-in" is one row in the `proofs` table covering one calendar day
// of a multi-session bet (e.g. "7 sessions over 7 days"). settlement counts
// distinct non-disputed forDate values toward the bet's stepGoal.
//
// Backfill: when the user forgot to check in on a given day but the
// background tracker stored locationPings, we can synthesise a proof row
// from those pings — see `backfillFromPings`.

import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { emitFriendEvent } from './friendEvents';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

const DAY_MS = 24 * 60 * 60 * 1000;
const PINGS_PER_DAY_FOR_BACKFILL = 3;

// All check-ins for a participant, oldest → newest. Each row carries the
// resolved photo URLs so the UI can render a strip without a second
// round-trip. Used by the proof screen and the bet detail strip.
export const myCheckIns = query({
  args: { ...personaArgs, participantId: v.id('participants') },
  handler: async (ctx, { personaKey, participantId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    const p = await ctx.db.get(participantId);
    if (!p || p.userId !== me._id) return [];

    const proofs = await ctx.db
      .query('proofs')
      .withIndex('by_participant', (q) => q.eq('participantId', participantId))
      .collect();
    proofs.sort((a, b) => a.submittedAt - b.submittedAt);

    return await Promise.all(
      proofs.map(async (row) => {
        const ids = row.imageStorageIds ?? (row.imageStorageId ? [row.imageStorageId] : []);
        const urls = await Promise.all(
          ids.map(async (sid) => (await ctx.storage.getUrl(sid)) ?? null)
        );
        return {
          _id: row._id,
          forDate: row.forDate ?? null,
          sessionIndex: row.sessionIndex ?? null,
          status: row.status,
          submittedAt: row.submittedAt,
          imageUrls: urls.filter((u): u is string => !!u),
          note: row.note ?? null,
          derivedFromPings: row.derivedFromPings ?? false,
          gpsLat: row.gpsLat ?? null,
          gpsLng: row.gpsLng ?? null,
        };
      })
    );
  },
});

// Days inside the bet window that:
//   1. have ≥ N background pings recorded
//   2. don't already have a non-disputed check-in
// Used by the proof screen to surface "Back-fill from background" CTAs.
export const pingDayCandidates = query({
  args: { ...personaArgs, participantId: v.id('participants') },
  handler: async (ctx, { personaKey, participantId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    const p = await ctx.db.get(participantId);
    if (!p || p.userId !== me._id) return [];
    const c = await ctx.db.get(p.challengeId);
    if (!c) return [];

    const proofs = await ctx.db
      .query('proofs')
      .withIndex('by_participant', (q) => q.eq('participantId', participantId))
      .collect();
    const covered = new Set(
      proofs
        .filter((r) => r.status !== 'disputed' && r.forDate)
        .map((r) => r.forDate!)
    );

    const pings = await ctx.db
      .query('locationPings')
      .withIndex('by_user_challenge', (q) =>
        q.eq('userId', me._id).eq('challengeId', p.challengeId)
      )
      .collect();

    // Bucket pings by UTC date.
    const buckets = new Map<
      string,
      { count: number; firstAt: number; lastAt: number; lat: number; lng: number }
    >();
    for (const ping of pings) {
      const date = new Date(ping.recordedAt).toISOString().slice(0, 10);
      const cur = buckets.get(date);
      if (!cur) {
        buckets.set(date, {
          count: 1,
          firstAt: ping.recordedAt,
          lastAt: ping.recordedAt,
          lat: ping.lat,
          lng: ping.lng,
        });
      } else {
        cur.count += 1;
        cur.firstAt = Math.min(cur.firstAt, ping.recordedAt);
        cur.lastAt = Math.max(cur.lastAt, ping.recordedAt);
        // Rolling centroid — good enough for a sample point.
        cur.lat = (cur.lat * (cur.count - 1) + ping.lat) / cur.count;
        cur.lng = (cur.lng * (cur.count - 1) + ping.lng) / cur.count;
      }
    }

    const out: Array<{
      date: string;
      pingCount: number;
      firstAt: number;
      lastAt: number;
      sampleLat: number;
      sampleLng: number;
    }> = [];
    for (const [date, b] of buckets.entries()) {
      if (b.count < PINGS_PER_DAY_FOR_BACKFILL) continue;
      if (covered.has(date)) continue;
      // Bound to the bet window (allow a small grace).
      const ts = b.firstAt;
      if (ts < c.startsAt - DAY_MS || ts > c.endsAt + DAY_MS) continue;
      out.push({
        date,
        pingCount: b.count,
        firstAt: b.firstAt,
        lastAt: b.lastAt,
        sampleLat: b.lat,
        sampleLng: b.lng,
      });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : 1));
    return out;
  },
});

// Create a synthetic check-in row from background pings for a given day.
// No photo; GPS is the centroid of that day's pings. Status starts
// 'submitted' so the counterparty can still dispute, but flagged with
// derivedFromPings so the UI labels it honestly.
export const backfillFromPings = mutation({
  args: {
    ...personaArgs,
    participantId: v.id('participants'),
    date: v.string(),
  },
  handler: async (ctx, { personaKey, participantId, date }) => {
    const me = await ensureProfile(ctx, personaKey);
    const p = await ctx.db.get(participantId);
    if (!p) throw new Error('Participant not found.');
    if (p.userId !== me._id) throw new Error('Not your row.');

    // Don't overwrite an existing check-in for the same day.
    const existing = await ctx.db
      .query('proofs')
      .withIndex('by_participant_date', (q) =>
        q.eq('participantId', participantId).eq('forDate', date)
      )
      .first();
    if (existing && existing.status !== 'disputed') {
      return { ok: false, reason: 'already' as const };
    }

    const allPings = await ctx.db
      .query('locationPings')
      .withIndex('by_user_challenge', (q) =>
        q.eq('userId', me._id).eq('challengeId', p.challengeId)
      )
      .collect();
    const dayPings = allPings.filter(
      (ping) => new Date(ping.recordedAt).toISOString().slice(0, 10) === date
    );
    if (dayPings.length < PINGS_PER_DAY_FOR_BACKFILL) {
      return { ok: false, reason: 'not_enough_pings' as const };
    }

    const lat = dayPings.reduce((s, x) => s + x.lat, 0) / dayPings.length;
    const lng = dayPings.reduce((s, x) => s + x.lng, 0) / dayPings.length;
    const firstAt = dayPings.reduce(
      (m, x) => Math.min(m, x.recordedAt),
      dayPings[0].recordedAt
    );

    const distinct = new Set(
      allPings
        // After insertion this date will be the next session marker; recompute.
        .map((ping) => new Date(ping.recordedAt).toISOString().slice(0, 10))
    );
    const proofs = await ctx.db
      .query('proofs')
      .withIndex('by_participant', (q) => q.eq('participantId', participantId))
      .collect();
    const datesCovered = new Set(
      proofs
        .filter((row) => row.status !== 'disputed' && row.forDate)
        .map((row) => row.forDate!)
    );
    datesCovered.add(date);
    const sessionIndex = Array.from(datesCovered).sort().indexOf(date) + 1;

    if (existing) {
      await ctx.db.patch(existing._id, {
        submittedAt: Date.now(),
        gpsLat: lat,
        gpsLng: lng,
        status: 'submitted',
        sessionIndex,
        derivedFromPings: true,
        photoTakenAt: firstAt,
      });
      await emitProofSessionCompleted(ctx, p, date);
      return { ok: true, proofId: existing._id, sessionIndex };
    }

    const id = await ctx.db.insert('proofs', {
      participantId: p._id,
      challengeId: p.challengeId,
      submittedAt: Date.now(),
      gpsLat: lat,
      gpsLng: lng,
      photoTakenAt: firstAt,
      status: 'submitted',
      forDate: date,
      sessionIndex,
      derivedFromPings: true,
    });
    await emitProofSessionCompleted(ctx, p, date);
    return { ok: true, proofId: id as Id<'proofs'>, sessionIndex };
  },
});

// Shared by submitProof + backfillFromPings: fire session_completed to
// friends once a forDate-bearing, non-disputed proof has landed. Counts
// distinct non-disputed dates post-write (we re-query so the row we just
// inserted is included). Latched per viewer/stake/date.
async function emitProofSessionCompleted(
  ctx: any,
  participant: Doc<'participants'>,
  forDate: string
): Promise<void> {
  if (participant.status !== 'active') return;
  const challenge = await ctx.db.get(participant.challengeId);
  if (!challenge) return;
  const proofs = await ctx.db
    .query('proofs')
    .withIndex('by_participant', (q: any) => q.eq('participantId', participant._id))
    .collect();
  const progress = new Set(
    proofs
      .filter((row: Doc<'proofs'>) => row.status !== 'disputed' && row.forDate)
      .map((row: Doc<'proofs'>) => row.forDate!)
  ).size;
  const hoursLeft = (challenge.endsAt - Date.now()) / 3_600_000;
  await emitFriendEvent(ctx, {
    actorUserId: participant.userId,
    kind: 'session_completed',
    challengeId: challenge._id,
    participantId: participant._id,
    payload: {
      stakeTitle: challenge.title,
      stakeAmount: participant.stakeAmount,
      activityKey: challenge.activityKey ?? 'steps',
      progress,
      goal: challenge.stepGoal,
      hoursLeft,
    },
    latchKey: 'session_completed:' + forDate,
  });
}

// Summary helper used by the bet detail strip. Returns one cell per day
// of the bet window with state: 'done' | 'today' | 'missed' | 'upcoming'.
// goal = number of distinct days required (the bet's stepGoal for binary
// multi-session bets; settlement counts the same way).
export const sessionStrip = query({
  args: { ...personaArgs, participantId: v.id('participants') },
  handler: async (ctx, { personaKey, participantId }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return null;
    const p = await ctx.db.get(participantId);
    if (!p) return null;
    const c = await ctx.db.get(p.challengeId);
    if (!c) return null;
    // Other participants' check-ins are visible (for counterparties); only
    // gate the my-row queries above on owner.

    const proofs = await ctx.db
      .query('proofs')
      .withIndex('by_participant', (q) => q.eq('participantId', participantId))
      .collect();

    const goal = c.stepGoal;
    const totalDays = Math.max(1, Math.ceil((c.endsAt - c.startsAt) / DAY_MS));
    const today = new Date().toISOString().slice(0, 10);

    type Cell = {
      date: string;
      state: 'done' | 'today' | 'missed' | 'upcoming' | 'disputed';
      sessionIndex: number | null;
      proofId: Id<'proofs'> | null;
      derivedFromPings: boolean;
    };
    const cells: Cell[] = [];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(c.startsAt + i * DAY_MS).toISOString().slice(0, 10);
      const row = proofs.find((r) => r.forDate === d);
      let state: Cell['state'];
      if (row && row.status === 'disputed') state = 'disputed';
      else if (row) state = 'done';
      else if (d === today) state = 'today';
      else if (d < today) state = 'missed';
      else state = 'upcoming';
      cells.push({
        date: d,
        state,
        sessionIndex: row?.sessionIndex ?? null,
        proofId: row?._id ?? null,
        derivedFromPings: row?.derivedFromPings ?? false,
      });
    }

    const sessionsDone = proofs.filter(
      (r) => r.status !== 'disputed' && r.forDate
    ).length;

    return {
      goal,
      totalDays,
      sessionsDone,
      cells,
      today,
    };
  },
});

// Helper for settlement — exported so settle.ts can reuse the same rule:
// a multi-session non-sensor bet finishes when N distinct non-disputed
// check-in days exist.
export function countDistinctSessions(rows: Doc<'proofs'>[]): number {
  const dates = new Set<string>();
  for (const r of rows) {
    if (r.status === 'disputed') continue;
    if (!r.forDate) continue;
    dates.add(r.forDate);
  }
  return dates.size;
}
