import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
type ProfileId = Id<'profiles'>;
import { type MutationCtx, mutation, query } from './_generated/server';
import { ensureProfile, ensureProfileQuery, personaArgs } from './users';

export const transactions = query({
  args: { ...personaArgs },
  handler: async (ctx, { personaKey }) => {
    const me = await ensureProfileQuery(ctx, personaKey);
    if (!me) return [];
    const rows = await ctx.db
      .query('transactions')
      .withIndex('by_user', (q) => q.eq('userId', me._id))
      .collect();
    return rows.sort(
      (a, b) => (b.at ?? b._creationTime) - (a.at ?? a._creationTime)
    );
  },
});

// Dev-only mock top-up. Real-auth users go through RevenueCat IAP +
// /rc-webhook → internal.iap.creditTopUp. Personas keep this path so the
// multi-sim dev loop is unblocked.
export const topUp = mutation({
  args: { ...personaArgs, amount: v.number() },
  handler: async (ctx, { personaKey, amount }) => {
    if (!personaKey) {
      throw new Error('Mock top-up is dev-only. Use the in-app purchase flow.');
    }
    if (amount <= 0 || amount > 500) throw new Error('Top-up out of range.');
    const me = await ensureProfile(ctx, personaKey);
    await applyDelta(ctx, me, amount);
    await ctx.db.insert('transactions', {
      userId: me._id,
      type: 'topup',
      amount,
      ref: 'mock',
    });
    return null;
  },
});

// Internal helper — adjust wallet balance and return the patched doc.
export async function applyDelta(
  ctx: MutationCtx,
  profile: Doc<'profiles'>,
  delta: number
) {
  const next = profile.walletBalance + delta;
  if (next < 0) throw new Error('Insufficient balance.');
  await ctx.db.patch(profile._id, { walletBalance: next });
}

export async function recordTx(
  ctx: MutationCtx,
  userId: ProfileId,
  type: 'topup' | 'stake' | 'refund' | 'forfeit' | 'jackpotWin',
  amount: number,
  ref?: string
) {
  await ctx.db.insert('transactions', { userId, type, amount, ref });
}
