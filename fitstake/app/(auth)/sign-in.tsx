import { useAuthActions } from '@convex-dev/auth/react';
import { AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, GOLD, IRON } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function SignInScreen() {
  const { signIn } = useAuthActions();
  const [loading, setLoading] = useState<null | 'anon' | 'apple'>(null);

  async function go(provider: 'anonymous' | 'apple') {
    try {
      setLoading(provider === 'anonymous' ? 'anon' : 'apple');
      await signIn(provider);
      router.replace('/(tabs)/(home)');
    } catch (e) {
      console.warn('[sign-in] failed', e);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: IRON }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: PAGE_X,
          justifyContent: 'space-between',
        }}>
        {/* Top: brand + headline */}
        <View style={{ paddingTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="Trophy" size={16} color={GOLD} />
            <Text style={{ ...EYEBROW, color: GOLD }}>FITSTAKE</Text>
          </View>
        </View>

        {/* Middle: pitch */}
        <View>
          <Image
            source={SCENARIO_MASCOTS.jackpotRunPool}
            resizeMode="cover"
            style={{
              width: '100%',
              height: 178,
              borderRadius: 18,
              marginBottom: 22,
              backgroundColor: 'rgba(247,244,239,0.08)',
            }}
          />
          <Text
            style={{
              color: BONE,
              fontSize: 38,
              fontWeight: '700',
              letterSpacing: -1,
              lineHeight: 42,
            }}>
            Put your <Text style={{ fontWeight: '900' }}>money</Text>{'\n'}where your workout is.
          </Text>
          <Text
            style={{
              marginTop: 14,
              color: BONE,
              opacity: 0.65,
              fontSize: 15,
              lineHeight: 22,
            }}>
            Stake on any activity. Hit it, keep your stake. Miss it, you forfeit. Bet against
            yourself, against a friend, or against the market.
          </Text>
        </View>

        {/* Bottom: actions */}
        <View style={{ paddingBottom: 12 }}>
          <Pressable
            onPress={() => go('apple')}
            disabled={loading !== null}
            style={{
              height: 54,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: BONE,
              opacity: loading ? 0.7 : 1,
            }}>
            {loading === 'apple' ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <>
                <AntDesign name="apple" size={18} color={IRON} style={{ marginRight: 10 }} />
                <Text style={{ color: IRON, fontSize: 16, fontWeight: '700' }}>
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>

          {/* Guest is a text link — it's the lossy path the user will
              regret on a new device since there's no recovery. Keep it
              discoverable but smaller than the primary action. */}
          <Pressable
            onPress={() => go('anonymous')}
            disabled={loading !== null}
            hitSlop={12}
            style={{
              marginTop: 14,
              paddingVertical: 8,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}>
            {loading === 'anon' ? (
              <ActivityIndicator color={BONE} />
            ) : (
              <Text style={{ color: BONE, opacity: 0.7, fontSize: 14, fontWeight: '600' }}>
                Continue as guest
              </Text>
            )}
          </Pressable>

          <Text
            style={{
              marginTop: 18,
              textAlign: 'center',
              color: BONE,
              opacity: 0.4,
              fontSize: 11,
              lineHeight: 17,
            }}>
            Virtual balances only in v0. Stake forfeits are non-refundable and
            pool to other players. No real cash. Health permission needed for
            sensor-tracked bets.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
