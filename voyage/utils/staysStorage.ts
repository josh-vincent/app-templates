import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentStaySearch, SavedStay, StayOffer } from '@/lib/stayTypes';

const SAVED_KEY = '@voyage/saved-stays';
const RECENTS_KEY = '@voyage/recent-stay-searches';

export function stayKey(input: {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  offerId: string;
}) {
  return [
    input.city.toUpperCase(),
    input.checkIn,
    input.checkOut,
    input.guests,
    input.rooms,
    input.offerId,
  ].join('|');
}

export async function listSavedStays(): Promise<SavedStay[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedStay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveStay(
  offer: StayOffer,
  ctx: { checkIn: string; checkOut: string; guests: number; rooms: number; tripId?: string },
): Promise<SavedStay> {
  const all = await listSavedStays();
  const id = stayKey({
    city: offer.city,
    checkIn: ctx.checkIn,
    checkOut: ctx.checkOut,
    guests: ctx.guests,
    rooms: ctx.rooms,
    offerId: offer.id,
  });
  const existing = all.findIndex((s) => s.id === id);
  const record: SavedStay = {
    id,
    offerId: offer.id,
    name: offer.name,
    city: offer.city,
    cityName: offer.cityName,
    neighborhood: offer.neighborhood,
    checkIn: ctx.checkIn,
    checkOut: ctx.checkOut,
    guests: ctx.guests,
    rooms: ctx.rooms,
    totalAmount: offer.totalAmount,
    pricePerNight: offer.pricePerNight,
    currency: offer.currency,
    rating: offer.rating,
    propertyType: offer.propertyType,
    amenities: offer.amenities,
    cancellation: offer.cancellation,
    savedAt: Date.now(),
    tripId: ctx.tripId,
    coverPhoto: offer.photos?.[0] ?? `https://picsum.photos/seed/${offer.id}/800/600`,
  };
  const next = existing >= 0 ? [...all.slice(0, existing), record, ...all.slice(existing + 1)] : [...all, record];
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
  return record;
}

export async function removeSavedStay(id: string): Promise<void> {
  const all = await listSavedStays();
  const next = all.filter((s) => s.id !== id);
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
}

export async function isStaySaved(id: string): Promise<boolean> {
  const all = await listSavedStays();
  return all.some((s) => s.id === id);
}

export async function listRecentStaySearches(): Promise<RecentStaySearch[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentStaySearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addRecentStaySearch(input: {
  city: string;
  cityName: string;
  guests: number;
}): Promise<void> {
  const all = await listRecentStaySearches();
  const upper = input.city.toUpperCase();
  const filtered = all.filter((r) => r.city.toUpperCase() !== upper);
  const next: RecentStaySearch[] = [
    { city: upper, cityName: input.cityName, guests: input.guests, at: Date.now() },
    ...filtered,
  ].slice(0, 12);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
