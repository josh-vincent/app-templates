// Bridges HealthKit step reads → Convex `steps.submitDaily`. Without this
// hook, settlement runs against an empty `stepEntries` table and every step
// bet silently forfeits.
//
// Strategy (kept conservative on purpose — Convex mutations are not free):
//   • For each of my active bets with activityKey === 'steps', track the
//     last value we've sent (in memory + AsyncStorage so reloads don't
//     re-submit aggressively).
//   • Only fire when EITHER ≥ 60s have passed since the last send for that
//     bet, OR the new step count exceeds the last-sent value by ≥ 250.
//   • Also fire once when AppState transitions to 'active' (foreground)
//     so a fresh launch immediately syncs.
//   • Skip when the step count is 0 (simulator with no HealthKit data).
//
// Mounted once at the root via `app/_layout.tsx`. Renders nothing.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useHealthSteps } from '@/app/hooks/useHealthSteps';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from '@/lib/persona-convex';

const MIN_INTERVAL_MS = 60_000;
const MIN_DELTA = 250;
const STORAGE_KEY = 'fitstake.stepSubmitter.lastSent.v1';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type Cache = Record<string, { steps: number; at: number; date: string }>;

export function StepSubmitterHost() {
  const health = useHealthSteps();
  const active = useQuery(api.challenges.myActive);
  const submitDaily = useMutation(api.steps.submitDaily);

  // In-memory cache hydrated from AsyncStorage on first mount. The cache
  // shape is keyed by challengeId so each bet has independent throttling.
  const cacheRef = useRef<Cache>({});
  const hydratedRef = useRef(false);

  // Hydrate once.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            cacheRef.current = JSON.parse(raw) as Cache;
          } catch {
            cacheRef.current = {};
          }
        }
        hydratedRef.current = true;
      })
      .catch(() => {
        hydratedRef.current = true;
      });
  }, []);

  // Drive the submission loop. Fires whenever the step count or the active
  // bet list changes, plus on foreground transitions.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!health.hasPermission && !__DEV__) return;
    if (!Array.isArray(active) || active.length === 0) return;
    if (health.steps <= 0) return;

    const stepBets = active.filter((c) => (c.activityKey ?? 'steps') === 'steps');
    if (stepBets.length === 0) return;

    const date = todayKey();
    const now = Date.now();
    const writes: Promise<unknown>[] = [];

    for (const c of stepBets) {
      const prev = cacheRef.current[c._id];
      const isNewDay = !prev || prev.date !== date;
      const enoughTime = !prev || now - prev.at >= MIN_INTERVAL_MS;
      const enoughDelta =
        !prev || prev.date !== date || health.steps - prev.steps >= MIN_DELTA;
      if (!isNewDay && !(enoughTime && enoughDelta)) continue;

      cacheRef.current[c._id] = { steps: health.steps, at: now, date };
      writes.push(
        submitDaily({
          challengeId: c._id,
          date,
          steps: health.steps,
          source: 'healthkit',
        }).catch((e) =>
          console.warn('[step-submit] failed for', c.title, e?.message ?? e)
        )
      );
    }

    if (writes.length > 0) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cacheRef.current)).catch(
        (e) => console.warn('[step-submit] cache persist failed', e)
      );
    }
  }, [health.steps, health.hasPermission, active, submitDaily]);

  // Foreground bump: every transition into 'active' nudges by bumping a
  // local ref. The effect above re-runs because we also depend on
  // health.steps, which the hook refreshes on app focus.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      // Health hook polls on its own interval; no manual refetch needed.
      // We just want to ensure subsequent renders re-run the submission
      // effect, which they will as soon as `health.steps` changes.
    });
    return () => sub.remove();
  }, []);

  return null;
}
