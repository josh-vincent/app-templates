import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Activity, ActivityKind } from '@/lib/discover';

const KEY = '@voyage/saved-activities';

export type SavedActivity = Activity & {
  savedAt: number;
  tripId?: string;
  note?: string;
};

export async function listSavedActivities(): Promise<SavedActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedActivity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveActivity(
  a: Activity,
  ctx?: { tripId?: string; note?: string },
): Promise<SavedActivity> {
  const all = await listSavedActivities();
  const existing = all.findIndex((s) => s.id === a.id && s.tripId === ctx?.tripId);
  const record: SavedActivity = {
    ...a,
    savedAt: Date.now(),
    tripId: ctx?.tripId,
    note: ctx?.note,
  };
  const next =
    existing >= 0 ? [...all.slice(0, existing), record, ...all.slice(existing + 1)] : [...all, record];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return record;
}

export async function removeSavedActivity(id: string, tripId?: string): Promise<void> {
  const all = await listSavedActivities();
  const next = all.filter((s) => !(s.id === id && s.tripId === tripId));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function isActivitySaved(id: string, tripId?: string): Promise<boolean> {
  const all = await listSavedActivities();
  return all.some((s) => s.id === id && s.tripId === tripId);
}

export async function listActivitiesForCity(city: string): Promise<SavedActivity[]> {
  const all = await listSavedActivities();
  return all.filter((a) => a.city === city);
}

export async function countSavedByKind(): Promise<Record<ActivityKind, number>> {
  const all = await listSavedActivities();
  const counts: Record<ActivityKind, number> = {
    food: 0,
    culture: 0,
    outdoors: 0,
    nightlife: 0,
    view: 0,
    shopping: 0,
  };
  for (const a of all) counts[a.kind]++;
  return counts;
}
