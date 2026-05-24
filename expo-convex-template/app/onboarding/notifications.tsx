import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function OnboardingNotifications() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'unknown' | 'granted' | 'denied' | 'mocked'>(
    'unknown'
  );

  async function onEnable() {
    setBusy(true);
    try {
      // Avoid a hard import so the screen still loads on configurations that
      // haven't linked expo-notifications natively yet. The onboarding flow
      // must always render — granular failure is fine.
      const Notifications = await import('expo-notifications').catch(() => null);
      if (!Notifications) {
        setStatus('mocked');
        return;
      }
      const { status: s } = await Notifications.requestPermissionsAsync();
      setStatus(s === 'granted' ? 'granted' : 'denied');
    } catch {
      setStatus('mocked');
    } finally {
      setBusy(false);
    }
  }
  function onNext() {
    router.push('/onboarding/first-bet' as any);
  }

  const enabled = status === 'granted' || status === 'mocked';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: PAGE_X, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>STEP 3 OF 4</Text>
          {enabled ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: LIME + '22',
              }}>
              <Text style={{ color: LIME, fontWeight: '800', fontSize: 10, letterSpacing: 1 }}>
                {status === 'mocked' ? 'DEV STUB' : 'ON'}
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
          Get nudged before money's lost.
        </Text>
        <Text
          style={{ color: colors.text, opacity: 0.65, fontSize: 15, marginTop: 14, lineHeight: 22 }}>
          Reminders fire smart — based on how long your bet runs. Tuned to
          give you time to act, not buzz constantly.
        </Text>

        <Image
          source={SCENARIO_MASCOTS.atRisk}
          resizeMode="contain"
          style={{ width: '100%', height: 200, marginTop: 14 }}
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
          <Bucket label="Same-day bet" leads={['4h', '30m']} colors={colors} />
          <Bucket label="Weekend warriors (1–3d)" leads={['1d', '4h', '1h']} colors={colors} />
          <Bucket label="Weekly goal (4–14d)" leads={['2d', '1d', '4h', '1h']} colors={colors} />
          <Bucket label="Long haul (>14d)" leads={['3d', '1d', '4h']} colors={colors} isLast />
        </View>
        <Text
          style={{ color: colors.text, opacity: 0.45, fontSize: 11, marginTop: 8 }}>
          You can tweak these anytime in Profile → Reminders.
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 18,
          gap: 10,
        }}>
        {enabled ? (
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
            onPress={onEnable}
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
                <Icon name="Bell" size={16} color={IRON} />
                <Text style={{ color: IRON, fontWeight: '900', fontSize: 16 }}>
                  Enable notifications
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
            {enabled ? '' : 'Set up later'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Bucket({
  label,
  leads,
  colors,
  isLast,
}: {
  label: string;
  leads: string[];
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
      <Text style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 13 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {leads.map((l) => (
          <View
            key={l}
            style={{
              backgroundColor: GOLD + '22',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}>
            <Text style={{ color: GOLD, fontWeight: '800', fontSize: 11 }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
