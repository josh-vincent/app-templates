import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { EMBER, GOLD, IRON, SKY } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

type Place = {
  _id: string;
  name: string;
  city?: string;
  country?: string;
  note?: string;
  emoji?: string;
};

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const places = useQuery(api.places.mySavedPlaces, {}) as Place[] | undefined;
  const deletePlace = useMutation(api.places.deletePlace);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingTop: 12,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <View>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
            BOOKMARKED
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: colors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.6,
            }}>
            Saved Places
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/place/new' as any)}
          accessibilityRole="button"
          accessibilityLabel="Save a new place"
          testID="add-place-button"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: SKY,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="Plus" size={22} color={IRON} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingTop: 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}>
        {places === undefined ? (
          <View
            style={{
              height: 120,
              borderRadius: 18,
              backgroundColor: colors.text + '08',
            }}
          />
        ) : places.length === 0 ? (
          <Pressable
            onPress={() => router.push('/place/new' as any)}
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 22,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: colors.border,
              alignItems: 'center',
            }}>
            <Text style={{ fontSize: 48 }}>📍</Text>
            <Text
              style={{
                marginTop: 12,
                fontSize: 18,
                fontWeight: '800',
                color: colors.text,
              }}>
              Nothing saved yet
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontSize: 13,
                color: colors.text,
                opacity: 0.65,
                textAlign: 'center',
              }}>
              Pin a city, a hotel, or a hike you want to come back to.
            </Text>
          </Pressable>
        ) : (
          places.map((p) => (
            <View
              key={p._id}
              style={{
                marginBottom: 10,
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.text + '08',
                borderWidth: 1,
                borderColor: colors.text + '14',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: SKY + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                <Text style={{ fontSize: 22 }}>{p.emoji ?? '📍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                  {p.name}
                </Text>
                {p.city || p.country ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.text,
                      opacity: 0.6,
                      fontSize: 12,
                      marginTop: 2,
                    }}>
                    {[p.city, p.country].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
                {p.note ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors.text,
                      opacity: 0.55,
                      fontSize: 12,
                      marginTop: 4,
                    }}>
                    {p.note}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => deletePlace({ id: p._id as any })}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.name}`}
                hitSlop={10}
                style={{ padding: 8, opacity: 0.55 }}>
                <Icon name="Trash2" size={16} color={EMBER} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
