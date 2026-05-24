import AsyncStorage from '@react-native-async-storage/async-storage';

import { type TravelerProfile, emptyProfile } from '@/lib/travelerProfileTypes';

const KEY = '@voyage/traveler-profiles';

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribeTravelerProfiles(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export async function listProfiles(): Promise<TravelerProfile[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TravelerProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getOwnerProfile(): Promise<TravelerProfile> {
  const all = await listProfiles();
  const owner = all.find((p) => p.isOwner);
  if (owner) return owner;
  // Initialize an empty owner profile so callers can rely on this always returning one.
  const fresh = emptyProfile({ isOwner: true, id: 'traveler-owner' });
  await saveProfile(fresh);
  return fresh;
}

export async function listCompanions(): Promise<TravelerProfile[]> {
  const all = await listProfiles();
  return all.filter((p) => !p.isOwner);
}

export async function getProfile(id: string): Promise<TravelerProfile | undefined> {
  const all = await listProfiles();
  return all.find((p) => p.id === id);
}

export async function saveProfile(profile: TravelerProfile): Promise<TravelerProfile> {
  const all = await listProfiles();
  const idx = all.findIndex((p) => p.id === profile.id);
  const next: TravelerProfile = { ...profile, updatedAt: Date.now() };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
  emit();
  return next;
}

export async function setAllProfiles(list: TravelerProfile[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  emit();
}

export async function deleteProfile(id: string): Promise<void> {
  const all = await listProfiles();
  // Never let the owner profile be removed — only zero it out.
  const next = all.filter((p) => !(p.id === id && !p.isOwner));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  emit();
}
