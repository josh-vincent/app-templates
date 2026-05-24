import React from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';

import Icon from '@/components/Icon';
import type { HealthPulseMoment } from '@/lib/healthpulseMoments';
import { IRON } from '@/lib/theme';

type Props = {
  colors: {
    bg: string;
    text: string;
  };
  moment: HealthPulseMoment;
  onPrimaryPress?: () => void;
};

export default function HealthPulseMomentCard({ colors, moment, onPrimaryPress }: Props) {
  const { width } = useWindowDimensions();
  const imageHeight = Math.min(210, (width - 40) * 0.6);

  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.text + '14',
        backgroundColor: colors.text + '08',
      }}>
      <Image
        source={moment.image}
        resizeMode="cover"
        style={{
          width: '100%',
          height: imageHeight,
          backgroundColor: colors.text + '0d',
        }}
      />
      <View style={{ padding: 16 }}>
        <Text
          style={{
            color: moment.accent,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.4,
          }}>
          {moment.eyebrow}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: '900',
            letterSpacing: -0.5,
            marginTop: 5,
          }}>
          {moment.title}
        </Text>
        <Text
          style={{
            color: colors.text,
            opacity: 0.62,
            fontSize: 13,
            lineHeight: 18,
            marginTop: 7,
          }}>
          {moment.body}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={onPrimaryPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: moment.accent,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}>
            <Text style={{ color: IRON, fontSize: 13, fontWeight: '900' }}>
              {moment.primaryAction}
            </Text>
            <Icon name="ArrowRight" size={14} color={IRON} />
          </Pressable>
          {moment.secondaryAction ? (
            <Pressable
              style={{
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderWidth: 1,
                borderColor: colors.text + '18',
              }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
                {moment.secondaryAction}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
