// Friends hub — Manage segment body. Search the room, add friends,
// invite by link, list current friends.

import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { GOLD, IRON } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export function ManageSegment() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const friends = useQuery(api.friends.list);
  const me = useQuery(api.users.me);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const addFriend = useMutation(api.friends.addFriend);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery(
    api.friends.searchByName,
    debounced.length > 0 ? { q: debounced } : 'skip'
  );

  async function onAdd(profileId: Id<'profiles'>) {
    try {
      setAdding(profileId);
      await addFriend({ profileId });
      setQuery('');
      setDebounced('');
    } catch (e: any) {
      Alert.alert('Could not add', e?.message ?? String(e));
    } finally {
      setAdding(null);
    }
  }

  async function onInvite() {
    const handle = me?.username ?? null;
    const link = handle ? `fitstake://join/${handle}` : 'fitstake://join';
    const intro = handle
      ? `I'm @${handle} on FitStake. Bet me on workouts and steps:`
      : 'I started using FitStake. We can bet on workouts and steps. Get the app:';
    try {
      await Share.share({ message: `${intro} ${link}` });
    } catch {
      // user cancelled
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: PAGE_X,
        paddingBottom: insets.bottom + 24,
      }}
      showsVerticalScrollIndicator={false}>
      <Image
        source={SCENARIO_MASCOTS.friendMatch}
        resizeMode="cover"
        style={{
          width: '100%',
          height: 170,
          borderRadius: 18,
          marginTop: 14,
          marginBottom: 18,
          backgroundColor: colors.text + '10',
        }}
      />
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
        }}>
        Bring someone to bet against.
      </Text>
      <Text
        style={{
          marginTop: 6,
          color: colors.text,
          opacity: 0.6,
          fontSize: 13,
          lineHeight: 19,
        }}>
        Search the room or invite someone with a link. No phone contacts;
        nothing scraped.
      </Text>

      {/* Search */}
      <View style={{ marginTop: SECTION_GAP }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.text + '24',
            paddingVertical: 8,
          }}>
          <Icon name="Search" size={16} color={colors.text + '99'} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor={colors.text + '60'}
            autoCorrect={false}
            autoCapitalize="words"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 16,
              fontWeight: '600',
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="X" size={14} color={colors.text + '99'} />
            </Pressable>
          ) : null}
        </View>

        {debounced.length > 0 ? (
          results === undefined ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : results.length === 0 ? (
            <Text
              style={{
                marginTop: 12,
                color: colors.text,
                opacity: 0.5,
                fontSize: 13,
              }}>
              No matches for &quot;{debounced}&quot;.
            </Text>
          ) : (
            <View style={{ marginTop: 4 }}>
              {results.map((p: any, i: number) => (
                <View
                  key={p.profileId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.text + '14',
                  }}>
                  <Avatar name={p.displayName} colors={colors} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: '700',
                      }}>
                      {p.displayName ?? 'Anonymous'}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        color: colors.text,
                        opacity: 0.5,
                        fontSize: 11,
                      }}>
                      +${p.totalWon} won · ${p.totalForfeited} forfeited
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onAdd(p.profileId)}
                    disabled={adding === p.profileId}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${p.displayName ?? 'friend'}`}
                    style={{
                      paddingHorizontal: 16,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor: GOLD,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: adding === p.profileId ? 0.6 : 1,
                    }}>
                    {adding === p.profileId ? (
                      <ActivityIndicator color={IRON} />
                    ) : (
                      <Text
                        style={{
                          color: IRON,
                          fontWeight: '800',
                          fontSize: 13,
                        }}>
                        Add
                      </Text>
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          )
        ) : null}
      </View>

      {/* Existing friends */}
      <View style={{ marginTop: SECTION_GAP }}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
          YOURS {friends && friends.length > 0 ? `· ${friends.length}` : ''}
        </Text>
        {(friends ?? []).length === 0 ? (
          <View
            style={{
              marginTop: 12,
              padding: 18,
              borderRadius: 14,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.border,
            }}>
            <Text
              style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              No friends yet.
            </Text>
            <Text
              style={{
                marginTop: 4,
                color: colors.text,
                opacity: 0.55,
                fontSize: 12,
                lineHeight: 18,
              }}>
              Search above, accept a head-to-head invite, or share the link
              below.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 4 }}>
            {(friends ?? []).map((f: any, i: number) => (
              <Pressable
                key={f.profileId}
                onPress={() => router.push(`/friends/${f.profileId}` as any)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.text + '14',
                }}>
                <Avatar name={f.displayName} colors={colors} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 15,
                      fontWeight: '700',
                    }}>
                    {f.displayName ?? 'Anonymous'}
                  </Text>
                  <Text
                    style={{
                      color: colors.text,
                      opacity: 0.5,
                      fontSize: 12,
                      marginTop: 2,
                    }}>
                    +${f.totalWon} won · ${f.totalForfeited} forfeited
                  </Text>
                </View>
                <Icon name="ChevronRight" size={16} color={colors.text} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        onPress={onInvite}
        style={{
          marginTop: SECTION_GAP,
          height: 54,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: GOLD,
        }}>
        <Text style={{ color: IRON, fontWeight: '800', fontSize: 16 }}>
          Invite by link
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Avatar({
  name,
  colors,
}: {
  name: string | null;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const letter = (name ?? '?')[0]?.toUpperCase() ?? '?';
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.text + '14',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
        {letter}
      </Text>
    </View>
  );
}

export default ManageSegment;
