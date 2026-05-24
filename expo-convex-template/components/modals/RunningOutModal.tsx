import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import Icon from '@jv/ui';
import { type RunningOutPayload } from '@/lib/celebrations';
import { MOMENT_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, EMBER, IRON } from '@jv/tokens';

function fmtCountdown(hours: number) {
  if (hours <= 0) return 'overtime';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} min`;
  }
  if (hours < 24) {
    const whole = Math.floor(hours);
    const mins = Math.round((hours - whole) * 60);
    return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours - days * 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

type Props = {
  visible: boolean;
  payload: RunningOutPayload | null;
  onDismiss: () => void;
};

export default function RunningOutModal({ visible, payload, onDismiss }: Props) {
  const { width } = useWindowDimensions();
  const slide = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slide.setValue(40);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slide, opacity]);

  if (!payload) return null;
  const overtime = payload.hoursLeft <= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}>
        <Animated.View
          style={{
            opacity,
            transform: [{ translateY: slide }],
            width: '100%',
          }}>
          <LinearGradient
            colors={overtime ? ['#7b1d18', '#3a0f0c'] : [EMBER, '#9d2e26']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              borderRadius: 32,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowOffset: { width: 0, height: 12 },
              shadowRadius: 24,
            }}>
            <Image
              source={overtime ? MOMENT_MASCOTS.overtime : MOMENT_MASCOTS.timeRunningOut}
              style={{
                width: '100%',
                height: Math.min(260, width * 0.62),
              }}
              resizeMode="cover"
            />

            <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(0,0,0,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="Timer" size={22} color={BONE} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{ color: BONE, fontWeight: '800', fontSize: 13, letterSpacing: 1.4 }}>
                    {overtime ? 'OVERTIME' : 'TIME RUNNING OUT'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: BONE, fontWeight: '700', fontSize: 16, marginTop: 2 }}>
                    {payload.betTitle}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: 'center', marginTop: 18 }}>
                <Text
                  style={{
                    color: BONE,
                    opacity: 0.7,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.4,
                  }}>
                  {overtime ? 'PAST DEADLINE' : 'ENDS IN'}
                </Text>
                <Text
                  style={{
                    color: BONE,
                    fontSize: 56,
                    fontWeight: '900',
                    letterSpacing: -1.5,
                    marginTop: 4,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {fmtCountdown(payload.hoursLeft)}
                </Text>
                <Text
                  style={{
                    color: BONE,
                    opacity: 0.85,
                    fontSize: 14,
                    fontWeight: '600',
                    marginTop: 6,
                  }}>
                  {payload.shortReason}
                </Text>
                <Text style={{ color: BONE, opacity: 0.55, fontSize: 12, marginTop: 4 }}>
                  ${payload.stakeAmount} on the line
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
                <Pressable
                  onPress={onDismiss}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: BONE, fontWeight: '700' }}>Snooze</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onDismiss();
                    if (payload.betId) router.push(`/(tabs)/challenges/${payload.betId}` as any);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: BONE,
                    alignItems: 'center',
                  }}>
                  <Text style={{ color: IRON, fontWeight: '800' }}>Open bet</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
