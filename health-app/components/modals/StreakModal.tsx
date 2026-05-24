import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Text, useWindowDimensions } from 'react-native';

import { type StreakPayload } from '@/lib/celebrations';
import { momentForStreak } from '@/lib/healthpulseMoments';
import { GOLD, IRON } from '@/lib/theme';

type Props = {
  visible: boolean;
  payload: StreakPayload | null;
  onDismiss: () => void;
};

export default function StreakModal({ visible, payload, onDismiss }: Props) {
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scale, opacity]);

  if (!payload) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
        <Animated.View style={{ opacity, transform: [{ scale }], width: '100%' }}>
          <LinearGradient
            colors={[GOLD, '#d39c1d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 32,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowOffset: { width: 0, height: 12 },
              shadowRadius: 24,
            }}>
            <Image
              source={momentForStreak(payload.days)}
              style={{ width: '100%', height: Math.min(285, width * 0.68) }}
              resizeMode="cover"
            />
            <Animated.View style={{ alignItems: 'center', padding: 28, paddingTop: 22 }}>
              <Text
                style={{
                  color: IRON,
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 2,
                }}>
                ON A STREAK
              </Text>
              <Text
                style={{
                  color: IRON,
                  fontSize: 86,
                  fontWeight: '900',
                  letterSpacing: -3,
                  fontVariant: ['tabular-nums'],
                }}>
                {payload.days}
              </Text>
              <Text style={{ color: IRON, opacity: 0.75, fontSize: 14, fontWeight: '700' }}>
                {payload.days === 1 ? 'day in a row' : 'days in a row'}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  color: IRON,
                  opacity: 0.65,
                  fontSize: 13,
                  marginTop: 6,
                  textAlign: 'center',
                }}>
                {payload.betTitle}
              </Text>
              <Pressable
                onPress={onDismiss}
                style={{
                  marginTop: 22,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: IRON,
                }}>
                <Text style={{ color: GOLD, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>
                  KEEP GOING
                </Text>
              </Pressable>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
