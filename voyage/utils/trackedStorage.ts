import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TrackedRoute, ScanFrequency, PricePoint } from '@/lib/flightTypes';
import { applyTripStatusWidgetSnapshot } from '@/widgets/applyTripStatusWidgetSnapshot';
import { computeTripStatusWidgetSnapshot } from '@/widgets/tripStatusWidgetSnapshot';

export type { TrackedRoute };

const TRACKED_KEY = '@voyage/tracked';
const ORDERS_KEY = '@voyage/orders';
const RECENTS_KEY = '@voyage/recent-searches';
const TRIP_COMPANION_KEY = '@voyage/trip-companion';
const MAX_HISTORY = 30;
const MAX_RECENTS = 6;
const storageListeners = new Set<() => void>();

export type TripTrackingState = 'idle' | 'tracking' | 'paused';

export type TripLocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  recordedAt: number;
};

export type TripCompanionSession = {
  tripId: string;
  selectedDayIndex: number;
  trackingState: TripTrackingState;
  startedAt?: number;
  pausedAt?: number;
  latestLocation?: TripLocationSnapshot | null;
};

type TripCompanionSessionMap = Record<string, TripCompanionSession>;

function emitStorageChanged() {
  for (const listener of storageListeners) listener();
}

export function subscribeTripState(listener: () => void) {
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

function hydrate(r: TrackedRoute): TrackedRoute {
  return {
    ...r,
    scanFrequency: r.scanFrequency ?? 'daily',
    lowestPrice: r.lowestPrice ?? r.lastPrice,
    history: r.history ?? [{ price: r.lastPrice, at: r.lastCheckedAt || r.createdAt }],
  };
}

export async function listTracked(): Promise<TrackedRoute[]> {
  const raw = await AsyncStorage.getItem(TRACKED_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as TrackedRoute[]).map(hydrate);
  } catch {
    return [];
  }
}

export async function saveTracked(route: TrackedRoute): Promise<void> {
  const list = await listTracked();
  const idx = list.findIndex((r) => r.id === route.id);
  const next = hydrate(route);
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  await AsyncStorage.setItem(TRACKED_KEY, JSON.stringify(list));
  await syncTripStatusWidget(list);
  emitStorageChanged();
}

export async function updateTrackedPrice(
  id: string,
  price: number,
  currency: string
): Promise<TrackedRoute | undefined> {
  const list = await listTracked();
  const route = list.find((r) => r.id === id);
  if (!route) return undefined;
  const now = Date.now();
  const history: PricePoint[] = [...(route.history ?? []), { price, at: now }].slice(-MAX_HISTORY);
  const lowestPrice = Math.min(route.lowestPrice ?? price, price);
  const updated: TrackedRoute = {
    ...route,
    lastPrice: price,
    currency,
    lastCheckedAt: now,
    history,
    lowestPrice,
  };
  await saveTracked(updated);
  return updated;
}

export async function setTrackedFrequency(id: string, scanFrequency: ScanFrequency): Promise<void> {
  const list = await listTracked();
  const route = list.find((r) => r.id === id);
  if (!route) return;
  await saveTracked({ ...route, scanFrequency });
}

export type RecentSearch = {
  origin: string;
  destination: string;
  at: number;
};

export async function listRecents(): Promise<RecentSearch[]> {
  const raw = await AsyncStorage.getItem(RECENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentSearch[];
  } catch {
    return [];
  }
}

export async function addRecent(origin: string, destination: string): Promise<void> {
  if (!origin || !destination) return;
  const existing = await listRecents();
  const deduped = existing.filter((r) => !(r.origin === origin && r.destination === destination));
  const next: RecentSearch[] = [{ origin, destination, at: Date.now() }, ...deduped].slice(
    0,
    MAX_RECENTS
  );
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export async function removeTracked(id: string): Promise<void> {
  const list = await listTracked();
  const next = list.filter((r) => r.id !== id);
  await AsyncStorage.setItem(TRACKED_KEY, JSON.stringify(next));
  await syncTripStatusWidget(next);
  emitStorageChanged();
}

export function routeKey(r: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  cabin: string;
}) {
  return `${r.origin}-${r.destination}-${r.departureDate}-${r.returnDate ?? 'ow'}-${r.adults}-${r.cabin}`;
}

export type StoredOrder = {
  id: string;
  bookingReference: string;
  totalAmount: string;
  totalCurrency: string;
  passengerName: string;
  slices: {
    origin: string;
    destination: string;
    departing_at: string;
    arriving_at: string;
    carrierName: string;
    flightNumber: string;
    carrierCode?: string;
  }[];
  createdAt: number;
  trackedId?: string;
};

export async function markTrackedBooked(trackedId: string, orderId: string): Promise<void> {
  const list = await listTracked();
  const idx = list.findIndex((r) => r.id === trackedId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], bookedOrderId: orderId };
  await AsyncStorage.setItem(TRACKED_KEY, JSON.stringify(list));
  await syncTripStatusWidget(list);
  emitStorageChanged();
}

export async function getTracked(id: string): Promise<TrackedRoute | undefined> {
  const list = await listTracked();
  return list.find((r) => r.id === id);
}

export async function listOrders(): Promise<StoredOrder[]> {
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredOrder[];
  } catch {
    return [];
  }
}

export async function saveOrder(order: StoredOrder): Promise<void> {
  const list = await listOrders();
  list.unshift(order);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  await syncTripStatusWidget(undefined, list);
  emitStorageChanged();
}

export async function getOrder(id: string): Promise<StoredOrder | undefined> {
  const list = await listOrders();
  return list.find((o) => o.id === id);
}

async function listTripCompanionSessionMap(): Promise<TripCompanionSessionMap> {
  const raw = await AsyncStorage.getItem(TRIP_COMPANION_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as TripCompanionSessionMap;
  } catch {
    return {};
  }
}

export async function getTripCompanionSession(
  tripId: string
): Promise<TripCompanionSession | undefined> {
  const all = await listTripCompanionSessionMap();
  return all[tripId];
}

export async function saveTripCompanionSession(session: TripCompanionSession): Promise<void> {
  const all = await listTripCompanionSessionMap();
  all[session.tripId] = session;
  await AsyncStorage.setItem(TRIP_COMPANION_KEY, JSON.stringify(all));
  emitStorageChanged();
}

export async function clearTripCompanionSession(tripId: string): Promise<void> {
  const all = await listTripCompanionSessionMap();
  delete all[tripId];
  await AsyncStorage.setItem(TRIP_COMPANION_KEY, JSON.stringify(all));
  emitStorageChanged();
}

export async function syncTripStatusWidgetFromStorage(): Promise<void> {
  await syncTripStatusWidget();
}

async function syncTripStatusWidget(
  trackedOverride?: TrackedRoute[],
  ordersOverride?: StoredOrder[]
): Promise<void> {
  try {
    const tracked = trackedOverride ?? (await listTracked());
    const orders = ordersOverride ?? (await listOrders());
    applyTripStatusWidgetSnapshot(computeTripStatusWidgetSnapshot(orders, tracked));
  } catch {
    // Ignore widget sync failures; storage operations should still succeed.
  }
}
