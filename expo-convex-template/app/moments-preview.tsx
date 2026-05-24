import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FitStakeMomentCard from '@/components/FitStakeMomentCard';
import Icon from '@jv/ui';
import PermissionsMomentModal from '@/components/modals/PermissionsMomentModal';
import { useThemeColors } from '@jv/ui';
import { FITSTAKE_MOMENTS } from '@/lib/fitstakeMoments';

const PAGE_X = 20;

export default function MomentsPreviewScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 28,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
            marginBottom: 16,
          }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.text + '0d',
            }}>
            <Icon name="ChevronLeft" size={21} color={colors.text} />
          </Pressable>
          <Text
            style={{
              color: colors.text,
              opacity: 0.5,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.4,
            }}>
            MOMENTS PREVIEW
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <Text
          style={{
            color: colors.text,
            fontSize: 34,
            fontWeight: '900',
            letterSpacing: -1.2,
          }}>
          Gamification states
        </Text>
        <Text
          style={{ color: colors.text, opacity: 0.58, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
          Preview the mascot system across wins, jackpots, friend forfeits, deadlines, streaks,
          activation, and permissions.
        </Text>

        <View style={{ gap: 16, marginTop: 20 }}>
          {FITSTAKE_MOMENTS.map((moment) => (
            <FitStakeMomentCard
              key={moment.id}
              colors={colors}
              moment={moment}
              onPrimaryPress={
                moment.id === 'permissions' ? () => setPermissionsOpen(true) : undefined
              }
            />
          ))}
        </View>
      </ScrollView>
      <PermissionsMomentModal
        visible={permissionsOpen}
        onDismiss={() => setPermissionsOpen(false)}
      />
    </View>
  );
}
