// RevenueCat integration entry point. Centralizes:
//   - SDK configure / login as the user's profile resolves
//   - Live CustomerInfo + Offerings via listeners (no polling)
//   - Wallet IAP package selection (consumable top-ups)
//   - Entitlement read-out for `fitStake Pro`
//   - Paywall + Customer Center presentation via react-native-purchases-ui
//   - Restore purchases helper
//
// Personas (multi-sim dev mode) bypass the SDK entirely so the dev loop
// works without sandbox accounts. Real-auth users hit the real SDK.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesError,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { useDevPersona } from '@/contexts/DevPersonaContext';
import { api } from '@/convex/_generated/api';
import { SKU_ORDER } from '@/convex/iapSkus';
import { useQuery } from '@/lib/persona-convex';
import { getApiKey, iapEnabled, PRO_ENTITLEMENT } from '@/lib/revenuecat';

type PurchaseResult = {
  cancelled: boolean;
  customerInfo?: CustomerInfo;
  transactionId?: string;
};

type RevenueCatState = {
  // True once configure has completed (or we've decided to skip it).
  ready: boolean;
  // Latest CustomerInfo from the listener. null until the first fetch
  // resolves or when SDK is skipped (persona / no key).
  customerInfo: CustomerInfo | null;
  // The default offering — null while loading or if none is configured.
  currentOffering: PurchasesOffering | null;
  // Convenience: wallet-credit consumable packages from the default offering.
  packages: PurchasesPackage[];
  // __DEV__ fallback: when no RC offering is configured (e.g. test API key
  // without dashboard products), we fetch raw StoreKit products by SKU so
  // the local StoreKit Configuration file still drives the wallet tiles.
  storeProducts: PurchasesStoreProduct[];
  // True when the `fitStake Pro` entitlement is active.
  isPro: boolean;
  // Initiate purchase of a specific package (consumable or subscription).
  purchasePackage: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  // Purchase a raw StoreKit product (used by the dev fallback above).
  purchaseStoreProduct: (product: PurchasesStoreProduct) => Promise<PurchaseResult>;
  // Present the RC-hosted paywall configured in the dashboard for the
  // current offering. Resolves with PAYWALL_RESULT.
  presentPaywall: (opts?: { offering?: PurchasesOffering }) => Promise<PAYWALL_RESULT>;
  // Show paywall only when the gating entitlement is not active.
  presentPaywallIfNeeded: (
    entitlement?: string,
    opts?: { offering?: PurchasesOffering }
  ) => Promise<PAYWALL_RESULT>;
  // Open the self-service subscription management UI.
  presentCustomerCenter: () => Promise<void>;
  // Restore previous purchases (e.g. user reinstalled the app).
  restorePurchases: () => Promise<CustomerInfo | null>;
  // Manual offerings refresh.
  refreshOfferings: () => Promise<void>;
};

const Ctx = createContext<RevenueCatState>({
  ready: false,
  customerInfo: null,
  currentOffering: null,
  packages: [],
  storeProducts: [],
  isPro: false,
  purchasePackage: async () => ({ cancelled: true }),
  purchaseStoreProduct: async () => ({ cancelled: true }),
  presentPaywall: async () => PAYWALL_RESULT.NOT_PRESENTED,
  presentPaywallIfNeeded: async () => PAYWALL_RESULT.NOT_PRESENTED,
  presentCustomerCenter: async () => {},
  restorePurchases: async () => null,
  refreshOfferings: async () => {},
});

function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { persona } = useDevPersona();
  const me = useQuery(api.users.me);

  const [ready, setReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [storeProducts, setStoreProducts] = useState<PurchasesStoreProduct[]>([]);
  const configuredFor = useRef<string | null>(null);

  const loadOfferings = useCallback(async () => {
    let offering: PurchasesOffering | null = null;
    try {
      const offerings = await Purchases.getOfferings();
      offering = offerings.current ?? null;
      setCurrentOffering(offering);
    } catch (e) {
      console.warn('[revenuecat] getOfferings failed', e);
      setCurrentOffering(null);
    }

    // Dev fallback: when no offering is configured (e.g. fresh project with a
    // test API key, no dashboard products), fetch the wallet SKUs directly so
    // the local StoreKit Configuration file still drives the wallet tiles.
    if (__DEV__ && (!offering || offering.availablePackages.length === 0)) {
      try {
        const products = await Purchases.getProducts(SKU_ORDER);
        const byId: Record<string, PurchasesStoreProduct> = {};
        for (const p of products) byId[p.identifier] = p;
        setStoreProducts(SKU_ORDER.map((s) => byId[s]).filter(Boolean));
      } catch (e) {
        console.warn('[revenuecat] getProducts dev fallback failed', e);
        setStoreProducts([]);
      }
    } else {
      setStoreProducts([]);
    }
  }, []);

  useEffect(() => {
    // Personas, missing keys, or before-auth all mean the UI should render
    // its non-RC state (mock tiles, locked Pro features, "unavailable" copy).
    // Flip `ready` so consumers don't sit on a skeleton.
    if (!iapEnabled(persona)) {
      setReady(true);
      return;
    }
    if (!me || !me._id) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setReady(true);
      return;
    }

    const userId = me._id as string;

    let cancelled = false;
    let removeListener: (() => void) | null = null;

    (async () => {
      try {
        if (configuredFor.current === null) {
          if (__DEV__) {
            await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          }
          Purchases.configure({ apiKey, appUserID: userId });
          configuredFor.current = userId;
        } else if (configuredFor.current !== userId) {
          const result = await Purchases.logIn(userId);
          configuredFor.current = userId;
          if (!cancelled) setCustomerInfo(result.customerInfo);
        }

        // Live updates: RC pushes a new CustomerInfo whenever entitlements,
        // subscriptions, or purchases change. Storing the unsubscribe so we
        // can clean up on unmount or user switch.
        const listener = (info: CustomerInfo) => {
          if (!cancelled) setCustomerInfo(info);
        };
        Purchases.addCustomerInfoUpdateListener(listener);
        removeListener = () => Purchases.removeCustomerInfoUpdateListener(listener);

        // Prime initial state.
        try {
          const info = await Purchases.getCustomerInfo();
          if (!cancelled) setCustomerInfo(info);
        } catch (e) {
          console.warn('[revenuecat] getCustomerInfo failed', e);
        }

        await loadOfferings();
        if (!cancelled) setReady(true);
      } catch (e) {
        console.warn('[revenuecat] configure failed', e);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      if (removeListener) removeListener();
    };
  }, [persona, me, loadOfferings]);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
      try {
        const result = await Purchases.purchasePackage(pkg);
        return {
          cancelled: false,
          customerInfo: result.customerInfo,
          transactionId:
            (result as any)?.transaction?.transactionIdentifier ??
            (result as any)?.productIdentifier ??
            undefined,
        };
      } catch (e) {
        const err = e as PurchasesError;
        if (err?.userCancelled) return { cancelled: true };
        console.warn('[revenuecat] purchase failed', e);
        throw e;
      }
    },
    []
  );

  const purchaseStoreProduct = useCallback(
    async (product: PurchasesStoreProduct): Promise<PurchaseResult> => {
      try {
        const result = await Purchases.purchaseStoreProduct(product);
        return {
          cancelled: false,
          customerInfo: result.customerInfo,
          transactionId:
            (result as any)?.transaction?.transactionIdentifier ??
            (result as any)?.productIdentifier ??
            undefined,
        };
      } catch (e) {
        const err = e as PurchasesError;
        if (err?.userCancelled) return { cancelled: true };
        console.warn('[revenuecat] purchaseStoreProduct failed', e);
        throw e;
      }
    },
    []
  );

  const presentPaywall = useCallback(
    async ({ offering }: { offering?: PurchasesOffering } = {}) => {
      try {
        return await RevenueCatUI.presentPaywall({ offering });
      } catch (e) {
        console.warn('[revenuecat] presentPaywall failed', e);
        return PAYWALL_RESULT.ERROR;
      }
    },
    []
  );

  const presentPaywallIfNeeded = useCallback(
    async (
      entitlement: string = PRO_ENTITLEMENT,
      { offering }: { offering?: PurchasesOffering } = {}
    ) => {
      try {
        return await RevenueCatUI.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: entitlement,
          offering,
        });
      } catch (e) {
        console.warn('[revenuecat] presentPaywallIfNeeded failed', e);
        return PAYWALL_RESULT.ERROR;
      }
    },
    []
  );

  const presentCustomerCenter = useCallback(async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (e) {
      console.warn('[revenuecat] presentCustomerCenter failed', e);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<CustomerInfo | null> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } catch (e) {
      console.warn('[revenuecat] restorePurchases failed', e);
      return null;
    }
  }, []);

  // Pull consumable wallet-top-up packages out of the offering (any package
  // whose product id is one we recognize as a balance pack). Pro / subscription
  // packages will live elsewhere in the offering and are surfaced via the
  // paywall flow rather than the wallet UI.
  const packages = currentOffering?.availablePackages ?? [];

  const isPro = hasProEntitlement(customerInfo);

  return (
    <Ctx.Provider
      value={{
        ready,
        customerInfo,
        currentOffering,
        packages,
        storeProducts,
        isPro,
        purchasePackage,
        purchaseStoreProduct,
        presentPaywall,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        restorePurchases,
        refreshOfferings: loadOfferings,
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRevenueCat() {
  return useContext(Ctx);
}
