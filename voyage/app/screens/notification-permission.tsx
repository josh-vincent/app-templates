import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

export default function NotificationPermissionScreen() {
  const handleSkip = () => {
    router.replace('/screens/location-permission');
  };

  return (
    <View className="flex-1 px-global pb-8 pt-16" style={{ backgroundColor: PARCHMENT }}>
      <View className="flex-1 justify-center">
        <View className="rounded-3xl p-5" style={{ backgroundColor: PARCHMENT_DEEP }}>
          <View className="flex-row items-start justify-between">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: INK }}>
              <Icon name="BellDot" size={20} color={PARCHMENT} />
            </View>
            <GeoGlyph kind="sun" size={54} color={INK} accent={BRICK} />
          </View>
          <Text
            className="mt-14"
            style={{ color: INK, fontFamily: SERIF, fontSize: 30, letterSpacing: -0.35 }}>
            Price drops, reminders, and trip nudges
          </Text>
          <Text
            className="mt-2"
            style={{
              color: INK,
              fontSize: 13,
              fontStyle: 'italic',
              lineHeight: 19,
              opacity: 0.65,
            }}>
            Let Voyage tell you when a fare gets interesting or a booked trip needs attention.
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Pressable
          className="h-14 flex-row items-center justify-center rounded-full"
          style={{ backgroundColor: INK }}>
          <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>
            Allow notifications
          </Text>
        </Pressable>
        <Pressable
          onPress={handleSkip}
          className="h-14 flex-row items-center justify-center rounded-full"
          style={{ backgroundColor: MOSS }}>
          <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}
