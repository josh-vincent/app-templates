// Convenience hook for gating premium features behind the `fitStake Pro`
// entitlement. Use anywhere you want to read the current subscription state
// and present a paywall when the user taps a locked feature.
//
//   const pro = useFitStakeProGate();
//   if (!pro.isPro) {
//     await pro.presentPaywall();
//     return;
//   }
//   doThePremiumThing();

import { useCallback } from 'react';

import { useRevenueCat } from '@/components/RevenueCatProvider';
import { PRO_ENTITLEMENT } from '@/lib/revenuecat';

export function useFitStakeProGate() {
  const {
    ready,
    isPro,
    currentOffering,
    customerInfo,
    presentPaywall,
    presentPaywallIfNeeded,
    presentCustomerCenter,
    restorePurchases,
  } = useRevenueCat();

  const requirePro = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;
    await presentPaywallIfNeeded(PRO_ENTITLEMENT, { offering: currentOffering ?? undefined });
    return false;
  }, [isPro, presentPaywallIfNeeded, currentOffering]);

  return {
    ready,
    isPro,
    customerInfo,
    requirePro,
    presentPaywall: () => presentPaywall({ offering: currentOffering ?? undefined }),
    presentCustomerCenter,
    restorePurchases,
  };
}
