import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthSteps } from '@/app/hooks/useHealthSteps';
import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function OnboardingHealth() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const health = useHealthSteps();
  const [busy, setBusy] = useState(false);
  const granted = health.hasPermission;

  async function onConnect() {
    try {
      setBusy(true);
      await health.requestPermission();
    } finally {
      setBusy(false);
    }
  }
  function onNext() {
    router.push('/onboarding/notifications' as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: PAGE_X, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>STEP 2 OF 4</Text>
          {granted ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: LIME + '22',
              }}>
              <Text style={{ color: LIME, fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
                CONNECTED
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={{
            color: colors.text,
            fontSize: 30,
            fontWeight: '900',
            letterSpacing: -0.8,
            marginTop: 8,
            lineHeight: 36,
          }}>
          Connect Apple Health.
        </Text>
        <Text
          style={{ color: colors.text, opacity: 0.65, fontSize: 15, marginTop: 14, lineHeight: 22 }}>
          Steps come straight from HealthKit so your wins are real and nobody
          can fake their way to a payout. We read step + workout data only —
          we never write anything back.
        </Text>

        <Image
          source={SCENARIO_MASCOTS.atRisk}
          resizeMode="contain"
          style={{ width: '100%', height: 220, marginTop: 14 }}
        />

        <View
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 18,
            backgroundColor: colors.text + '0c',
            borderWidth: 1,
            borderColor: colors.text + '14',
          }}>
          <Row icon="Footprints" tone={LIME} colors={colors} title="Step count" sub="Daily total per challenge." />
          <Row icon="Heart" tone={EMBER} colors={colors} title="Workouts" sub="Distance for run/walk/bike bets." />
          <Row
            icon="ShieldCheck"
            tone={GOLD}
            colors={colors}
            title="Stays on device"
            sub="We only see the aggregates you stake on."
            isLast
          />
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 18,
          gap: 10,
        }}>
        {granted ? (
          <Pressable
            onPress={onNext}
            style={{
              height: 56,
              borderRadius: 18,
              backgroundColor: GOLD,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            }}>
            <Text style={{ color: IRON, fontWeight: '900', fontSize: 16 }}>Continue</Text>
            <Icon name="ArrowRight" size={16} color={IRON} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onConnect}
            disabled={busy}
            style={{
              height: 56,
              borderRadius: 18,
              backgroundColor: GOLD,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: busy ? 0.6 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <>
                <Icon name="Heart" size={16} color={IRON} />
                <Text style={{ color: IRON, fontWeight: '900', fontSize: 16 }}>
                  Connect Apple Health
                </Text>
              </>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={onNext}
          style={{
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: colors.text, opacity: 0.55, fontWeight: '600', fontSize: 13 }}>
            {granted ? '' : 'Set up later'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  icon,
  tone,
  title,
  sub,
  colors,
  isLast,
}: {
  icon: string;
  tone: string;
  title: string;
  sub: string;
  colors: ReturnType<typeof useThemeColors>;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.text + '14',
      }}>
      <View
        style={{
          width: 28,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
        <Icon name={icon as any} size={16} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{title}</Text>
        <Text style={{ color: colors.text, opacity: 0.55, fontSize: 12, marginTop: 1 }}>{sub}</Text>
      </View>
    </View>
  );
}
