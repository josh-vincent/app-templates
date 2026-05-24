// Friends hub — Feed segment body. Chronological friend activity feed.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FriendsActivityCard, {
  type FriendActivityItem,
} from '@/components/friends/FriendsActivityCard';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { useQuery } from '@/lib/persona-convex';

const PAGE_X = 20;

export function FeedSegment() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [cursor, setCursor] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState<FriendActivityItem[]>([]);
  const [seenLatestCursor, setSeenLatestCursor] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const page = useQuery(api.friends.activityFeed, {
    limit: 30,
    cursor: cursor ?? undefined,
  }) as { items: FriendActivityItem[]; nextCursor: number | null } | undefined;

  useEffect(() => {
    if (!page) return;
    if (cursor === null) {
      setAccumulated(page.items);
    } else {
      setAccumulated((prev) => {
        const known = new Set(prev.map((x) => x._id));
        const next = page.items.filter((x) => !known.has(x._id));
        return [...prev, ...next];
      });
    }
    setSeenLatestCursor(page.nextCursor);
    if (page.nextCursor == null) setReachedEnd(true);
    else setReachedEnd(false);
  }, [page, cursor]);

  const onEndReached = useCallback(() => {
    if (reachedEnd) return;
    if (seenLatestCursor == null) return;
    if (cursor === seenLatestCursor) return;
    setCursor(seenLatestCursor);
  }, [cursor, reachedEnd, seenLatestCursor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setReachedEnd(false);
    setCursor(null);
    await new Promise((r) => setTimeout(r, 350));
    setRefreshing(false);
  }, []);

  const loading = page === undefined && accumulated.length === 0;

  const ListEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={{ marginTop: 24 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                marginBottom: 10,
                height: 74,
                borderRadius: 16,
                backgroundColor: colors.text + '08',
                borderWidth: 1,
                borderColor: colors.text + '10',
              }}
            />
          ))}
        </View>
      );
    }
    return (
      <View
        style={{
          marginTop: 24,
          padding: 18,
          borderRadius: 16,
          borderStyle: 'dashed',
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          No friend activity yet.
        </Text>
        <Text
          style={{
            marginTop: 6,
            color: colors.text,
            opacity: 0.6,
            fontSize: 13,
            lineHeight: 18,
          }}>
          Add more friends and you&apos;ll see their stakes, wins, and forfeits
          land here in real time.
        </Text>
      </View>
    );
  }, [loading, colors]);

  return (
    <FlatList<FriendActivityItem>
      data={accumulated}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <FriendsActivityCard item={item} />}
      contentContainerStyle={{
        paddingHorizontal: PAGE_X,
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.text}
        />
      }
      ListEmptyComponent={ListEmpty}
      ListFooterComponent={
        accumulated.length > 0 && !reachedEnd ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.4,
                fontSize: 12,
                letterSpacing: 1,
              }}>
              LOADING MORE…
            </Text>
          </View>
        ) : accumulated.length > 0 && reachedEnd ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.35,
                fontSize: 11,
                letterSpacing: 1,
              }}>
              CAUGHT UP
            </Text>
          </View>
        ) : null
      }
    />
  );
}

export default FeedSegment;
