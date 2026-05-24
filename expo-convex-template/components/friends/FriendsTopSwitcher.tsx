// In-place segmented switcher rendered at the top of the Friends modal.
// Pure state — tapping a segment calls `onChange`, no route navigation.
// Includes a Close affordance on the right so the fullScreenModal can be
// dismissed regardless of which segment is active.

import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { GOLD, IRON } from '@jv/tokens';

export type FriendsTopTab = 'live' | 'feed' | 'leaderboard' | 'manage';

const ITEMS: { key: FriendsTopTab; label: string }[] = [
  { key: 'live', label: 'Live' },
  { key: 'feed', label: 'Feed' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'manage', label: 'Manage' },
];

function dismissModal() {
  if (router.canDismiss()) {
    router.dismiss();
  } else if (router.canGoBack()) {
    router.back();
  }
}

export function FriendsTopSwitcher({
  active,
  onChange,
}: {
  active: FriendsTopTab;
  onChange: (tab: FriendsTopTab) => void;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginHorizontal: 20,
        marginTop: 8,
      }}>
      <View
        style={{
          flexDirection: 'row',
          flex: 1,
          backgroundColor: colors.text + '10',
          borderRadius: 12,
          padding: 4,
        }}>
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                if (isActive) return;
                onChange(item.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? GOLD : 'transparent',
              }}>
              <Text
                style={{
                  color: isActive ? IRON : colors.text,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.4,
                  opacity: isActive ? 1 : 0.7,
                }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={dismissModal}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close friends"
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: colors.text + '10',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="X" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default FriendsTopSwitcher;
