import type { TrackedRoute, StoredOrder } from '@/utils/trackedStorage';

export type TripStatusWidgetProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  footer: string;
};

export function computeTripStatusWidgetSnapshot(
  orders: StoredOrder[],
  tracked: TrackedRoute[],
  now = Date.now()
): TripStatusWidgetProps {
  const nextTrip = getNextTrip(orders, now);
  const watchedRoute = getWatchedRoute(tracked, now);

  if (nextTrip) {
    const firstSlice = nextTrip.slices[0];
    const lastSlice = nextTrip.slices[nextTrip.slices.length - 1];
    const departAt = new Date(firstSlice.departing_at);

    return {
      eyebrow: 'Next trip',
      title: `${firstSlice.origin} -> ${lastSlice.destination}`,
      subtitle: formatDepartureSummary(departAt, now),
      footer:
        watchedRoute && watchedRoute.delta < 0
          ? `Daily drop ${watchedRoute.route.currency} ${Math.abs(Math.round(watchedRoute.delta))} on ${watchedRoute.route.origin}->${watchedRoute.route.destination}`
          : `Ref ${nextTrip.bookingReference}`,
    };
  }

  if (watchedRoute) {
    const route = watchedRoute.route;
    const deltaLabel =
      watchedRoute.delta < 0
        ? `Down ${route.currency} ${Math.abs(Math.round(watchedRoute.delta))} today`
        : watchedRoute.delta > 0
          ? `Up ${route.currency} ${Math.round(watchedRoute.delta)} today`
          : `Lowest ${route.currency} ${Math.round(route.lowestPrice ?? route.lastPrice)}`;

    return {
      eyebrow: 'Daily price watch',
      title: `${route.origin} -> ${route.destination}`,
      subtitle: `${route.currency} ${Math.round(route.lastPrice)} • ${deltaLabel}`,
      footer: `Checked ${formatTime(route.lastCheckedAt || now)}`,
    };
  }

  return {
    eyebrow: 'Voyage',
    title: 'No trips yet',
    subtitle: 'Track a fare or book a flight to fill this widget.',
    footer: `Updated ${formatTime(now)}`,
  };
}

function getNextTrip(orders: StoredOrder[], now: number): StoredOrder | null {
  return (
    [...orders]
      .filter((order) => {
        const departAt = Date.parse(order.slices[0]?.departing_at ?? '');
        return Number.isFinite(departAt) && departAt >= now - 6 * 60 * 60 * 1000;
      })
      .sort((a, b) => {
        const aDepartAt = Date.parse(a.slices[0]?.departing_at ?? '');
        const bDepartAt = Date.parse(b.slices[0]?.departing_at ?? '');
        return aDepartAt - bDepartAt;
      })[0] ?? null
  );
}

function getWatchedRoute(tracked: TrackedRoute[], now: number) {
  return (
    [...tracked]
      .map((route) => ({
        route,
        delta: getDailyDelta(route, now),
      }))
      .sort((a, b) => {
        if (a.delta !== b.delta) return a.delta - b.delta;
        return (b.route.lastCheckedAt || 0) - (a.route.lastCheckedAt || 0);
      })[0] ?? null
  );
}

function getDailyDelta(route: TrackedRoute, now: number) {
  const history = route.history ?? [];
  if (history.length < 2) return 0;

  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const comparisonPoint =
    [...history]
      .reverse()
      .find((point) => point.at <= oneDayAgo) ??
    history[history.length - 2];

  return route.lastPrice - comparisonPoint.price;
}

function formatDepartureSummary(departAt: Date, now: number) {
  const diffMs = departAt.getTime() - now;
  const diffHours = Math.round(diffMs / (60 * 60 * 1000));

  if (diffHours <= 0) return `Departs today • ${formatTime(departAt.getTime())}`;
  if (diffHours < 24) return `Departs in ${diffHours}h • ${formatTime(departAt.getTime())}`;

  const diffDays = Math.round(diffHours / 24);
  return `Departs in ${diffDays}d • ${formatMonthDay(departAt)}`;
}

function formatMonthDay(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
