// RevenueCat in-app purchase crediting.
//
// Called only by the /rc-webhook HTTP action. Idempotent: re-delivery of the
// same RC event (same store transaction id) is a no-op. The ref column on
// the existing transactions table is the idempotency key.

import { v } from 'convex/values';

import { internalMutation } from './_generated/server';
import { applyDelta, recordTx } from './wallet';

export const creditTopUp = internalMutation({
  args: {
    profileId: v.id('profiles'),
    amount: v.number(),
    storeTxId: v.string(),
  },
  handler: async (ctx, { profileId, amount, storeTxId }) => {
    if (amount <= 0) throw new Error('IAP amount must be positive.');
    const ref = `rc:${storeTxId}`;

    const existing = await ctx.db
      .query('transactions')
      .withIndex('by_ref', (q) => q.eq('ref', ref))
      .first();
    if (existing) {
      return { idempotent: true as const };
    }

    const profile = await ctx.db.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found for IAP credit: ${profileId}`);
    }

    await applyDelta(ctx, profile, amount);
    await recordTx(ctx, profile._id, 'topup', amount, ref);
    return { idempotent: false as const, credited: amount };
  },
});
