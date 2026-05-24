// Friends hub — Live segment body. Lives inside the consolidated
// /friends modal; rendered when the segment switcher is on 'live'.

import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FriendStakeRow } from '@/components/friends/FriendStakeRow';
import { useThemeColors } from '@/contexts/ThemeColors';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { WhatsLeft } from '@/convex/lib/whatsLeft';
import { useQuery } from '@/lib/persona-convex';
import { GOLD, IRON } from '@/lib/theme';

const PAGE_X = 20;

type ProgressDetailRow = {
  friendProfile: {
    profileId: Id<'profiles'>;
    displayName: string | null;
    username: string | null;
  };
  stakes: Array<{
    challengeId: Id<'challenges'>;
    title: string;
    activityKey: string;
    betShape: string;
    stakeAmount: number;
    goal: number;
    progress: number;
    progressRatio: number;
    hoursLeft: number;
    atRisk: boolean;
    ahead: boolean;
    whatsLeft: WhatsLeft;
  }>;
};

type RowItem = {
  key: string;
  friend: ProgressDetailRow['friendProfile'];
  stake: ProgressDetailRow['stakes'][number];
};

export function LiveSegment({ onSwitchToManage }: { onSwitchToManage: () => void }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const data = useQuery(api.friends.progressDetail, {}) as
    | ProgressDetailRow[]
    | undefined;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 350));
    setRefreshing(false);
  }, []);

  const rows: RowItem[] = (data ?? []).flatMap((d) =>
    d.stakes.map((s) => ({
      key: `${d.friendProfile.profileId}:${s.challengeId}`,
      friend: d.friendProfile,
      stake: s,
    }))
  );

  if (data === undefined) {
    return (
      <View style={{ paddingHorizontal: PAGE_X, paddingTop: 20, gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              height: 72,
              borderRadius: 14,
              backgroundColor: colors.text + '08',
            }}
          />
        ))}
      </View>
    );
  }

  if (rows.length === 0) {
    const hasFriends = (data ?? []).length > 0;
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: PAGE_X,
          paddingTop: 48,
          gap: 12,
        }}>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '800',
            letterSpacing: -0.4,
            textAlign: 'center',
          }}>
          {hasFriends ? 'Nothing live right now.' : 'No friends added yet.'}
        </Text>
        <Text
          style={{
            color: colors.text,
            opacity: 0.6,
            fontSize: 13,
            lineHeight: 19,
            textAlign: 'center',
            marginBottom: 8,
          }}>
          {hasFriends
            ? "Your friends aren't running any bets. Start one and they'll join in."
            : 'Search the room or share an invite link to start betting.'}
        </Text>
        <Pressable
          onPress={onSwitchToManage}
          style={{
            paddingHorizontal: 20,
            height: 44,
            borderRadius: 10,
            backgroundColor: GOLD,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: IRON, fontWeight: '800', fontSize: 14 }}>
            {hasFriends ? 'Manage friends' : 'Add friends'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={{
        paddingHorizontal: PAGE_X,
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
      }}
      ItemSeparatorComponent={() => (
        <View style={{ height: 1, backgroundColor: colors.text + '14' }} />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.text}
        />
      }
      renderItem={({ item }) => (
        <FriendStakeRow
          friend={item.friend}
          stake={item.stake}
          onPress={() => router.push(`/friends/${item.friend.profileId}` as any)}
        />
      )}
    />
  );
}

export default LiveSegment;
