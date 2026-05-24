import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  activateMockPremium,
  cancelMockPremium,
  FREE_PREMIUM_STATE,
  getPremiumState,
  type PremiumPlan,
  type PremiumState,
} from '@/lib/premium';

type PremiumContextValue = {
  state: PremiumState;
  isPremium: boolean;
  refresh: () => Promise<void>;
  activate: (plan: Exclude<PremiumPlan, 'free'>) => Promise<void>;
  cancel: () => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PremiumState>(FREE_PREMIUM_STATE);

  const refresh = useCallback(async () => {
    setState(await getPremiumState());
  }, []);

  const activate = useCallback(async (plan: Exclude<PremiumPlan, 'free'>) => {
    setState(await activateMockPremium(plan));
  }, []);

  const cancel = useCallback(async () => {
    setState(await cancelMockPremium());
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const value = useMemo<PremiumContextValue>(
    () => ({
      state,
      isPremium: state.status === 'active',
      refresh,
      activate,
      cancel,
    }),
    [activate, cancel, refresh, state]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const context = useContext(PremiumContext);
  if (!context) throw new Error('usePremium must be used within PremiumProvider');
  return context;
}
