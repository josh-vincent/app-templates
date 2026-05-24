// One row in the Friends progress hub: a friend × a single active stake.
//
// When a friend has multiple bets running we render one row per stake (NOT
// collapsed) — the hub is meant to show what each friend is on the hook for
// at a glance.
//
// Coloring rules:
//   • atRisk           → EMBER  (behind pace, time running out)
//   • ahead | progressRatio >= 1 → GOLD (goal hit, awaiting settle)
//   • otherwise        → LIME   (on pace)

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { PaceRing } from '@jv/ui';
import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import type { Id } from '@/convex/_generated/dataModel';
import type { WhatsLeft } from '@/convex/lib/whatsLeft';
import { getActivity } from '@/lib/activities';
import { BONE, EMBER, GOLD, LIME } from '@jv/tokens';

import { WhatsLeftBreakdown } from './WhatsLeftBreakdown';

export type FriendStakeRowProps = {
  friend: {
    profileId: Id<'profiles'>;
    displayName: string | null;
    username: string | null;
  };
  stake: {
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
  };
  onPress: () => void;
};

const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

export function FriendStakeRow({ friend, stake, onPress }: FriendStakeRowProps) {
  const colors = useThemeColors();
  const activity = getActivity(stake.activityKey);

  const accent = stake.atRisk ? EMBER : stake.ahead ? GOLD : LIME;
  const display =
    friend.displayName ??
    (friend.username ? `@${friend.username}` : 'Anonymous');
  const initial = (display.replace(/^@/, '')[0] ?? '?').toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${display}'s ${stake.title}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 12,
      }}>
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: accent + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: accent, fontWeight: '800', fontSize: 15 }}>
          {initial}
        </Text>
      </View>

      {/* Name + verb stack */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
          {display}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            opacity: 0.6,
            fontSize: 12,
            fontWeight: '600',
            marginTop: 2,
          }}>
          {activity.verb}
        </Text>
        <View style={{ marginTop: 6 }}>
          <WhatsLeftBreakdown whatsLeft={stake.whatsLeft} />
        </View>
      </View>

      {/* Pace ring + stake amount + chevron */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <PaceRing
          ratio={stake.progressRatio}
          color={accent}
          trackColor={BONE}
          size={32}
          stroke={3}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 13,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}>
            {fmtMoney(stake.stakeAmount)}
          </Text>
          <Icon name="ChevronRight" size={14} color={colors.text + '99'} />
        </View>
      </View>
    </Pressable>
  );
}

export default FriendStakeRow;
