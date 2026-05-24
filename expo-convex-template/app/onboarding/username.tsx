import { useMutation, useQuery } from '@/lib/persona-convex';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, EMBER, GOLD, IRON } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function ClaimUsername() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const me = useQuery(api.users.me);
  const claim = useMutation(api.users.claimUsername);

  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If a username is already claimed, bounce home — this screen only fires
  // for the first-run gap.
  useEffect(() => {
    if (me?.username) router.replace('/(tabs)/(home)');
  }, [me?.username]);

  async function onClaim() {
    setError(null);
    const handle = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
      setError('3–20 chars · lowercase, digits, underscore');
      return;
    }
    try {
      setBusy(true);
      await claim({ username: handle });
      router.replace('/(tabs)/(home)');
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: IRON, paddingTop: insets.top }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingHorizontal: PAGE_X, justifyContent: 'space-between' }}>
        <View style={{ paddingTop: 24 }}>
          <Text style={{ ...EYEBROW, color: GOLD }}>FITSTAKE · CLAIM A NAME</Text>
        </View>

        <View>
          <Image
            source={SCENARIO_MASCOTS.friendMatch}
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
              fontSize: 34,
              fontWeight: '900',
              letterSpacing: -1,
              lineHeight: 38,
            }}>
            Pick a username friends{'\n'}can find you by.
          </Text>
          <Text
            style={{
              marginTop: 12,
              color: BONE,
              opacity: 0.65,
              fontSize: 14,
              lineHeight: 20,
            }}>
            Lowercase, 3–20 characters. Letters, numbers and underscores. You
            can change it later from Profile.
          </Text>

          <View
            style={{
              marginTop: 26,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(247,244,239,0.24)',
              paddingVertical: 8,
            }}>
            <Text style={{ color: BONE, opacity: 0.6, fontSize: 22, fontWeight: '700' }}>@</Text>
            <TextInput
              value={value}
              onChangeText={(t) => setValue(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              placeholder="miniai"
              placeholderTextColor="rgba(247,244,239,0.3)"
              style={{
                flex: 1,
                color: BONE,
                fontSize: 22,
                fontWeight: '700',
              }}
            />
          </View>
          {error ? (
            <Text style={{ marginTop: 8, color: EMBER, fontSize: 12, fontWeight: '600' }}>
              {error}
            </Text>
          ) : null}
        </View>

        <View style={{ paddingBottom: 12 }}>
          <Pressable
            onPress={onClaim}
            disabled={busy || value.length < 3}
            style={{
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: value.length >= 3 ? GOLD : 'rgba(247,244,239,0.14)',
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <Text style={{ color: value.length >= 3 ? IRON : BONE, fontSize: 16, fontWeight: '800' }}>
                Claim @{value || 'username'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
