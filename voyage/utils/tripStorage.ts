import AsyncStorage from '@react-native-async-storage/async-storage';

import { deriveTripStatus, tripIdForOrder, type ItineraryDay, type ItinerarySlot, type Trip, type TripStatus } from '@/lib/tripTypes';
import { findAirport } from '@/lib/airports';
import { buildItinerarySkeleton } from '@/lib/itinerarySkeleton';
import type { StoredOrder } from './trackedStorage';
import { listOrders } from './trackedStorage';
import { listSavedActivities, type SavedActivity } from './discoverStorage';
import { listSavedStays, type SavedStay } from './staysStorage';

const TRIPS_KEY = '@voyage/trips';
const SAVED_ACTIVITIES_KEY = '@voyage/saved-activities';
const SAVED_STAYS_KEY = '@voyage/saved-stays';

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribeTrips(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function listTrips(): Promise<Trip[]> {
  const raw = await AsyncStorage.getItem(TRIPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Trip[];
    return Array.isArray(parsed) ? parsed.map(refreshStatus) : [];
  } catch {
    return [];
  }
}

function refreshStatus(t: Trip): Trip {
  const next = deriveTripStatus(t.startDate, t.endDate, (t.orderIds?.length ?? 0) > 0);
  return next === t.status ? t : { ...t, status: next };
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  const all = await listTrips();
  return all.find((t) => t.id === id);
}

export async function saveTrip(trip: Trip): Promise<Trip> {
  const all = await listTrips();
  const idx = all.findIndex((t) => t.id === trip.id);
  const next: Trip = { ...trip, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(all));
  emit();
  return next;
}

export async function removeTrip(id: string): Promise<void> {
  const all = await listTrips();
  const next = all.filter((t) => t.id !== id);
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(next));
  emit();
}

export async function setAllTrips(trips: Trip[]): Promise<void> {
  await AsyncStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  emit();
}

function endOfTripFromOrder(order: StoredOrder): { startDate: string; endDate: string; destinationIata: string; destinationName: string; title: string } {
  const firstSlice = order.slices[0];
  const lastSlice = order.slices[order.slices.length - 1] ?? firstSlice;
  const startDate = (firstSlice?.departing_at ?? '').slice(0, 10);
  const endDate = (lastSlice?.arriving_at ?? firstSlice?.arriving_at ?? '').slice(0, 10);
  const isRoundTrip = order.slices.length > 1 && firstSlice && lastSlice && firstSlice.origin === lastSlice.destination;
  const destinationIata = isRoundTrip ? firstSlice.destination : (lastSlice?.destination ?? firstSlice?.destination ?? '');
  const ap = findAirport(destinationIata);
  const destinationName = ap?.city ?? destinationIata;
  const month = startDate
    ? new Date(startDate).toLocaleDateString(undefined, { month: 'long' })
    : '';
  const title = month ? `${destinationName} · ${month}` : destinationName;
  return { startDate, endDate, destinationIata, destinationName, title };
}

/**
 * Returns activities and stays that match a trip's destination and are not
 * already linked to a different trip, along with the updated records (with
 * tripId set) ready to be written back to storage.
 */
async function autoLinkCandidates(
  tripId: string,
  primaryDestination: string,
  primaryDestinationName: string,
  existingStayIds: string[],
  existingActivityIds: string[],
): Promise<{
  matchedActivityIds: string[];
  matchedStayIds: string[];
  updatedActivities: SavedActivity[] | null;
  updatedStays: SavedStay[] | null;
}> {
  const iataUpper = primaryDestination.toUpperCase();
  const destNameLower = primaryDestinationName.toLowerCase();

  const [allActivities, allStays] = await Promise.all([listSavedActivities(), listSavedStays()]);

  // Activities: match by city name (case-insensitive), skip if already linked to a different trip
  const newActivityIds: string[] = [];
  let activitiesChanged = false;
  const updatedActivitiesArr: SavedActivity[] = allActivities.map((a) => {
    if (existingActivityIds.includes(a.id)) return a; // already linked to this trip
    if (a.tripId && a.tripId !== tripId) return a;    // linked to a different trip — don't steal
    if (!a.city || a.city.toLowerCase() !== destNameLower) return a; // city doesn't match
    newActivityIds.push(a.id);
    if (a.tripId === tripId) return a; // already has correct tripId, no change needed
    activitiesChanged = true;
    return { ...a, tripId };
  });

  // Stays: match by IATA (city field, uppercased) OR cityName (case-insensitive)
  const newStayIds: string[] = [];
  let staysChanged = false;
  const updatedStaysArr: SavedStay[] = allStays.map((s) => {
    if (existingStayIds.includes(s.id)) return s; // already linked to this trip
    if (s.tripId && s.tripId !== tripId) return s;  // linked to a different trip — don't steal
    const cityMatches =
      (s.city && s.city.toUpperCase() === iataUpper) ||
      (s.cityName && s.cityName.toLowerCase() === destNameLower);
    if (!cityMatches) return s;
    newStayIds.push(s.id);
    if (s.tripId === tripId) return s; // already has correct tripId
    staysChanged = true;
    return { ...s, tripId };
  });

  return {
    matchedActivityIds: newActivityIds,
    matchedStayIds: newStayIds,
    updatedActivities: activitiesChanged ? updatedActivitiesArr : null,
    updatedStays: staysChanged ? updatedStaysArr : null,
  };
}

export async function upsertTripFromOrder(order: StoredOrder): Promise<Trip> {
  const all = await listTrips();
  const tripId = tripIdForOrder(order.id);
  const existing = all.find((t) => t.id === tripId);
  const ctx = endOfTripFromOrder(order);
  const now = Date.now();

  if (existing) {
    const destIata = existing.primaryDestination || ctx.destinationIata;
    const destName = existing.primaryDestinationName || ctx.destinationName;
    const existingStayIds = existing.stayIds ?? [];
    const existingActivityIds = existing.activityIds ?? [];

    const { matchedActivityIds, matchedStayIds, updatedActivities, updatedStays } =
      await autoLinkCandidates(tripId, destIata, destName, existingStayIds, existingActivityIds);

    const mergedStayIds = Array.from(new Set([...existingStayIds, ...matchedStayIds]));
    const mergedActivityIds = Array.from(new Set([...existingActivityIds, ...matchedActivityIds]));

    const next: Trip = {
      ...existing,
      title: existing.title || ctx.title,
      primaryDestination: destIata,
      primaryDestinationName: destName,
      startDate: existing.startDate || ctx.startDate,
      endDate: existing.endDate || ctx.endDate,
      orderIds: Array.from(new Set([...(existing.orderIds ?? []), order.id])),
      stayIds: mergedStayIds,
      activityIds: mergedActivityIds,
      updatedAt: now,
      status: deriveTripStatus(existing.startDate || ctx.startDate, existing.endDate || ctx.endDate, true),
    };

    // Batch all AsyncStorage writes: trips + optionally updated activities/stays
    const pairs: [string, string][] = [[TRIPS_KEY, JSON.stringify(
      all.map((t) => (t.id === tripId ? { ...next } : t))
    )]];
    if (updatedActivities) pairs.push([SAVED_ACTIVITIES_KEY, JSON.stringify(updatedActivities)]);
    if (updatedStays) pairs.push([SAVED_STAYS_KEY, JSON.stringify(updatedStays)]);
    if (pairs.length > 1) {
      await AsyncStorage.multiSet(pairs);
      emit();
      // saveTrip would re-read the list; return next directly since we already wrote
      return { ...next, updatedAt: now };
    }
    return saveTrip(next);
  }

  // New trip branch
  const destIata = ctx.destinationIata;
  const destName = ctx.destinationName;

  const { matchedActivityIds, matchedStayIds, updatedActivities, updatedStays } =
    await autoLinkCandidates(tripId, destIata, destName, [], []);

  const trip: Trip = {
    id: tripId,
    title: ctx.title,
    primaryDestination: destIata,
    primaryDestinationName: destName,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    status: deriveTripStatus(ctx.startDate, ctx.endDate, true),
    orderIds: [order.id],
    stayIds: matchedStayIds,
    activityIds: matchedActivityIds,
    itineraryDays: [],
    coverGlyphIata: destIata,
    createdAt: now,
    updatedAt: now,
  };

  // Batch all AsyncStorage writes: trips + optionally updated activities/stays
  const newAll = [trip, ...all];
  const pairs: [string, string][] = [[TRIPS_KEY, JSON.stringify(newAll)]];
  if (updatedActivities) pairs.push([SAVED_ACTIVITIES_KEY, JSON.stringify(updatedActivities)]);
  if (updatedStays) pairs.push([SAVED_STAYS_KEY, JSON.stringify(updatedStays)]);
  if (pairs.length > 1) {
    await AsyncStorage.multiSet(pairs);
    emit();
    return trip;
  }
  return saveTrip(trip);
}

export async function linkStayToTrip(tripId: string, stayId: string): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  if (trip.stayIds.includes(stayId)) return;
  await saveTrip({ ...trip, stayIds: [...trip.stayIds, stayId] });
}

export async function unlinkStayFromTrip(tripId: string, stayId: string): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  if (!trip.stayIds.includes(stayId)) return;
  await saveTrip({ ...trip, stayIds: trip.stayIds.filter((id) => id !== stayId) });
}

export async function linkActivityToTrip(tripId: string, activityId: string): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  if (trip.activityIds.includes(activityId)) return;
  await saveTrip({ ...trip, activityIds: [...trip.activityIds, activityId] });
}

export async function unlinkActivityFromTrip(tripId: string, activityId: string): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  if (!trip.activityIds.includes(activityId)) return;
  await saveTrip({ ...trip, activityIds: trip.activityIds.filter((id) => id !== activityId) });
}

export async function updateItineraryDays(tripId: string, days: ItineraryDay[]): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  await saveTrip({ ...trip, itineraryDays: days });
}

export async function addItinerarySlot(tripId: string, dayDate: string, slot: ItinerarySlot): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  const days = trip.itineraryDays.map((d) =>
    d.date === dayDate ? { ...d, slots: [...d.slots, slot].sort(timeCompare) } : d,
  );
  await saveTrip({ ...trip, itineraryDays: days });
}

export async function removeItinerarySlot(tripId: string, dayDate: string, slotId: string): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  const days = trip.itineraryDays.map((d) =>
    d.date === dayDate ? { ...d, slots: d.slots.filter((s) => s.id !== slotId) } : d,
  );
  await saveTrip({ ...trip, itineraryDays: days });
}

export async function updateItinerarySlot(
  tripId: string,
  dayDate: string,
  slotId: string,
  changes: Partial<ItinerarySlot>,
): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  const days = trip.itineraryDays.map((d) =>
    d.date === dayDate
      ? { ...d, slots: d.slots.map((s) => (s.id === slotId ? { ...s, ...changes } : s)).sort(timeCompare) }
      : d,
  );
  await saveTrip({ ...trip, itineraryDays: days });
}

export async function setTripNotes(tripId: string, notes: string): Promise<void> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  await saveTrip({ ...trip, notes });
}

export async function ensureItineraryDays(tripId: string): Promise<Trip | undefined> {
  const trip = await getTripById(tripId);
  if (!trip) return;
  if (trip.itineraryDays.length > 0) return trip;
  const startMs = Date.parse(trip.startDate);
  const endMs = Date.parse(trip.endDate);
  const days = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1)
    : 3;
  const skel = buildItinerarySkeleton({
    destination: trip.primaryDestinationName,
    startDate: trip.startDate,
    days,
  });
  return saveTrip({ ...trip, itineraryDays: skel });
}

export async function migrateOrdersToTrips(): Promise<number> {
  const existing = await listTrips();
  if (existing.length > 0) return 0;
  const orders = await listOrders();
  if (orders.length === 0) return 0;
  let count = 0;
  for (const order of orders) {
    await upsertTripFromOrder(order);
    count++;
  }
  return count;
}

function timeCompare(a: ItinerarySlot, b: ItinerarySlot): number {
  const at = a.time ?? '99:99';
  const bt = b.time ?? '99:99';
  return at.localeCompare(bt);
}

export function tripsByStatus(trips: Trip[]): { upcoming: Trip[]; active: Trip[]; past: Trip[]; planning: Trip[] } {
  const buckets: { upcoming: Trip[]; active: Trip[]; past: Trip[]; planning: Trip[] } = {
    upcoming: [],
    active: [],
    past: [],
    planning: [],
  };
  for (const t of trips) {
    if (t.status === 'active') buckets.active.push(t);
    else if (t.status === 'past') buckets.past.push(t);
    else if (t.status === 'planning') buckets.planning.push(t);
    else buckets.upcoming.push(t);
  }
  buckets.upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  buckets.past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return buckets;
}

export type { TripStatus };
