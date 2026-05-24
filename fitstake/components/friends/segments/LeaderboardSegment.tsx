// Friends hub — Leaderboard segment body. Net P/L over a selected
// timeframe, optionally filtered by activity.

import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import FriendsLeaderboard, {
  type LeaderboardEntry,
} from '@/components/friends/FriendsLeaderboard';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { ACTIVITY_KEYS, getActivity } from '@/lib/activities';
import { useQuery } from '@/lib/persona-convex';
import { GOLD } from '@jv/tokens';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

type Timeframe = 'weekly' | 'monthly' | 'all';
type ActivityFilter = 'all' | (typeof ACTIVITY_KEYS)[number];

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All-time' },
];

function Chip({
  label,
  active,
  onPress,
  iconName,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  iconName?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: active ? GOLD : colors.text + '20',
        backgroundColor: active ? GOLD + '14' : 'transparent',
        marginRight: 8,
      }}>
      {iconName ? (
        <Icon
          name={iconName as any}
          size={13}
          color={active ? GOLD : colors.text}
        />
      ) : null}
      <Text
        style={{
          color: active ? GOLD : colors.text,
          opacity: active ? 1 : 0.7,
          fontSize: 12,
          fontWeight: active ? '800' : '600',
          letterSpacing: 0.2,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function LeaderboardSegment() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
  const [activityKey, setActivityKey] = useState<ActivityFilter>('all');

  const entries = useQuery(api.friends.leaderboard, {
    timeframe,
    activityKey: activityKey === 'all' ? undefined : activityKey,
  }) as LeaderboardEntry[] | undefined;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: insets.bottom + 24,
      }}
      showsVerticalScrollIndicator={false}>
      {/* Timeframe chips */}
      <View style={{ paddingHorizontal: PAGE_X, marginTop: 12 }}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
          TIMEFRAME
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          {TIMEFRAMES.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              active={timeframe === t.key}
              onPress={() => setTimeframe(t.key)}
            />
          ))}
        </View>
      </View>

      {/* Activity chips */}
      <View style={{ marginTop: 18 }}>
        <View style={{ paddingHorizontal: PAGE_X }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
            ACTIVITY
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: PAGE_X,
            paddingTop: 8,
            paddingRight: PAGE_X,
          }}>
          <Chip
            label="All"
            active={activityKey === 'all'}
            onPress={() => setActivityKey('all')}
          />
          {ACTIVITY_KEYS.map((k) => {
            const def = getActivity(k);
            return (
              <Chip
                key={k}
                label={def.name}
                iconName={def.icon}
                active={activityKey === k}
                onPress={() => setActivityKey(k)}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Leaderboard */}
      <View style={{ paddingHorizontal: PAGE_X, marginTop: 18 }}>
        {entries === undefined ? (
          <View>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  marginBottom: 10,
                  height: 58,
                  borderRadius: 12,
                  backgroundColor: colors.text + '08',
                }}
              />
            ))}
          </View>
        ) : (
          <FriendsLeaderboard entries={entries} />
        )}
      </View>
    </ScrollView>
  );
}

export default LeaderboardSegment;
