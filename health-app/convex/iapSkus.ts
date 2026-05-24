// Single source of truth for IAP SKU → wallet credit mapping and the
// premium entitlement id. Imported by both the /rc-webhook handler (to
// derive the credit amount from product_id) and the React Native wallet
// and gating UI.
//
// Keep in sync with:
//   - App Store Connect IAP product entries
//   - Google Play Console managed products
//   - RevenueCat dashboard products, offerings, and entitlements

export const SKU_TO_CREDIT: Record<string, number> = {
  'healthpulse.balance.1': 1,
  'healthpulse.balance.5': 5,
  'healthpulse.balance.10': 10,
  'healthpulse.balance.20': 20,
};

export const SKU_ORDER: string[] = [
  'healthpulse.balance.1',
  'healthpulse.balance.5',
  'healthpulse.balance.10',
  'healthpulse.balance.20',
];

// Name of the premium entitlement configured in the RevenueCat dashboard.
// Subscription products (e.g. healthpulse.pro.monthly / healthpulse.pro.yearly)
// should be attached to this entitlement so customerInfo.entitlements.active
// surfaces it after purchase.
export const PRO_ENTITLEMENT = 'fitStake Pro';
