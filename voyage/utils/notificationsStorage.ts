import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredNotificationType =
  | 'offer'
  | 'booking'
  | 'message'
  | 'payment'
  | 'cancellation'
  | 'price_drop'
  | 'check_in'
  | 'system';

export type StoredNotification = {
  id: string;
  type: StoredNotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon?: string;
  user?: { name: string; avatar?: string | null };
  createdAt: number;
  refs?: { trackedId?: string; orderId?: string; tripId?: string };
};

const KEY = '@voyage/notifications';
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribeNotifications(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export async function listNotifications(): Promise<StoredNotification[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredNotification[];
    return Array.isArray(parsed)
      ? parsed.slice().sort((a, b) => b.createdAt - a.createdAt)
      : [];
  } catch {
    return [];
  }
}

export async function setAllNotifications(list: StoredNotification[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  emit();
}

export async function addNotification(n: Omit<StoredNotification, 'id' | 'createdAt' | 'read'> & { id?: string; createdAt?: number; read?: boolean }): Promise<StoredNotification> {
  const list = await listNotifications();
  const record: StoredNotification = {
    id: n.id ?? `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: n.type,
    title: n.title,
    message: n.message,
    time: n.time,
    read: n.read ?? false,
    icon: n.icon,
    user: n.user,
    refs: n.refs,
    createdAt: n.createdAt ?? Date.now(),
  };
  await setAllNotifications([record, ...list]);
  return record;
}

export async function markRead(id: string): Promise<void> {
  const list = await listNotifications();
  await setAllNotifications(list.map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export async function markAllRead(): Promise<void> {
  const list = await listNotifications();
  await setAllNotifications(list.map((n) => ({ ...n, read: true })));
}

export async function removeNotification(id: string): Promise<void> {
  const list = await listNotifications();
  await setAllNotifications(list.filter((n) => n.id !== id));
}

export async function countUnread(): Promise<number> {
  const list = await listNotifications();
  return list.filter((n) => !n.read).length;
}
