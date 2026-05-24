// Referral landing — receives a `ref` segment that is the inviter's
// username. Shows their snapshot + CTA to claim the referral and proceed
// into the app.
//
// Defensive: if the username is unknown OR the user is already onboarded,
// we still call claimReferral (idempotent / no-op respectively) and route
// somewhere sensible.

import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function JoinViaReferral() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { ref } = useLocalSearchParams<{ ref?: string | string[] }>();
  const username = (Array.isArray(ref) ? ref[0] : ref ?? '').toLowerCase();

  const referrer = useQuery(
    api.users.profileByUsername,
    username ? { username } : 'skip'
  );
  const me = useQuery(api.users.me);
  const claimReferral = useMutation(api.users.claimReferral);
  const [busy, setBusy] = useState(false);

  async function accept() {
    try {
      setBusy(true);
      await claimReferral({ referrerUsername: username }).catch(() => null);
      if (me?.onboardingComplete) {
        router.replace('/(tabs)/(home)' as any);
      } else {
        router.replace('/onboarding/welcome' as any);
      }
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (me?.onboardingComplete) router.replace('/(tabs)/(home)' as any);
    else router.replace('/onboarding/welcome' as any);
  }

  const loading = referrer === undefined && username !== '';
  const unknown = !loading && !referrer;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: PAGE_X, flex: 1 }}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>INVITE</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 30,
            fontWeight: '900',
            letterSpacing: -0.8,
            marginTop: 8,
            lineHeight: 36,
          }}>
          {referrer
            ? `${referrer.displayName ?? '@' + (referrer.username ?? username)} wants to bet you.`
            : unknown
              ? 'Invite link expired.'
              : 'Loading your invite…'}
        </Text>
        <Text
          style={{ color: colors.text, opacity: 0.65, fontSize: 15, marginTop: 14, lineHeight: 22 }}>
          {referrer
            ? `Sign up to stake against them head-to-head. Apple Health verifies the steps so nobody fakes a win.`
            : unknown
              ? `We couldn't find @${username}. You can still join FitStake on your own.`
              : 'Just a sec.'}
        </Text>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          {referrer ? (
            <LinearGradient
              colors={[GOLD, '#d39c1d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 24,
                padding: 22,
                alignItems: 'center',
              }}>
              <Image
                source={SCENARIO_MASCOTS.betWon}
                resizeMode="contain"
                style={{ width: '100%', height: 160 }}
              />
              <Text style={{ color: IRON, fontWeight: '900', fontSize: 22 }}>
                {referrer.displayName ?? `@${referrer.username ?? username}`}
              </Text>
              {referrer.username ? (
                <Text style={{ color: IRON, opacity: 0.6, fontSize: 13 }}>
                  @{referrer.username}
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 12,
                  gap: 18,
                }}>
                <Stat
                  label="WON"
                  value={`+$${referrer.totalWon}`}
                  color={LIME}
                />
                <Stat
                  label="FORFEIT"
                  value={`−$${referrer.totalForfeited}`}
                  color={EMBER}
                />
              </View>
            </LinearGradient>
          ) : loading ? (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 18,
          gap: 10,
        }}>
        <Pressable
          onPress={accept}
          disabled={busy || loading}
          style={{
            height: 56,
            borderRadius: 18,
            backgroundColor: GOLD,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: busy || loading ? 0.6 : 1,
          }}>
          {busy ? (
            <ActivityIndicator color={IRON} />
          ) : (
            <>
              <Text style={{ color: IRON, fontWeight: '900', fontSize: 16 }}>
                {referrer ? `Join with ${referrer.displayName ?? username}` : 'Join FitStake'}
              </Text>
              <Icon name="ArrowRight" size={16} color={IRON} />
            </>
          )}
        </Pressable>
        <Pressable
          onPress={dismiss}
          style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text, opacity: 0.55, fontWeight: '600', fontSize: 13 }}>
            Skip
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
        {label}
      </Text>
      <Text
        style={{
          color,
          fontSize: 20,
          fontWeight: '900',
          marginTop: 2,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}
