import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { listTracked, updateTrackedPrice } from './trackedStorage';
import type { TrackedRoute } from '@/lib/flightTypes';
import { api } from '@/lib/apiBase';
import { addNotification } from './notificationsStorage';
import { findAirport } from '@/lib/airports';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function isDue(route: TrackedRoute): boolean {
  const freq = route.scanFrequency ?? 'daily';
  if (freq === 'manual') return false;
  const since = Date.now() - (route.lastCheckedAt || 0);
  if (freq === 'daily') return since >= DAY - HOUR;
  if (freq === 'weekly') return since >= 7 * DAY - HOUR;
  return false;
}

async function checkTracked() {
  const Notifications =
    Platform.OS === 'web' ? null : await import('expo-notifications').catch(() => null);
  const tracked = await listTracked();
  if (tracked.length === 0) return;

  for (const route of tracked) {
    if (!isDue(route)) continue;
    try {
      const res = await fetch(api('/api/flights/search'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origin: route.origin,
          destination: route.destination,
          departureDate: route.departureDate,
          returnDate: route.returnDate,
          adults: route.adults,
          cabin: route.cabin,
        }),
      });
      if (!res.ok) continue;
      const { offers } = (await res.json()) as {
        offers: { totalAmount: string; totalCurrency: string }[];
      };
      if (!offers?.length) continue;
      const lowest = parseFloat(offers[0].totalAmount);
      const previous = route.lastPrice;
      if (lowest > 0 && lowest < previous) {
        const savings = previous - lowest;
        const from = findAirport(route.origin)?.city ?? route.origin;
        const to = findAirport(route.destination)?.city ?? route.destination;
        if (Notifications) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Price dropped ${offers[0].totalCurrency} ${savings.toFixed(0)}`,
              body: `${route.origin} → ${route.destination} · now ${offers[0].totalCurrency} ${lowest.toFixed(0)}`,
            },
            trigger: null,
          });
        }
        try {
          await addNotification({
            type: 'price_drop',
            title: `${from} → ${to} dropped ${offers[0].totalCurrency} ${savings.toFixed(0)}`,
            message: `Now ${offers[0].totalCurrency} ${lowest.toFixed(0)} on ${route.cabin.replace('_', ' ')}.`,
            time: 'just now',
            icon: 'TrendingDown',
            refs: { trackedId: route.id },
          });
        } catch {
          // notifications storage shouldn't block price updates
        }
      }
      await updateTrackedPrice(route.id, lowest, offers[0].totalCurrency);
    } catch {
      // ignore per-route failure
    }
  }
}

export function PriceWatcher() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('expo-notifications')
        .then((Notifications) => {
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
        })
        .catch(() => {});
    }

    checkTracked();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkTracked();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return null;
}
