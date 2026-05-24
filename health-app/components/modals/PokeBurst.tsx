// Floating-emoji overlay. Reads the unseen-poke head from Convex and
// animates it bottom-to-top with a fade. On animation end, marks the row
// seen which immediately rotates in the next one.
//
// Doesn't trap touches — pointerEvents='none' on the outer wrapper so
// scroll / taps underneath still work.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/contexts/ThemeColors';
import { useNextPoke } from '@/lib/pokes';
import { IRON } from '@/lib/theme';

const DURATION_MS = 1700;

export default function PokeBurst() {
  const { current, dismiss } = useNextPoke();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!current) return;
    translateY.setValue(height * 0.6);
    opacity.setValue(0);
    scale.setValue(0.6);

    const id = current.id;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -height * 0.45,
        duration: DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(DURATION_MS - 220 - 380),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 380,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.05,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      dismiss(id);
    });
  }, [current, height, opacity, scale, translateY, dismiss]);

  if (!current) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end' }]}>
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }, { scale }],
          alignItems: 'center',
          paddingBottom: insets.bottom + 12,
        }}>
        <Text style={{ fontSize: 96, lineHeight: 110 }}>{current.emoji}</Text>
        <View
          style={{
            marginTop: 4,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: IRON,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>
            from {current.fromName ?? 'a friend'}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
