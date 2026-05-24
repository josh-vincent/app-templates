import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemeColors } from '@/contexts/ThemeColors';
import { EMBER, GOLD, IRON, LIME } from '@/lib/theme';

export type LeaderboardEntry = {
  profile: {
    profileId: string;
    displayName: string | null;
    username: string | null;
  };
  won: number;
  forfeited: number;
  net: number;
  stakesSettled: number;
  isMe: boolean;
};

type Props = {
  entries: LeaderboardEntry[];
};

function displayFor(p: LeaderboardEntry['profile']): string {
  return p.displayName ?? (p.username ? `@${p.username}` : 'Friend');
}

function fmtNet(n: number): string {
  if (n >= 0) return `$${n.toLocaleString()}`;
  return `-$${Math.abs(n).toLocaleString()}`;
}

function netColor(n: number, fallback: string): string {
  if (n > 0) return LIME;
  if (n < 0) return EMBER;
  return fallback;
}

export default function FriendsLeaderboard({ entries }: Props) {
  const colors = useThemeColors();

  if (!entries || entries.length === 0) {
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
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
          Nothing settled in this window.
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: colors.text,
            opacity: 0.6,
            fontSize: 13,
          }}>
          Bets that finish will show up here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 14 }}>
      {entries.map((e, i) => {
        const rank = i + 1;
        const name = displayFor(e.profile);
        const initial = (name.replace(/^@/, '')[0] ?? '?').toUpperCase();
        const accent = netColor(e.net, colors.text);

        const inner = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.text + '14',
            }}>
            <Text
              style={{
                width: 28,
                fontWeight: '800',
                fontSize: 14,
                color: rank === 1 ? GOLD : colors.text,
                opacity: rank === 1 ? 1 : 0.55,
                fontVariant: ['tabular-nums'],
              }}>
              {rank}
            </Text>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: e.isMe ? GOLD + '24' : colors.text + '10',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
              <Text
                style={{
                  color: e.isMe ? GOLD : colors.text,
                  fontWeight: '800',
                  fontSize: 14,
                }}>
                {initial}
              </Text>
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: e.isMe ? '900' : '700',
                    letterSpacing: -0.2,
                  }}>
                  {name}
                </Text>
                {e.isMe ? (
                  <View
                    style={{
                      marginLeft: 8,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: GOLD,
                    }}>
                    <Text
                      style={{
                        color: IRON,
                        fontSize: 9,
                        fontWeight: '900',
                        letterSpacing: 1,
                      }}>
                      YOU
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  color: colors.text,
                  opacity: 0.55,
                  fontSize: 11,
                  fontVariant: ['tabular-nums'],
                }}>
                Won {fmtNet(e.won)} · Forfeited {fmtNet(e.forfeited)} · {e.stakesSettled} settled
              </Text>
            </View>
            <Text
              style={{
                color: accent,
                fontSize: 16,
                fontWeight: '800',
                letterSpacing: -0.3,
                fontVariant: ['tabular-nums'],
              }}>
              {fmtNet(e.net)}
            </Text>
          </View>
        );

        if (e.isMe) {
          return <View key={e.profile.profileId}>{inner}</View>;
        }
        return (
          <Pressable
            key={e.profile.profileId}
            onPress={() =>
              router.push(`/friends/${e.profile.profileId}` as any)
            }
            accessibilityRole="button"
            accessibilityLabel={`Open profile for ${name}`}>
            {inner}
          </Pressable>
        );
      })}
    </View>
  );
}
