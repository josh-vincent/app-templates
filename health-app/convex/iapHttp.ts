// RevenueCat webhook receiver. RC POSTs every purchase event to this URL
// with a fixed Authorization header (configured in the RC dashboard).
//
// We only act on initial / non-renewing purchase events (consumables).
// Subscription renewals, cancellations, billing issues, etc. are logged but
// ignored — HealthPulse is consumables-only today.

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import { SKU_TO_CREDIT } from './iapSkus';

type RCEvent = {
  type: string;
  app_user_id: string;
  product_id: string;
  transaction_id?: string;
  original_transaction_id?: string;
};

type RCBody = {
  event: RCEvent;
  api_version?: string;
};

const CREDITING_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);

export const rcWebhook = httpAction(async (ctx, request) => {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) {
    console.error('[rc-webhook] REVENUECAT_WEBHOOK_SECRET not configured');
    return new Response('Server misconfigured', { status: 500 });
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: RCBody;
  try {
    body = (await request.json()) as RCBody;
  } catch (e) {
    console.warn('[rc-webhook] invalid JSON', e);
    return new Response('Bad request', { status: 400 });
  }

  const event = body?.event;
  if (!event || !event.type) {
    return new Response('Missing event', { status: 400 });
  }

  if (!CREDITING_EVENT_TYPES.has(event.type)) {
    console.log(`[rc-webhook] ignoring event type=${event.type}`);
    return new Response('OK', { status: 200 });
  }

  const amount = SKU_TO_CREDIT[event.product_id];
  if (typeof amount !== 'number') {
    console.warn(`[rc-webhook] unknown product_id=${event.product_id}`);
    return new Response('OK', { status: 200 });
  }

  const storeTxId = event.transaction_id ?? event.original_transaction_id;
  if (!storeTxId) {
    console.warn('[rc-webhook] missing transaction_id', event);
    return new Response('OK', { status: 200 });
  }

  if (!event.app_user_id) {
    console.warn('[rc-webhook] missing app_user_id', event);
    return new Response('OK', { status: 200 });
  }

  try {
    const profileId = event.app_user_id as Id<'profiles'>;
    const result = await ctx.runMutation(internal.iap.creditTopUp, {
      profileId,
      amount,
      storeTxId,
    });
    console.log(
      `[rc-webhook] ${result.idempotent ? 'idempotent' : `credited ${amount}`} ` +
        `profile=${event.app_user_id} product=${event.product_id} tx=${storeTxId}`
    );
    return new Response('OK', { status: 200 });
  } catch (e) {
    // Profile not found / mutation error. Return 200 so RC stops retrying.
    // For genuine infra issues we'd return 5xx, but here mutation failures
    // are likely permanent (bad app_user_id) and retries won't help.
    console.error('[rc-webhook] credit failed', e);
    return new Response('OK', { status: 200 });
  }
});
