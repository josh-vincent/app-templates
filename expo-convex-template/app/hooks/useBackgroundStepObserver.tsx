// Mounts the HealthKit step observer + background delivery once per app
// lifetime (idempotent at the lib layer). Each observer tick invalidates
// the foreground steps query so `useStepSubmitter` re-evaluates and pushes
// the fresh count to Convex.
//
// Lives next to StepSubmitterHost in app/_layout.tsx so both run inside
// the QueryClientProvider.

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useHealthSteps } from '@/app/hooks/useHealthSteps';
import { setupBackgroundDelivery, startStepObserver } from '@/lib/health';

export function BackgroundStepObserverHost() {
  const queryClient = useQueryClient();
  const health = useHealthSteps();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!health.hasPermission) return;
    started.current = true;

    // Fire-and-forget — both are no-ops if the native module isn't there.
    setupBackgroundDelivery().catch((e) =>
      console.warn('[bg-observer] background delivery failed', e)
    );
    startStepObserver(() => {
      queryClient.invalidateQueries({ queryKey: ['health', 'steps', 'today'] });
    });
  }, [health.hasPermission, queryClient]);

  return null;
}
