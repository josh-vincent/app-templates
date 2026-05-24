// Push notifications.
//
// Wave 1 of v3. Mutations register / clear device tokens and toggle the
// per-profile opt-out. The HTTP fan-out happens in `sendPush`, an
// internalAction that POSTs to Expo's push relay (no APNs cert needed
// for dev-client builds — Expo carries the message).
//
// Mutations elsewhere fire a push by:
//   1) building a list of recipient userIds (DB-cheap, in transaction)
//   2) calling schedulePushForUsers(...) which schedules sendPush via
//      ctx.scheduler.runAfter(0, ...). The transaction commits, then the
//      action runs asynchronously.

import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  type MutationCtx,
  internalAction,
  internalMutation,
  mutation,
} from './_generated/server';
import { ensureProfile, personaArgs } from './users';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH = 100;

// ---- Public mutations (called from the client) ----------------------------

export const setPushToken = mutation({
  args: {
    ...personaArgs,
    token: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android')),
    installationId: v.string(),
  },
  handler: async (ctx, { personaKey, token, platform, installationId }) => {
    const me = await ensureProfile(ctx, personaKey);
    const now = Date.now();

    // Upsert by installationId (one row per device per profile).
    const existing = await ctx.db
      .query('pushTokens')
      .withIndex('by_installation', (q) => q.eq('installationId', installationId))
      .first();

    if (existing) {
      // If the device's profile changed (new sign-in on the same device),
      // re-bind the row to the new profile.
      await ctx.db.patch(existing._id, {
        userId: me._id,
        token,
        platform,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert('pushTokens', {
        userId: me._id,
        token,
        platform,
        installationId,
        lastSeenAt: now,
        createdAt: now,
      });
    }
    return null;
  },
});

export const clearPushToken = mutation({
  args: { ...personaArgs, installationId: v.string() },
  handler: async (ctx, { installationId }) => {
    const row = await ctx.db
      .query('pushTokens')
      .withIndex('by_installation', (q) => q.eq('installationId', installationId))
      .first();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

export const setPushPrefs = mutation({
  args: { ...personaArgs, enabled: v.boolean() },
  handler: async (ctx, { personaKey, enabled }) => {
    const me = await ensureProfile(ctx, personaKey);
    await ctx.db.patch(me._id, { pushEnabled: enabled });
    return null;
  },
});

// ---- Server-side helper: callers schedule pushes via this -----------------

export async function schedulePushForUsers(
  ctx: MutationCtx,
  userIds: Array<Id<'profiles'>>,
  payload: { title: string; body: string; data?: Record<string, unknown> }
): Promise<void> {
  if (userIds.length === 0) return;

  // Resolve tokens, honoring per-profile opt-out.
  const tokens: string[] = [];
  for (const userId of userIds) {
    const profile = await ctx.db.get(userId);
    if (!profile) continue;
    if (profile.pushEnabled === false) continue;
    const userTokens = await ctx.db
      .query('pushTokens')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const t of userTokens) tokens.push(t.token);
  }
  if (tokens.length === 0) return;

  await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
    tokens,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  });
}

// ---- Internal action: actually POSTs to Expo ------------------------------

export const sendPush = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.any(),
  },
  handler: async (ctx, { tokens, title, body, data }) => {
    if (tokens.length === 0) return { sent: 0 };

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      data: data ?? {},
      sound: 'default' as const,
    }));

    let sent = 0;
    for (let i = 0; i < messages.length; i += MAX_BATCH) {
      const batch = messages.slice(i, i + MAX_BATCH);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          console.warn(
            `[push] expo relay non-OK (${res.status}) for ${batch.length} messages`
          );
          continue;
        }
        const json = (await res.json()) as {
          data?: Array<{
            status: 'ok' | 'error';
            id?: string;
            details?: { error?: string };
          }>;
        };
        const tickets = json.data ?? [];
        // Reap obviously-dead tokens.
        for (let k = 0; k < tickets.length; k++) {
          const ticket = tickets[k];
          const token = batch[k]?.to;
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered' &&
            token
          ) {
            await ctx.runMutation(internal.notifications.purgeToken, { token });
          } else if (ticket.status === 'ok') {
            sent += 1;
          }
        }
      } catch (e) {
        console.warn('[push] batch failed', e);
      }
    }
    return { sent };
  },
});

// Internal helper called by sendPush to delete a no-longer-valid token row.
export const purgeToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query('pushTokens')
      .withIndex('by_token', (q) => q.eq('token', token))
      .first();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});
