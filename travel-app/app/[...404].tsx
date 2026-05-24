import { Link, Stack } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import Header from '@/components/Header';
import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { GOLD } from '@/lib/theme';

export default function NotFoundScreen() {
  const colors = useThemeColors();
  return (
    <>
      <Stack.Screen />
      <Header title=" " showBackButton />
      <View
        className="flex-1 items-center justify-center px-global"
        style={{ backgroundColor: colors.bg }}>
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: GOLD }}>
          <Icon name="AlertCircle" size={24} color="#0d1014" />
        </View>
        <Text
          className="mt-5"
          style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
          Off the track
        </Text>
        <Text
          className="mt-2 text-center"
          style={{ color: colors.text, opacity: 0.55, fontSize: 13, maxWidth: 280 }}>
          This screen doesn't exist (or hasn't been built yet).
        </Text>
        <Link href="/" asChild>
          <Pressable
            className="mt-6 flex-row items-center justify-center rounded-2xl px-5 py-3"
            style={{ backgroundColor: GOLD }}>
            <Text style={{ color: '#0d1014', fontWeight: '700' }}>Back to Today</Text>
            <Icon name="ArrowRight" size={14} color="#0d1014" />
          </Pressable>
        </Link>
      </View>
    </>
  );
}
