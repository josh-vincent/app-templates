import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { getStepsForDay, isSupported, requestPermissions } from '@/lib/health';

export function useHealthSteps() {
  const queryClient = useQueryClient();
  const [hasPermission, setHasPermission] = useState(false);
  const [didAsk, setDidAsk] = useState(false);

  // On mount, try silently to init HealthKit (which surfaces existing grants
  // without showing the prompt again).
  useEffect(() => {
    if (!isSupported()) return;
    let cancelled = false;
    (async () => {
      const ok = await requestPermissions();
      if (!cancelled) {
        setHasPermission(ok);
        setDidAsk(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stepsQ = useQuery({
    queryKey: ['health', 'steps', 'today'],
    queryFn: () => getStepsForDay(new Date()),
    enabled: hasPermission,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const requestPermission = useCallback(async () => {
    const ok = await requestPermissions();
    setHasPermission(ok);
    setDidAsk(true);
    if (ok) queryClient.invalidateQueries({ queryKey: ['health'] });
    return ok;
  }, [queryClient]);

  // Dev override: simulator HealthKit can't actually grant or read steps.
  // Set EXPO_PUBLIC_FAKE_STEPS in .env.local to render populated states
  // during UI work. No-op outside __DEV__.
  const fakeSteps = process.env.EXPO_PUBLIC_FAKE_STEPS;
  if (__DEV__ && fakeSteps) {
    return {
      steps: Number(fakeSteps) || 0,
      loading: false,
      hasPermission: true,
      didAsk: true,
      requestPermission: async () => true,
    };
  }

  return {
    steps: stepsQ.data ?? 0,
    loading: stepsQ.isLoading,
    hasPermission,
    didAsk,
    requestPermission,
  };
}
