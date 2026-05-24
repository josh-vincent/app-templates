// Side-by-side live progress comparison for a head-to-head bet.
//
// Used in two places:
//   - Friend detail screen (`app/friends/[id].tsx`), one panel per open
//     shared h2h stake.
//   - Bet detail screen (`app/(tabs)/challenges/[id].tsx`), above the
//     participants list when the bet is h2h.
//
// Renders nothing when the snapshot returns null (non-h2h or missing).
// Halos the leader's column with a subtle GOLD glow; on `tied` neither
// side is haloed. Off-track non-leader rings switch to EMBER so a falling
// behind side reads at a glance.

import React from 'react';
import { Text, View } from 'react-native';

import { PaceRing } from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useQuery } from '@/lib/persona-convex';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

function fmtEndsIn(endsAt: number): string {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'overtime';
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

type Side = {
  profile: {
    profileId: Id<'profiles'>;
    displayName: string | null;
    username: string | null;
  } | null;
  progress: number;
  goal: number;
  ratio: number;
};

export function H2HSideBySide({
  challengeId,
  title,
}: {
  challengeId: Id<'challenges'>;
  title?: string;
}) {
  const snap = useQuery(api.friends.h2hProgressSnapshot, { challengeId });
  const colors = useThemeColors();

  if (snap === undefined) return null;
  if (snap === null) return null;

  const { me, opponent, endsAt, leader } = snap as {
    me: Side;
    opponent: Side;
    endsAt: number;
    leader: 'me' | 'them' | 'tied';
  };

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
        HEAD-TO-HEAD
      </Text>
      {title ? (
        <Text
          numberOfLines={1}
          style={{
            marginTop: 6,
            color: colors.text,
            fontSize: 16,
            fontWeight: '800',
            letterSpacing: -0.3,
          }}>
          {title}
        </Text>
      ) : null}

      <View
        style={{
          marginTop: 12,
          borderRadius: 18,
          backgroundColor: colors.text + '0a',
          borderWidth: 1,
          borderColor: colors.text + '14',
          overflow: 'hidden',
        }}>
        <View style={{ flexDirection: 'row' }}>
          <Column
            side={me}
            isLeader={leader === 'me'}
            tied={leader === 'tied'}
            colors={colors}
            border="right"
          />
          <Column
            side={opponent}
            isLeader={leader === 'them'}
            tied={leader === 'tied'}
            colors={colors}
          />
        </View>
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: colors.text + '14',
            alignItems: 'center',
          }}>
          <Text
            style={{
              ...EYEBROW,
              color: colors.text,
              opacity: 0.55,
            }}>
            ENDS IN {fmtEndsIn(endsAt).toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Column({
  side,
  isLeader,
  tied,
  colors,
  border,
}: {
  side: Side;
  isLeader: boolean;
  tied: boolean;
  colors: ReturnType<typeof useThemeColors>;
  border?: 'right';
}) {
  const initial = (side.profile?.displayName ?? '?')[0]?.toUpperCase() ?? '?';
  const ratio = Math.max(0, Math.min(1, side.ratio));
  // Color rule (per brief):
  //   leader        → GOLD
  //   tied or non-leader-on-track → LIME
  //   non-leader and behind       → EMBER
  // We treat "behind" as ratio < 1 AND not the leader.
  const ringColor = isLeader
    ? GOLD
    : tied
      ? LIME
      : ratio >= 1
        ? LIME
        : EMBER;

  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
        borderRightWidth: border === 'right' ? 1 : 0,
        borderRightColor: colors.text + '14',
        // Subtle GOLD halo on the leader column.
        backgroundColor: isLeader ? GOLD + '12' : 'transparent',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: isLeader ? GOLD : colors.text + '14',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              color: isLeader ? IRON : colors.text,
              fontWeight: '900',
              fontSize: 13,
            }}>
            {initial}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={{
            marginLeft: 8,
            color: colors.text,
            fontWeight: isLeader ? '900' : '600',
            fontSize: 13,
            maxWidth: 110,
          }}>
          {side.profile?.displayName ?? 'Anonymous'}
        </Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <PaceRing
          ratio={ratio}
          color={ringColor}
          trackColor={BONE}
          size={64}
          stroke={6}
        />
      </View>

      <Text
        style={{
          marginTop: 10,
          color: colors.text,
          fontWeight: '800',
          fontSize: 14,
          fontVariant: ['tabular-nums'],
        }}>
        {Math.round(side.progress).toLocaleString()}
        <Text style={{ color: colors.text, opacity: 0.5, fontWeight: '600' }}>
          {' / '}
          {Math.round(side.goal).toLocaleString()}
        </Text>
      </Text>

      <View
        style={{
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          backgroundColor: ringColor + '20',
        }}>
        <Text
          style={{
            color: ringColor,
            fontSize: 11,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}>
          {Math.round(ratio * 100)}%
        </Text>
      </View>
    </View>
  );
}

export default H2HSideBySide;
