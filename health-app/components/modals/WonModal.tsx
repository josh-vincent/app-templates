import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Text, useWindowDimensions } from 'react-native';

import { type WonPayload } from '@/lib/celebrations';
import { MOMENT_MASCOTS } from '@/lib/healthpulseImages';
import { GOLD, IRON, LIME } from '@/lib/theme';

type Props = {
  visible: boolean;
  payload: WonPayload | null;
  onDismiss: () => void;
};

export default function WonModal({ visible, payload, onDismiss }: Props) {
  const { width } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }),
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
  const isJackpot = payload.source === 'jackpot';
  const accentTop = isJackpot ? GOLD : LIME;
  const accentBottom = isJackpot ? '#d39c1d' : '#1aa057';

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
            colors={[accentTop, accentBottom]}
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
              source={isJackpot ? MOMENT_MASCOTS.jackpotBet : MOMENT_MASCOTS.youWon}
              style={{ width: '100%', height: Math.min(300, width * 0.7) }}
              resizeMode="cover"
            />
            <Animated.View style={{ alignItems: 'center', padding: 28, paddingTop: 22 }}>
              <Text
                style={{
                  color: IRON,
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 2,
                  marginBottom: 4,
                }}>
                {isJackpot ? 'JACKPOT' : 'YOU WON'}
              </Text>
              <Text
                numberOfLines={1}
                minimumFontScale={0.5}
                adjustsFontSizeToFit
                style={{
                  color: IRON,
                  fontSize: 76,
                  fontWeight: '900',
                  letterSpacing: -2.5,
                  fontVariant: ['tabular-nums'],
                  textAlign: 'center',
                  marginTop: 4,
                }}>
                +${Math.round(payload.amount)}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  color: IRON,
                  opacity: 0.8,
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                  marginTop: 6,
                }}>
                {payload.betTitle}
              </Text>
              {payload.finalSteps != null && payload.goal != null ? (
                <Text
                  style={{
                    color: IRON,
                    opacity: 0.6,
                    fontSize: 13,
                    marginTop: 6,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {payload.finalSteps.toLocaleString()} / {payload.goal.toLocaleString()}
                </Text>
              ) : null}
              <Pressable
                onPress={onDismiss}
                style={{
                  marginTop: 24,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: IRON,
                }}>
                <Text
                  style={{ color: accentTop, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 }}>
                  NICE
                </Text>
              </Pressable>
            </Animated.View>
          </LinearGradient>
          <Text
            style={{
              color: 'white',
              opacity: 0.55,
              fontSize: 12,
              marginTop: 14,
              textAlign: 'center',
            }}>
            Tap anywhere to dismiss
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
