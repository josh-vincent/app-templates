import { Link, Stack } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { GOLD, IRON } from '@/lib/theme';

export default function NotFoundScreen() {
  const colors = useThemeColors();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
          paddingHorizontal: 24,
        }}>
        <View
          style={{
            height: 56,
            width: 56,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: GOLD,
          }}>
          <Icon name="AlertCircle" size={24} color={IRON} />
        </View>
        <Text
          style={{
            marginTop: 18,
            color: colors.text,
            fontSize: 24,
            fontWeight: '800',
            letterSpacing: -0.5,
          }}>
          Page not found
        </Text>
        <Text
          style={{
            marginTop: 8,
            textAlign: 'center',
            color: colors.text,
            opacity: 0.55,
            fontSize: 13,
            maxWidth: 280,
          }}>
          That screen doesn't exist. Head back to the lobby.
        </Text>
        <Link href="/" asChild>
          <Pressable
            style={{
              marginTop: 22,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: GOLD,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Text style={{ color: IRON, fontWeight: '800' }}>Back to home</Text>
            <Icon name="ArrowRight" size={14} color={IRON} />
          </Pressable>
        </Link>
      </View>
    </>
  );
}
