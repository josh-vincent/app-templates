import { SkeletonBar, SkeletonCard } from '@jv/ui';
import { useQuery } from '@/lib/persona-convex';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { formatGoal, getActivity } from '@/lib/activities';
import { getActivityMascot, SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { EMBER, GOLD, LIME } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const fmtMoney = (n: number) => `$${Math.round(n)}`;

type DiscoverRow = {
  _id: string;
  title: string;
  activityKey?: string;
  stepGoal: number;
  stakeAmount: number;
  durationDays: number;
  participantCount: number;
  creatorDisplayName: string;
};

export default function BetsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const mine = useQuery(api.challenges.myActive);
  const discover = useQuery(api.challenges.discover);

  const isLoading = mine === undefined || discover === undefined;
  if (isLoading) {
    return <BetsSkeleton insets={insets} colors={colors} />;
  }
  const myCount = (mine ?? []).length;
  const friendsRows = (discover?.friends ?? []) as DiscoverRow[];
  const marketRows = (discover?.market ?? []) as DiscoverRow[];

  const sections: {
    title: string;
    count: number;
    data: (
      | { kind: 'mine'; row: Doc<'challenges'> }
      | { kind: 'discover'; row: DiscoverRow; tone: string }
    )[];
    emptyHint?: { icon: string; title: string; sub: string; onPress?: () => void };
  }[] = [
    {
      title: 'YOUR STAKES',
      count: myCount,
      data: (mine ?? []).map((c) => ({ kind: 'mine' as const, row: c })),
      emptyHint:
        myCount === 0
          ? {
              icon: 'Plus',
              title: 'No live stakes.',
              sub: 'Pick one below or place your own.',
            }
          : undefined,
    },
    {
      title: "FRIENDS' STAKES",
      count: friendsRows.length,
      data: friendsRows.map((c) => ({ kind: 'discover' as const, row: c, tone: LIME })),
      emptyHint:
        friendsRows.length === 0
          ? {
              icon: 'UserPlus',
              title: 'Your friends have nothing open.',
              sub: 'Invite one →',
              onPress: () => router.push('/friends' as any),
            }
          : undefined,
    },
    {
      title: 'OPEN MARKET',
      count: marketRows.length,
      data: marketRows.map((c) => ({ kind: 'discover' as const, row: c, tone: EMBER })),
      emptyHint:
        marketRows.length === 0 && !isLoading
          ? {
              icon: 'Compass',
              title: 'Nothing on the board.',
              sub: 'Open the first one →',
              onPress: () => router.push('/(tabs)/challenges/create'),
            }
          : undefined,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <FlatList
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 4,
              }}>
              <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>BETS</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/challenges/create')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Place a bet"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}>
                <Icon name="Plus" size={14} color={GOLD} />
                <Text style={{ color: GOLD, fontWeight: '700', fontSize: 13 }}>New</Text>
              </Pressable>
            </View>

            <Text
              style={{
                marginTop: 4,
                color: colors.text,
                fontSize: 26,
                fontWeight: '800',
                letterSpacing: -0.6,
              }}>
              Place your bets.
            </Text>
          </View>
        }
        data={sections}
        keyExtractor={(s) => s.title}
        renderItem={({ item: section }) => (
          <View style={{ marginTop: SECTION_GAP }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
              {section.title} {section.count > 0 ? `· ${section.count}` : ''}
            </Text>
            {section.emptyHint ? (
              <EmptyHint colors={colors} hint={section.emptyHint} />
            ) : (
              <View style={{ marginTop: 4 }}>
                {section.data.map((entry, i) => {
                  if (entry.kind === 'mine') {
                    const c = entry.row;
                    return (
                      <BetRow
                        key={c._id}
                        activityKey={c.activityKey ?? 'steps'}
                        title={c.title}
                        sub={subForMine(c)}
                        stake={c.stakeAmount}
                        statusColor={LIME}
                        isFirst={i === 0}
                        onPress={() => router.push(`/(tabs)/challenges/${c._id}` as any)}
                        colors={colors}
                      />
                    );
                  }
                  const c = entry.row;
                  return (
                    <BetRow
                      key={c._id}
                      activityKey={c.activityKey ?? 'steps'}
                      title={c.title}
                      sub={subForDiscover(c)}
                      stake={c.stakeAmount}
                      statusColor={entry.tone}
                      isFirst={i === 0}
                      onPress={() => router.push(`/(tabs)/challenges/${c._id}` as any)}
                      colors={colors}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

function subForMine(c: Doc<'challenges'>) {
  const activity = getActivity(c.activityKey);
  const goalText = formatGoal(activity, c.stepGoal);
  const durationText = c.durationDays === 1 ? 'today' : `${c.durationDays}d`;
  return `${goalText} · ${durationText}`;
}

function subForDiscover(c: DiscoverRow) {
  const activity = getActivity(c.activityKey);
  const goalText = formatGoal(activity, c.stepGoal);
  const durationText = c.durationDays === 1 ? 'today' : `${c.durationDays}d`;
  return `${c.creatorDisplayName} · ${goalText} · ${durationText} · ${c.participantCount} in`;
}

function EmptyHint({
  colors,
  hint,
}: {
  colors: ReturnType<typeof useThemeColors>;
  hint: { icon: string; title: string; sub: string; onPress?: () => void };
}) {
  const Wrap = hint.onPress ? Pressable : View;
  return (
    <Wrap
      onPress={hint.onPress}
      style={{
        marginTop: 12,
        overflow: 'hidden',
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.border,
      }}>
      <Image
        source={
          hint.icon === 'Compass' ? SCENARIO_MASCOTS.jackpotRunPool : SCENARIO_MASCOTS.friendMatch
        }
        resizeMode="cover"
        style={{
          height: 112,
          marginHorizontal: -16,
          marginTop: -16,
          marginBottom: 14,
          backgroundColor: colors.text + '10',
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name={hint.icon as any} size={16} color={colors.text + 'b0'} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{hint.title}</Text>
      </View>
      <Text style={{ marginTop: 4, color: colors.text, opacity: 0.55, fontSize: 12 }}>
        {hint.sub}
      </Text>
    </Wrap>
  );
}

function BetRow({
  activityKey,
  title,
  sub,
  stake,
  statusColor,
  isFirst,
  onPress,
  colors,
}: {
  activityKey: string;
  title: string;
  sub: string;
  stake: number;
  statusColor: string;
  isFirst?: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const activity = getActivity(activityKey);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
      }}>
      <Image
        source={getActivityMascot(activity.key)}
        resizeMode="cover"
        style={{
          width: 58,
          height: 40,
          borderRadius: 10,
          marginRight: 12,
          backgroundColor: colors.text + '10',
        }}
      />
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: colors.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
      <Text
        style={{
          color: statusColor,
          fontWeight: '800',
          fontSize: 16,
          fontVariant: ['tabular-nums'],
        }}>
        {fmtMoney(stake)}
      </Text>
    </Pressable>
  );
}

function BetsSkeleton({
  insets,
  colors,
}: {
  insets: ReturnType<typeof useSafeAreaInsets>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: PAGE_X, paddingTop: 4 }}>
        <SkeletonBar width={60} height={11} />
        <SkeletonBar width={160} height={26} style={{ marginTop: 8 }} />
        {[0, 1, 2].map((s) => (
          <View key={s} style={{ marginTop: 22 }}>
            <SkeletonBar width={110} height={11} />
            <View style={{ marginTop: 12, gap: 10 }}>
              <SkeletonCard height={58} />
              <SkeletonCard height={58} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
