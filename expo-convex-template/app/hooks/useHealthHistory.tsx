// Last-30-day health stats. Feeds the onboarding suggestion cards and any
// future "you've been on a tear / on a slip" copy.
//
// Lazy: only fires when something actually mounts the hook. 1h staleTime
// because the user isn't going to dramatically change their averages
// mid-session; we don't need 60s polling.
//
// Falls back to zeros / empty when permissions aren't granted or the
// platform module isn't available (simulator + Android without HC).

import { useQuery } from '@tanstack/react-query';

import {
  getDistanceForRange,
  getStepsForRange,
  getWorkoutsForRange,
} from '@/lib/health';

const RANGE_DAYS = 30;

export type HealthHistorySummary = {
  avgSteps: number;
  peakSteps: number;
  p50Steps: number;
  weeklyWorkouts: number;
  weeklyRunKm: number;
  totalDays: number;
};

const EMPTY: HealthHistorySummary = {
  avgSteps: 0,
  peakSteps: 0,
  p50Steps: 0,
  weeklyWorkouts: 0,
  weeklyRunKm: 0,
  totalDays: 0,
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export function useHealthHistory(enabled = true) {
  const q = useQuery({
    queryKey: ['health', 'history', RANGE_DAYS],
    enabled,
    staleTime: 60 * 60 * 1000, // 1h
    queryFn: async (): Promise<HealthHistorySummary> => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - RANGE_DAYS);
      start.setHours(0, 0, 0, 0);

      const [steps, workouts, distance] = await Promise.all([
        getStepsForRange(start, end),
        getWorkoutsForRange(start, end),
        getDistanceForRange(start, end),
      ]);

      if (steps.length === 0 && workouts.length === 0 && distance.length === 0) {
        return EMPTY;
      }

      const stepValues = steps.map((d) => d.steps).filter((n) => n > 0);
      const avgSteps =
        stepValues.length > 0
          ? Math.round(stepValues.reduce((a, b) => a + b, 0) / stepValues.length)
          : 0;
      const peakSteps = stepValues.length > 0 ? Math.max(...stepValues) : 0;
      const p50Steps = median(stepValues);

      const weeks = Math.max(1, RANGE_DAYS / 7);
      const weeklyWorkouts = Math.round(workouts.length / weeks);

      // Distance.meters → km, sum total over the range, average per week.
      const totalMeters = distance.reduce((s, d) => s + d.meters, 0);
      const weeklyRunKm = Math.round(totalMeters / 1000 / weeks);

      return {
        avgSteps,
        peakSteps,
        p50Steps,
        weeklyWorkouts,
        weeklyRunKm,
        totalDays: stepValues.length,
      };
    },
  });

  return {
    summary: q.data ?? EMPTY,
    isLoading: q.isLoading,
    isReady: !q.isLoading && q.data !== undefined,
    error: q.error,
  };
}
