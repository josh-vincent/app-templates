import { useMutation, useQuery } from '@/lib/persona-convex';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function ClaimUsername() {
  const insets = useSafeAreaInsets();
  useThemeColors();
  const me = useQuery(api.users.me);
  const claim = useMutation(api.users.claimUsername);

  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Debounced echo of `value` — used to gate the availability lookup so
  // we don't hammer Convex on every keystroke.
  const [debounced, setDebounced] = useState('');

  // If a username is already claimed, bounce home — this screen only fires
  // for the first-run gap.
  useEffect(() => {
    if (me?.username) router.replace('/(tabs)/(home)');
  }, [me?.username]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 220);
    return () => clearTimeout(id);
  }, [value]);

  const isValid = USERNAME_RE.test(value);
  const lookupHandle = USERNAME_RE.test(debounced) ? debounced : null;
  const lookup = useQuery(
    api.users.profileByUsername,
    lookupHandle ? { username: lookupHandle } : 'skip'
  );

  // Settled = debounced value matches current input AND lookup has resolved.
  // While typing or while the query is in flight, we're "checking".
  const settled = lookupHandle != null && debounced === value && lookup !== undefined;
  // Lookup returns own profile too — treat self-match as available since
  // claimUsername is idempotent on the caller.
  const isTaken = settled && lookup != null && lookup.profileId !== me?._id;
  const isAvailable = settled && !isTaken;
  const canClaim = isValid && isAvailable && !busy;

  let statusLabel: string;
  let statusColor: string;
  if (!isValid) {
    statusLabel = value.length === 0 ? ' ' : '3–20 chars · a–z, 0–9, _';
    statusColor = BONE;
  } else if (!settled) {
    statusLabel = 'checking…';
    statusColor = BONE;
  } else if (isTaken) {
    statusLabel = `@${value} is taken`;
    statusColor = EMBER;
  } else {
    statusLabel = `@${value} is free`;
    statusColor = LIME;
  }

  async function onClaim() {
    if (!canClaim) return;
    setError(null);
    try {
      setBusy(true);
      await claim({ username: value });
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
              fontSize: 36,
              fontWeight: '900',
              letterSpacing: -1.1,
              lineHeight: 40,
            }}>
            Pick a username.
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: BONE,
              opacity: 0.6,
              fontSize: 14,
              lineHeight: 20,
            }}>
            Friends will search by this. Lowercase letters, digits, underscore.
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
              placeholder="yourname"
              placeholderTextColor="rgba(247,244,239,0.3)"
              style={{
                flex: 1,
                color: BONE,
                fontSize: 22,
                fontWeight: '700',
              }}
            />
          </View>
          <Text
            style={{
              marginTop: 8,
              minHeight: 16,
              color: statusColor,
              opacity: statusColor === BONE ? 0.55 : 1,
              fontSize: 12,
              fontWeight: '600',
            }}>
            {statusLabel}
          </Text>
          {error ? (
            <Text style={{ marginTop: 4, color: EMBER, fontSize: 12, fontWeight: '600' }}>
              {error}
            </Text>
          ) : null}
        </View>

        <View style={{ paddingBottom: 12 }}>
          <Pressable
            onPress={onClaim}
            disabled={!canClaim}
            style={{
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canClaim ? GOLD : 'rgba(247,244,239,0.14)',
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <Text style={{ color: canClaim ? IRON : BONE, fontSize: 16, fontWeight: '800' }}>
                Claim @{value || 'username'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
