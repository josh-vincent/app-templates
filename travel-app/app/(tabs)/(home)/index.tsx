import { router } from 'expo-router';
import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { api } from '@/convex/_generated/api';
import { useQuery } from '@/lib/persona-convex';
import { GOLD, IRON, LIME, SKY } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

function fmtDateRange(startsAt: number, endsAt: number): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const sStr = s.toLocaleDateString(undefined, opts);
  const eStr = e.toLocaleDateString(undefined, opts);
  if (sStr === eStr) return sStr;
  return `${sStr} – ${eStr}`;
}

function daysUntil(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  if (diff <= 0) return 'now';
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 30) return `in ${Math.round(days / 7)} weeks`;
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return `in ${Math.round(days / 365)} years`;
}

type Trip = {
  _id: string;
  title: string;
  destination: string;
  startsAt: number;
  endsAt: number;
  travelerCount: number;
  coverEmoji?: string;
};

export default function TripsHomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const me = useQuery(api.users.me, {});
  const trips = useQuery(api.trips.myTrips, {}) as Trip[] | undefined;
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 350));
    setRefreshing(false);
  };

  const now = Date.now();
  const upcoming = (trips ?? []).filter((t) => t.endsAt >= now);
  const past = (trips ?? []).filter((t) => t.endsAt < now);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
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
            VOYAGER
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: colors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.6,
            }}
            accessibilityLabel="Trips">
            My Trips
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/trip/new' as any)}
          accessibilityRole="button"
          accessibilityLabel="Add new trip"
          testID="add-trip-button"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: GOLD,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="Plus" size={22} color={IRON} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }>
        {trips === undefined ? (
          <View
            style={{
              height: 120,
              borderRadius: 18,
              backgroundColor: colors.text + '08',
            }}
          />
        ) : trips.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <View>
                <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                  UPCOMING · {upcoming.length}
                </Text>
                <View style={{ marginTop: 10 }}>
                  {upcoming.map((t) => (
                    <TripCard key={t._id} trip={t} colors={colors} accent={GOLD} />
                  ))}
                </View>
              </View>
            ) : null}
            {past.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                  PAST · {past.length}
                </Text>
                <View style={{ marginTop: 10 }}>
                  {past.map((t) => (
                    <TripCard key={t._id} trip={t} colors={colors} accent={SKY} past />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TripCard({
  trip,
  colors,
  accent,
  past,
}: {
  trip: Trip;
  colors: ReturnType<typeof useThemeColors>;
  accent: string;
  past?: boolean;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/trip/${trip._id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`Open trip ${trip.title} to ${trip.destination}`}
      testID={`trip-card-${trip._id}`}
      style={{
        marginBottom: 12,
        padding: 16,
        borderRadius: 18,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: accent + '30',
        flexDirection: 'row',
        alignItems: 'center',
        opacity: past ? 0.7 : 1,
      }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: accent + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}>
        <Text style={{ fontSize: 26 }}>{trip.coverEmoji ?? '✈️'}</Text>
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text
          numberOfLines={1}
          style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
          {trip.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            opacity: 0.7,
            fontSize: 13,
            marginTop: 2,
            fontWeight: '600',
          }}>
          {trip.destination}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="Calendar" size={12} color={colors.text + 'aa'} />
            <Text style={{ color: colors.text, opacity: 0.65, fontSize: 12 }}>
              {fmtDateRange(trip.startsAt, trip.endsAt)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="Users" size={12} color={colors.text + 'aa'} />
            <Text style={{ color: colors.text, opacity: 0.65, fontSize: 12 }}>
              {trip.travelerCount}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {!past ? (
          <Text style={{ ...EYEBROW, color: accent }}>
            {daysUntil(trip.startsAt).toUpperCase()}
          </Text>
        ) : (
          <Text style={{ ...EYEBROW, color: accent }}>WRAPPED</Text>
        )}
        <Icon name="ChevronRight" size={16} color={colors.text + 'aa'} />
      </View>
    </Pressable>
  );
}

function EmptyState({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable
      onPress={() => router.push('/trip/new' as any)}
      accessibilityRole="button"
      accessibilityLabel="Plan your first trip"
      style={{
        marginTop: 40,
        padding: 24,
        borderRadius: 22,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: colors.border,
        alignItems: 'center',
      }}>
      <Text style={{ fontSize: 56 }}>🗺️</Text>
      <Text
        style={{
          marginTop: 14,
          fontSize: 20,
          fontWeight: '800',
          color: colors.text,
          letterSpacing: -0.4,
        }}>
        Plan your first trip
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 14,
          color: colors.text,
          opacity: 0.65,
          textAlign: 'center',
        }}>
        Pick a destination, set the dates, and shape your itinerary day by day.
      </Text>
      <View
        style={{
          marginTop: 18,
          paddingVertical: 12,
          paddingHorizontal: 20,
          backgroundColor: GOLD,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
        <Icon name="Plus" size={16} color={IRON} />
        <Text style={{ color: IRON, fontWeight: '800', fontSize: 14 }}>
          New trip
        </Text>
      </View>
    </Pressable>
  );
}
