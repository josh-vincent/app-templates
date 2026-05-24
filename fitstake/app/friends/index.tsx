// Friends hub — single modal screen with four in-place segments.
// Live / Feed / Leaderboard / Manage swap via local state; no route
// navigation between them. The fullScreenModal preset on this group
// (configured in app/_layout.tsx) handles dismissal.

import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FeedSegment from '@/components/friends/segments/FeedSegment';
import LeaderboardSegment from '@/components/friends/segments/LeaderboardSegment';
import LiveSegment from '@/components/friends/segments/LiveSegment';
import ManageSegment from '@/components/friends/segments/ManageSegment';
import {
  FriendsTopSwitcher,
  type FriendsTopTab,
} from '@/components/friends/FriendsTopSwitcher';
import { useThemeColors } from '@jv/ui';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

// The screen header title shows the long, readable name even when the
// segmented control uses the shortened 'Board' (see FriendsTopSwitcher).
const TITLES: Record<FriendsTopTab, string> = {
  live: 'Live',
  feed: 'Activity',
  leaderboard: 'Leaderboard',
  manage: 'Manage',
};

export default function FriendsHub() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [tab, setTab] = useState<FriendsTopTab>('live');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingTop: 12,
          paddingBottom: 6,
        }}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
          FRIENDS
        </Text>
        <Text
          style={{
            marginTop: 2,
            color: colors.text,
            fontSize: 24,
            fontWeight: '800',
            letterSpacing: -0.6,
          }}>
          {TITLES[tab]}
        </Text>
      </View>

      <FriendsTopSwitcher active={tab} onChange={setTab} />

      <View style={{ flex: 1 }}>
        {tab === 'live' ? (
          <LiveSegment onSwitchToManage={() => setTab('manage')} />
        ) : tab === 'feed' ? (
          <FeedSegment />
        ) : tab === 'leaderboard' ? (
          <LeaderboardSegment />
        ) : (
          <ManageSegment />
        )}
      </View>
    </View>
  );
}
