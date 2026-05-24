// Pumps the latest widget snapshot from Convex into the iOS App Group so
// the home-screen widgets / Live Activity / Watch app all see fresh data.
// Also manages the lifecycle of the single Live Activity tied to the
// soonest-ending active bet.

import { useQuery } from 'convex/react';
import { useEffect, useMemo, useRef } from 'react';

import { api } from '@/convex/_generated/api';
import { WidgetBridge, type WidgetSnapshot } from '@/lib/widgetBridge';

import { useHealthSteps } from './useHealthSteps';

export function useWidgetSnapshot(personaKey?: string) {
  const data = useQuery(api.widgetSnapshot.snapshot, personaKey ? { personaKey } : {});
  const { steps: liveSteps } = useHealthSteps();
  const liveActivityIdRef = useRef<string | null>(null);
  const liveActivityBetIdRef = useRef<string | null>(null);

  // Merge live HealthKit steps in over the Convex snapshot. Convex's
  // todaySteps reads from `stepEntries` which only fills after the step
  // submitter cron runs — the widget should match what the app shows
  // *right now*, which is HealthKit's live value.
  const snapshot = useMemo<WidgetSnapshot | null>(() => {
    if (!data) return null;
    const base = data as WidgetSnapshot;
    const todaySteps = Math.max(base.todaySteps, liveSteps ?? 0);
    const sparkline = [...(base.sparkline7d ?? [])];
    if (sparkline.length > 0) sparkline[sparkline.length - 1] = todaySteps;
    let streakDays = 0;
    for (let i = sparkline.length - 1; i >= 0; i--) {
      if ((sparkline[i] ?? 0) > 0) streakDays += 1;
      else break;
    }
    const nextBet = base.nextBet
      ? { ...base.nextBet, currentProgress: Math.max(base.nextBet.currentProgress, todaySteps) }
      : null;
    return { ...base, todaySteps, sparkline7d: sparkline, streakDays, nextBet };
  }, [data, liveSteps]);

  useEffect(() => {
    if (!snapshot || !WidgetBridge.available) return;
    WidgetBridge.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || !WidgetBridge.available) return;
    let cancelled = false;

    (async () => {
      const next = snapshot.nextBet;

      // No bet, no live activity.
      if (!next) {
        if (liveActivityIdRef.current) {
          await WidgetBridge.endLiveActivity(liveActivityIdRef.current);
          liveActivityIdRef.current = null;
          liveActivityBetIdRef.current = null;
        }
        return;
      }

      const betKey = next.challengeId;
      const haveSameBet = liveActivityBetIdRef.current === betKey;
      const existingIds = await WidgetBridge.listLiveActivities();

      if (haveSameBet && liveActivityIdRef.current && existingIds.includes(liveActivityIdRef.current)) {
        await WidgetBridge.updateLiveActivity(
          liveActivityIdRef.current,
          next.currentProgress
        );
        return;
      }

      if (liveActivityIdRef.current && existingIds.includes(liveActivityIdRef.current)) {
        await WidgetBridge.endLiveActivity(liveActivityIdRef.current);
      }

      const id = await WidgetBridge.startLiveActivity({
        betId: betKey,
        title: next.title,
        stakeAmount: next.stakeAmount,
        stepGoal: next.stepGoal,
        endsAt: next.endsAt,
        currentSteps: next.currentProgress,
      });
      if (cancelled) {
        if (id) await WidgetBridge.endLiveActivity(id);
        return;
      }
      liveActivityIdRef.current = id;
      liveActivityBetIdRef.current = betKey;
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot]);
}

export function WidgetSnapshotHost() {
  useWidgetSnapshot();
  return null;
}
