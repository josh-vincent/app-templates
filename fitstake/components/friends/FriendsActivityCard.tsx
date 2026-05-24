import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { EMBER, GOLD, LIME } from '@jv/tokens';

// Feed event kinds. Matches the union in convex/friends.ts activityFeed.
export type FriendActivityKind =
  | 'stake_started'
  | 'session_completed'
  | 'at_risk'
  | 'just_won'
  | 'just_forfeited'
  | 'time_running_out'
  | 'h2h_invite'
  | 'h2h_overtaken';

export type FriendActivityItem = {
  _id: string;
  actorUserId: string;
  viewerUserId: string;
  eventGroupId?: string;
  challengeId?: string;
  participantId?: string;
  kind: FriendActivityKind;
  payload?: {
    actorName?: string;
    stakeTitle?: string;
    stakeAmount?: number;
    activityKey?: string;
    progress?: number;
    goal?: number;
    ratio?: number;
    hoursLeft?: number;
    whatsLeft?: string;
  };
  createdAt: number;
  seenAt?: number;
  actorProfile?: {
    profileId: string;
    displayName: string | null;
    username: string | null;
  } | null;
};

// Glyph + outcome color per kind.
const KIND_META: Record<
  FriendActivityKind,
  { icon: string; color: string }
> = {
  stake_started: { icon: 'Target', color: GOLD },
  session_completed: { icon: 'Check', color: LIME },
  at_risk: { icon: 'TriangleAlert', color: EMBER },
  just_won: { icon: 'Trophy', color: GOLD },
  just_forfeited: { icon: 'X', color: EMBER },
  time_running_out: { icon: 'Hourglass', color: EMBER },
  h2h_invite: { icon: 'Swords', color: GOLD },
  h2h_overtaken: { icon: 'ChevronRight', color: EMBER },
};

const fmtAbsMoney = (n: number) =>
  n < 0
    ? `-$${Math.abs(n).toLocaleString()}`
    : `$${n.toLocaleString()}`;

// "3m ago" / "1h ago" / "yesterday" / "Mar 12"
function fmtRelative(ts: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, nowMs - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function resolveActorName(item: FriendActivityItem): string {
  return (
    item.payload?.actorName ??
    item.actorProfile?.displayName ??
    (item.actorProfile?.username ? `@${item.actorProfile.username}` : 'A friend')
  );
}

function buildTitle(item: FriendActivityItem): string {
  const actor = resolveActorName(item);
  const title = item.payload?.stakeTitle ?? 'a stake';
  const amount = item.payload?.stakeAmount;
  const hours = item.payload?.hoursLeft;
  switch (item.kind) {
    case 'stake_started':
      return `${actor} started ${title}`;
    case 'session_completed':
      return `${actor} closed out ${title} for today`;
    case 'at_risk':
      return `${actor} is behind on ${title}`;
    case 'just_won':
      return amount != null
        ? `${actor} won ${fmtAbsMoney(amount)} on ${title}`
        : `${actor} won on ${title}`;
    case 'just_forfeited':
      return amount != null
        ? `${actor} forfeited ${fmtAbsMoney(amount)} on ${title}`
        : `${actor} forfeited on ${title}`;
    case 'time_running_out':
      return hours != null
        ? `${actor}'s ${title} ends in ${hours}h`
        : `${actor}'s ${title} is ending soon`;
    case 'h2h_invite':
      return amount != null
        ? `${actor} challenged you · ${fmtAbsMoney(amount)}`
        : `${actor} challenged you`;
    case 'h2h_overtaken':
      return `${actor} passed you on ${title}`;
  }
}

type Props = {
  item: FriendActivityItem;
};

export default function FriendsActivityCard({ item }: Props) {
  const colors = useThemeColors();
  const meta = KIND_META[item.kind];
  const actor = resolveActorName(item);
  const initial = (actor.replace(/^@/, '')[0] ?? '?').toUpperCase();
  const title = buildTitle(item);
  const sub = fmtRelative(item.createdAt);

  const onPress = () => {
    if (item.challengeId) {
      router.push(`/(tabs)/challenges/${item.challengeId}` as any);
    } else if (item.actorUserId) {
      router.push(`/friends/${item.actorUserId}` as any);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: colors.text + '12',
        marginBottom: 10,
      }}>
      {/* Outcome color band */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: meta.color,
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
        }}
      />

      {/* Avatar */}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: meta.color + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 6,
        }}>
        <Text style={{ color: meta.color, fontWeight: '800', fontSize: 15 }}>
          {initial}
        </Text>
      </View>

      {/* Title + relative time */}
      <View style={{ flex: 1, marginLeft: 12, paddingRight: 10 }}>
        <Text
          numberOfLines={2}
          style={{
            color: colors.text,
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: -0.2,
            lineHeight: 18,
          }}>
          {title}
        </Text>
        <Text
          style={{
            marginTop: 2,
            color: colors.text,
            opacity: 0.55,
            fontSize: 11,
            fontVariant: ['tabular-nums'],
          }}>
          {sub}
        </Text>
      </View>

      {/* Glyph */}
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: meta.color + '1c',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={meta.icon as any} size={16} color={meta.color} />
      </View>
    </Pressable>
  );
}

