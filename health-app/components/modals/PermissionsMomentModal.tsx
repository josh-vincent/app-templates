import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

import Icon from '@/components/Icon';
import { MOMENT_MASCOTS } from '@/lib/healthpulseImages';
import { BONE, IRON, LIME, SKY } from '@/lib/theme';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export default function PermissionsMomentModal({ visible, onDismiss }: Props) {
  const { width } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.68)',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}>
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <LinearGradient
            colors={[SKY, '#1f6ed0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowOffset: { width: 0, height: 14 },
              shadowRadius: 24,
            }}>
            <Image
              source={MOMENT_MASCOTS.permissions}
              resizeMode="cover"
              style={{
                width: '100%',
                height: Math.min(280, width * 0.58),
                backgroundColor: IRON,
              }}
            />
            <View style={{ padding: 22, paddingTop: 18 }}>
              <Text
                style={{
                  color: IRON,
                  fontSize: 12,
                  fontWeight: '900',
                  letterSpacing: 1.6,
                }}>
                ACTIVATE PROOF
              </Text>
              <Text
                style={{
                  color: IRON,
                  fontSize: 30,
                  fontWeight: '900',
                  letterSpacing: -0.8,
                  marginTop: 4,
                }}>
                Let HealthPulse verify the bet.
              </Text>
              <Text
                style={{ color: IRON, opacity: 0.72, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
                Health, location, camera, and notifications keep settlement clean and give friends a
                fair match.
              </Text>

              <View style={{ gap: 9, marginTop: 18 }}>
                <PermissionRow icon="HeartPulse" label="Activity proof" />
                <PermissionRow icon="MapPin" label="GPS-backed check-ins" />
                <PermissionRow icon="Bell" label="Deadline warnings" />
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
                <Pressable
                  onPress={onDismiss}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    borderRadius: 14,
                    paddingVertical: 14,
                    backgroundColor: IRON,
                  }}>
                  <Text style={{ color: BONE, fontSize: 14, fontWeight: '900' }}>Activate</Text>
                </Pressable>
                <Pressable
                  onPress={onDismiss}
                  style={{
                    alignItems: 'center',
                    borderRadius: 14,
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                    backgroundColor: 'rgba(13,16,20,0.16)',
                  }}>
                  <Text style={{ color: IRON, fontSize: 14, fontWeight: '800' }}>Later</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PermissionRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        borderRadius: 12,
        backgroundColor: 'rgba(13,16,20,0.13)',
        paddingHorizontal: 11,
        paddingVertical: 9,
      }}>
      <Icon name={icon as any} size={16} color={LIME} />
      <Text style={{ color: IRON, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}
