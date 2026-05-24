// Pokes — featherweight friend nudges.
//
// sendPoke is friendship-gated and self-poke guarded. Each successful poke
// triggers a push notification carrying { kind: 'poke', emoji, fromName }
// so the tap handler in app/hooks/usePushNotifications.ts can route to
// the sender's friend detail and the in-app burst overlay queues the row.
//
// myInbox returns the most recent unseen pokes; markSeen stamps the row
// when the burst plays. Keep that contract tight — never auto-mark on
// query read or the burst will never play.

import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { isFriendOf } from './friends';
import { schedulePushForUsers } from './notifications';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

const ALLOWED_EMOJIS = new Set(['👋', '🔥', '💪', '🏃', '🎯', '👀', '😈', '⚡']);

export const sendPoke = mutation({
  args: {
    ...personaArgs,
    toUserId: v.id('profiles'),
    emoji: v.string(),
  },
  handler: async (ctx, { personaKey, toUserId, emoji }) => {
    if (!ALLOWED_EMOJIS.has(emoji)) {
      throw new Error('Pick one of the suggested emojis.');
    }
    const me = await ensureProfile(ctx, personaKey);
    if (me._id === toUserId) {
      throw new Error("You can't poke yourself.");
    }
    const friend = await isFriendOf(ctx as any, me._id, toUserId);
    if (!friend) {
      throw new Error('Pokes are friends-only.');
    }
    const target = await ctx.db.get(toUserId);
    if (!target) throw new Error('Friend not found.');

    const id = await ctx.db.insert('pokes', {
      fromUserId: me._id,
      toUserId,
      emoji,
      createdAt: Date.now(),
    });

    await schedulePushForUsers(ctx, [toUserId], {
      title: `${me.displayName ?? 'A friend'} poked you`,
      body: emoji,
      data: {
        kind: 'poke',
        emoji,
        fromUserId: me._id,
        fromName: me.displayName ?? null,
      },
    });

    return id;
  },
});

export const myInbox = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];

    const rows = await ctx.db
      .query('pokes')
      .withIndex('by_to_user', (q) => q.eq('toUserId', me._id))
      .order('desc')
      .take(20);

    const unseen = rows.filter((r) => !r.seenAt).slice(0, 10);
    const senderIds = Array.from(new Set(unseen.map((p) => p.fromUserId)));
    const senders = await Promise.all(senderIds.map((id) => ctx.db.get(id)));
    const byId = new Map<Id<'profiles'>, Doc<'profiles'> | null>();
    senderIds.forEach((id, i) => byId.set(id, senders[i] ?? null));

    return unseen.map((p) => {
      const s = byId.get(p.fromUserId);
      return {
        id: p._id,
        emoji: p.emoji,
        createdAt: p.createdAt,
        fromUserId: p.fromUserId,
        fromName: s?.displayName ?? null,
      };
    });
  },
});

export const markSeen = mutation({
  args: { ...personaArgs, id: v.id('pokes') },
  handler: async (ctx, { personaKey, id }) => {
    const me = await ensureProfile(ctx, personaKey);
    const row = await ctx.db.get(id);
    if (!row) return null;
    if (row.toUserId !== me._id) {
      // Only the recipient can mark their own pokes seen.
      return null;
    }
    if (row.seenAt) return null;
    await ctx.db.patch(id, { seenAt: Date.now() });
    return null;
  },
});
