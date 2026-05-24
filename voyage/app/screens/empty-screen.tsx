import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import GeoGlyph from '@/components/GeoGlyph';
import Header from '@/components/Header';
import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { BRICK, INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

const EmptyScreen = () => {
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const screenBg = isDark ? themeColors.bg : PARCHMENT;
  const cardBg = isDark ? themeColors.secondary : PARCHMENT_DEEP;
  const textColor = isDark ? themeColors.text : INK;
  const pillBg = isDark ? themeColors.text : INK;
  const pillFg = isDark ? themeColors.bg : PARCHMENT;

  return (
    <>
      <Header title=" " showBackButton />
      <View className="flex-1 justify-center px-global" style={{ backgroundColor: screenBg }}>
        <View className="rounded-3xl p-5" style={{ backgroundColor: cardBg }}>
          <GeoGlyph kind="compass" size={64} color={textColor} accent={BRICK} />
          <Text
            className="mt-5"
            style={{ color: textColor, fontFamily: SERIF, fontSize: 24, letterSpacing: -0.3 }}>
            Nothing here yet
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
            This placeholder is ready for a future Voyage workflow.
          </Text>
          <Pressable
            onPress={() => router.replace('/(tabs)/(home)')}
            className="mt-6 flex-row items-center justify-center rounded-full px-5 py-3.5"
            style={{ backgroundColor: pillBg }}>
            <Text style={{ color: pillFg, fontFamily: SERIF, fontSize: 15 }}>Back home</Text>
            <Icon name="ArrowRight" size={14} color={pillFg} />
          </Pressable>
        </View>
      </View>
    </>
  );
};

export default EmptyScreen;
