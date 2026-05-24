import { Link, Stack } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import GeoGlyph from '@/components/GeoGlyph';
import Header from '@/components/Header';
import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { BRICK, INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

export default function NotFoundScreen() {
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const screenBg = isDark ? themeColors.bg : PARCHMENT;
  const cardBg = isDark ? themeColors.secondary : PARCHMENT_DEEP;
  const textColor = isDark ? themeColors.text : INK;
  const pillBg = isDark ? themeColors.text : INK;
  const pillFg = isDark ? themeColors.bg : PARCHMENT;

  return (
    <>
      <Stack.Screen />
      <Header title=" " showBackButton />
      <View className="flex-1 justify-center px-global" style={{ backgroundColor: screenBg }}>
        <View className="rounded-3xl p-5" style={{ backgroundColor: cardBg }}>
          <View className="flex-row items-start justify-between">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: pillBg }}>
              <Icon name="AlertCircle" size={19} color={pillFg} />
            </View>
            <GeoGlyph kind="compass" size={58} color={textColor} accent={BRICK} />
          </View>
          <Text
            className="mt-16"
            style={{ color: textColor, fontFamily: SERIF, fontSize: 28, letterSpacing: -0.35 }}>
            This route is off-map
          </Text>
          <Text
            className="mt-2"
            style={{
              color: textColor,
              fontSize: 13,
              fontStyle: 'italic',
              lineHeight: 19,
              opacity: 0.62,
            }}>
            The page you were looking for does not exist or has moved.
          </Text>
          <Link href="/" asChild>
            <Pressable
              className="mt-6 flex-row items-center justify-center rounded-full px-5 py-3.5"
              style={{ backgroundColor: pillBg }}>
              <Text style={{ color: pillFg, fontFamily: SERIF, fontSize: 15 }}>Back home</Text>
              <Icon name="ArrowRight" size={14} color={pillFg} />
            </Pressable>
          </Link>
        </View>
      </View>
    </>
  );
}
