import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { GOLD, IRON } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const me = useQuery(api.users.me, {});
  const trips = useQuery(api.trips.myTrips, {}) as any[] | undefined;
  const places = useQuery(api.places.mySavedPlaces, {}) as any[] | undefined;
  const setDisplayName = useMutation(api.users.setDisplayName);
  const setHomeCity = useMutation(api.users.setHomeCity);

  const [editName, setEditName] = useState(false);
  const [editCity, setEditCity] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [cityDraft, setCityDraft] = useState('');

  const displayName = me?.displayName ?? 'Traveler';
  const homeCity = me?.homeCity ?? '';

  const onSaveName = async () => {
    const v = nameDraft.trim();
    if (!v) return;
    await setDisplayName({ displayName: v });
    setEditName(false);
  };

  const onSaveCity = async () => {
    const v = cityDraft.trim();
    if (!v) return;
    await setHomeCity({ homeCity: v });
    setEditCity(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
        }}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>YOU</Text>
        <Text
          style={{
            marginTop: 2,
            color: colors.text,
            fontSize: 28,
            fontWeight: '800',
            letterSpacing: -0.6,
          }}>
          Profile
        </Text>

        {/* Avatar + Name */}
        <View
          style={{
            marginTop: 24,
            padding: 18,
            borderRadius: 18,
            backgroundColor: colors.text + '08',
            borderWidth: 1,
            borderColor: colors.text + '14',
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: GOLD,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}>
            <Text style={{ color: IRON, fontWeight: '800', fontSize: 26 }}>
              {(displayName[0] ?? '?').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            {editName ? (
              <View>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="Your name"
                  placeholderTextColor={colors.placeholder}
                  style={{
                    color: colors.text,
                    fontSize: 18,
                    fontWeight: '800',
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: GOLD,
                  }}
                  autoFocus
                  onSubmitEditing={onSaveName}
                  testID="profile-name-input"
                />
                <Pressable
                  onPress={onSaveName}
                  style={{ marginTop: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Save name">
                  <Text style={{ color: GOLD, fontWeight: '700', fontSize: 13 }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setNameDraft(displayName);
                  setEditName(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Edit display name">
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 20,
                    fontWeight: '800',
                  }}>
                  {displayName}
                </Text>
                <Text
                  style={{
                    color: colors.text,
                    opacity: 0.6,
                    fontSize: 12,
                    marginTop: 2,
                  }}>
                  Tap to edit
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Home city */}
        <View
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.text + '08',
            borderWidth: 1,
            borderColor: colors.text + '14',
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Icon name="Home" size={20} color={colors.text + 'cc'} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
              HOME CITY
            </Text>
            {editCity ? (
              <View>
                <TextInput
                  value={cityDraft}
                  onChangeText={setCityDraft}
                  placeholder="e.g. San Francisco"
                  placeholderTextColor={colors.placeholder}
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: GOLD,
                  }}
                  autoFocus
                  onSubmitEditing={onSaveCity}
                  testID="profile-city-input"
                />
                <Pressable onPress={onSaveCity} style={{ marginTop: 8 }}>
                  <Text style={{ color: GOLD, fontWeight: '700', fontSize: 13 }}>
                    Save
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setCityDraft(homeCity);
                  setEditCity(true);
                }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                    marginTop: 2,
                  }}>
                  {homeCity || 'Tap to set'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Stats */}
        <View
          style={{
            marginTop: 20,
            flexDirection: 'row',
            gap: 10,
          }}>
          <StatTile
            label="TRIPS"
            value={String(trips?.length ?? 0)}
            colors={colors}
          />
          <StatTile
            label="SAVED"
            value={String(places?.length ?? 0)}
            colors={colors}
          />
        </View>

        <Text
          style={{
            marginTop: 28,
            fontSize: 11,
            color: colors.text,
            opacity: 0.4,
            letterSpacing: 1.2,
          }}>
          VOYAGER · v0.1.0
        </Text>
      </ScrollView>
    </View>
  );
}

function StatTile({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: colors.text + '14',
      }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>{label}</Text>
      <Text
        style={{
          marginTop: 4,
          color: colors.text,
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: -0.6,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}
