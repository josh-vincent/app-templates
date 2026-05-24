import { Pressable, View, Image, ScrollView } from 'react-native';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Header from '@/components/Header';
import ThemedScroller from '@/components/ThemeScroller';
import { Chip } from '@/components/Chip';
import SkeletonLoader from '@/components/SkeletonLoader';
import List from '@/components/layout/List';
import ListItem from '@/components/layout/ListItem';
import ThemedText from '@/components/ThemedText';
import Icon, { IconName } from '@/components/Icon';
import { PARCHMENT } from '@/lib/theme';
import {
  listNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
  type StoredNotification,
  type StoredNotificationType,
} from '@/utils/notificationsStorage';

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dedupeNotifications(list: StoredNotification[]): (StoredNotification & { dupeCount?: number })[] {
  const result: (StoredNotification & { dupeCount?: number })[] = [];
  for (const n of list) {
    const prev = result[result.length - 1];
    if (
      prev &&
      prev.title === n.title &&
      prev.message === n.message &&
      Math.abs(new Date(prev.time).getTime() - new Date(n.time).getTime()) < 60000
    ) {
      prev.dupeCount = (prev.dupeCount ?? 1) + 1;
      // preserve unread state: if any dupe is unread, mark the group unread
      if (!n.read) prev.read = false;
    } else {
      result.push({ ...n });
    }
  }
  return result;
}

type FilterType = StoredNotificationType | 'all';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'price_drop', label: 'Fares' },
  { key: 'booking', label: 'Trips' },
  { key: 'message', label: 'Messages' },
  { key: 'payment', label: 'Payments' },
  { key: 'check_in', label: 'Check-in' },
];

export default function NotificationsScreen() {
  const [selectedType, setSelectedType] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);

  const load = useCallback(async () => {
    const list = await listNotifications();
    setNotifications(list);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const unsubscribe = subscribeNotifications(load);
      return unsubscribe;
    }, [load]),
  );

  const filtered = dedupeNotifications(
    notifications.filter((n) =>
      selectedType === 'all' ? true : n.type === selectedType,
    ),
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <Header showBackButton title="Notifications" />
      <View className="flex-1 dark:bg-dark-primary" style={{ backgroundColor: PARCHMENT }}>
        <View className="pt-4 flex-row items-center">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
            {FILTERS.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                isSelected={selectedType === f.key}
                onPress={() => setSelectedType(f.key)}
              />
            ))}
          </ScrollView>
          {unreadCount > 0 ? (
            <Pressable
              onPress={async () => {
                await markAllRead();
                load();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="mr-4 px-3 py-1.5 rounded-full bg-light-secondary/30 dark:bg-white/10">
              <ThemedText className="text-xs">Mark all read</ThemedText>
            </Pressable>
          ) : null}
        </View>

        <ThemedScroller>
          {isLoading ? (
            <View className="p-4">
              <SkeletonLoader variant="list" count={6} />
            </View>
          ) : (
            <List variant="divided">
              {filtered.length > 0 ? (
                filtered.map((notification) => (
                  <Pressable
                    key={notification.id}
                    onPress={async () => {
                      if (!notification.read) {
                        await markRead(notification.id);
                        load();
                      }
                    }}>
                    {renderNotification(notification)}
                  </Pressable>
                ))
              ) : (
                <View className="p-8 items-center">
                  <ThemedText>No notifications found</ThemedText>
                </View>
              )}
            </List>
          )}
        </ThemedScroller>
      </View>
    </>
  );
}

export const renderNotification = (notification: StoredNotification & { dupeCount?: number }) => (
  <ListItem
    leading={
      notification.user ? (
        <Image
          source={{ uri: notification.user.avatar ?? 'https://placehold.co/40x40' }}
          className="w-10 h-10 rounded-full"
        />
      ) : (
        <View className="bg-light-secondary/30 dark:bg-dark-subtext/30 w-10 h-10 rounded-full items-center justify-center">
          <Icon name={(notification.icon as IconName) ?? 'Bell'} size={20} />
        </View>
      )
    }
    title={
      <ThemedText className="font-bold">
        {notification.title}
        {notification.dupeCount && notification.dupeCount > 1 ? ` (+${notification.dupeCount - 1} more)` : ''}
      </ThemedText>
    }
    subtitle={notification.message}
    trailing={
      <View className="items-end">
        <ThemedText className="text-xs text-light-subtext dark:text-dark-subtext">
          {formatRelative(notification.time)}
        </ThemedText>
        {!notification.read ? (
          <View className="mt-1 w-2 h-2 rounded-full bg-highlight" />
        ) : null}
      </View>
    }
    className={`py-4 ${!notification.read ? 'bg-light-secondary/5 dark:bg-dark-secondary/5' : ''}`}
  />
);
