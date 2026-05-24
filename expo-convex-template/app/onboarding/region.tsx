import { useMutation, useQuery } from '@/lib/persona-convex';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/convex/_generated/api';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, EMBER, GOLD, IRON } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

function tryLoadLocation() {
  try {
    return require('expo-location') as typeof import('expo-location');
  } catch {
    return null;
  }
}

export default function ClaimRegion() {
  const insets = useSafeAreaInsets();
  const me = useQuery(api.users.me);
  const setRegion = useMutation(api.users.setRegion);
  const [busy, setBusy] = useState(false);

  async function onUseLocation() {
    const Location = tryLoadLocation();
    if (!Location) {
      Alert.alert('Location not wired', 'Run `npx expo prebuild` to enable region detect.');
      return;
    }
    try {
      setBusy(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow location once to detect your country.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const code = places[0]?.isoCountryCode ?? null;
      if (!code) {
        Alert.alert('Could not detect region', 'Try again or set it manually later.');
        return;
      }
      await setRegion({ countryCode: code });
      router.replace('/(tabs)/profile');
    } catch (e: any) {
      Alert.alert('Region detect failed', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: IRON, paddingTop: insets.top }}>
      <View style={{ flex: 1, paddingHorizontal: PAGE_X, justifyContent: 'space-between' }}>
        <View style={{ paddingTop: 24 }}>
          <Text style={{ ...EYEBROW, color: GOLD }}>FITSTAKE · YOUR REGION</Text>
        </View>

        <View>
          <Image
            source={SCENARIO_MASCOTS.jackpotRunPool}
            resizeMode="cover"
            style={{
              width: '100%',
              height: 174,
              borderRadius: 18,
              marginBottom: 22,
              backgroundColor: 'rgba(247,244,239,0.08)',
            }}
          />
          <Text
            style={{
              color: BONE,
              fontSize: 32,
              fontWeight: '900',
              letterSpacing: -1,
              lineHeight: 36,
            }}>
            Bet locally, win locally.
          </Text>
          <Text
            style={{
              marginTop: 12,
              color: BONE,
              opacity: 0.65,
              fontSize: 14,
              lineHeight: 20,
            }}>
            Your region scopes you into the country jackpot when forfeits land
            there. We capture only the country code, not your address.
          </Text>
          {me?.countryCode ? (
            <View
              style={{
                marginTop: 18,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(247,244,239,0.18)',
              }}>
              <Text style={{ color: BONE, opacity: 0.6, fontSize: 12 }}>Currently</Text>
              <Text style={{ color: GOLD, fontSize: 22, fontWeight: '800' }}>
                {me.countryCode}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ paddingBottom: 12 }}>
          <Pressable
            onPress={onUseLocation}
            disabled={busy}
            style={{
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: GOLD,
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <Text style={{ color: IRON, fontSize: 16, fontWeight: '800' }}>
                Use my location
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 10,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: BONE, opacity: 0.6, fontWeight: '600' }}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
