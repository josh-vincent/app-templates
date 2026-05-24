import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { EMBER, GOLD, IRON, LIME, SKY } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

type Activity = {
  time?: string;
  label: string;
  location?: string;
  icon?: string;
};

type Day = {
  _id: string;
  dayIndex: number;
  date: string;
  title?: string;
  activities: Activity[];
};

function fmtDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function fmtDateRange(startsAt: number, endsAt: number): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const detail = useQuery(api.trips.tripDetail, { id: id as any });
  const addActivity = useMutation(api.trips.addActivity);
  const deleteTrip = useMutation(api.trips.deleteTrip);

  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [activityLabel, setActivityLabel] = useState('');
  const [activityTime, setActivityTime] = useState('');
  const [activityLocation, setActivityLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (detail === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ height: insets.top }} />
      </View>
    );
  }
  if (detail === null) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top + 40,
          alignItems: 'center',
        }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Trip not found.</Text>
        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 12 }}
          accessibilityRole="button">
          <Text style={{ color: GOLD, fontSize: 14, fontWeight: '700' }}>
            Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const trip = detail.trip;
  const days = (detail.days ?? []) as Day[];

  const openAddSheet = (dayIndex: number) => {
    setActiveDay(dayIndex);
    setActivityLabel('');
    setActivityTime('');
    setActivityLocation('');
  };

  const onSubmitActivity = async () => {
    if (!activityLabel.trim() || activeDay === null) return;
    setSubmitting(true);
    try {
      await addActivity({
        tripId: trip._id as any,
        dayIndex: activeDay,
        label: activityLabel.trim(),
        time: activityTime.trim() || undefined,
        location: activityLocation.trim() || undefined,
      });
      setActiveDay(null);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete trip?', `This will remove "${trip.title}" and all of its itinerary.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTrip({ id: trip._id as any });
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top }} />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingTop: 8,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="trip-back-button"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.text + '12',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="ChevronLeft" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onDelete}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Delete trip"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: EMBER + '18',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="Trash2" size={16} color={EMBER} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Trip header card */}
        <View
          style={{
            padding: 20,
            borderRadius: 22,
            backgroundColor: GOLD,
          }}>
          <Text style={{ fontSize: 44 }}>{trip.coverEmoji ?? '✈️'}</Text>
          <Text style={{ ...EYEBROW, color: IRON, opacity: 0.7, marginTop: 10 }}>
            DESTINATION
          </Text>
          <Text
            style={{
              marginTop: 4,
              color: IRON,
              fontSize: 28,
              fontWeight: '900',
              letterSpacing: -0.6,
            }}>
            {trip.title}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: IRON,
              opacity: 0.85,
              fontSize: 15,
              fontWeight: '700',
            }}>
            {trip.destination}
          </Text>
          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: IRON + '22',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="Calendar" size={13} color={IRON} />
              <Text style={{ color: IRON, fontSize: 12, fontWeight: '700' }}>
                {fmtDateRange(trip.startsAt, trip.endsAt)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="Users" size={13} color={IRON} />
              <Text style={{ color: IRON, fontSize: 12, fontWeight: '700' }}>
                {trip.travelerCount} {trip.travelerCount === 1 ? 'traveler' : 'travelers'}
              </Text>
            </View>
          </View>
          {trip.notes ? (
            <Text
              style={{
                marginTop: 12,
                color: IRON,
                opacity: 0.85,
                fontSize: 13,
                fontStyle: 'italic',
              }}>
              {trip.notes}
            </Text>
          ) : null}
        </View>

        {/* Itinerary */}
        <Text
          style={{
            marginTop: 24,
            ...EYEBROW,
            color: colors.text,
            opacity: 0.5,
          }}>
          ITINERARY · {days.length} {days.length === 1 ? 'DAY' : 'DAYS'}
        </Text>

        {days.map((day) => (
          <View
            key={day._id}
            style={{
              marginTop: 14,
              borderRadius: 18,
              backgroundColor: colors.text + '08',
              borderWidth: 1,
              borderColor: colors.text + '14',
              overflow: 'hidden',
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: SKY + '14',
              }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: SKY + '32',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                <Text style={{ color: SKY, fontWeight: '800', fontSize: 14 }}>
                  {day.dayIndex + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                  Day {day.dayIndex + 1}
                </Text>
                <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
                  {fmtDate(day.date)}
                </Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              {day.activities.length === 0 ? (
                <Text
                  style={{
                    color: colors.text,
                    opacity: 0.5,
                    fontSize: 13,
                    fontStyle: 'italic',
                    paddingVertical: 6,
                  }}>
                  Nothing planned yet.
                </Text>
              ) : (
                day.activities.map((a, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      paddingVertical: 8,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.text + '10',
                    }}>
                    <View style={{ width: 56 }}>
                      <Text
                        style={{
                          color: LIME,
                          fontWeight: '800',
                          fontSize: 12,
                          fontVariant: ['tabular-nums'],
                        }}>
                        {a.time || '—'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '700',
                          fontSize: 14,
                        }}>
                        {a.label}
                      </Text>
                      {a.location ? (
                        <Text
                          style={{
                            color: colors.text,
                            opacity: 0.6,
                            fontSize: 12,
                            marginTop: 2,
                          }}>
                          {a.location}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
              <Pressable
                onPress={() => openAddSheet(day.dayIndex)}
                accessibilityRole="button"
                accessibilityLabel={`Add activity to day ${day.dayIndex + 1}`}
                testID={`add-activity-day-${day.dayIndex}`}
                style={{
                  marginTop: 8,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}>
                <Icon name="Plus" size={13} color={colors.text + 'aa'} />
                <Text
                  style={{
                    color: colors.text,
                    opacity: 0.7,
                    fontSize: 12,
                    fontWeight: '700',
                  }}>
                  Add activity
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add activity sheet (inline panel above tab bar) */}
      {activeDay !== null ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingBottom: insets.bottom + 14,
            paddingTop: 14,
            paddingHorizontal: PAGE_X,
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: GOLD + '60',
          }}>
          <Text style={{ ...EYEBROW, color: GOLD }}>
            ADD TO DAY {activeDay + 1}
          </Text>
          <TextInput
            placeholder="What's the plan?"
            placeholderTextColor={colors.placeholder}
            value={activityLabel}
            onChangeText={setActivityLabel}
            autoFocus
            testID="activity-label-input"
            style={{
              marginTop: 8,
              color: colors.text,
              fontSize: 16,
              fontWeight: '700',
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: colors.text + '08',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TextInput
              placeholder="Time (e.g. 9:00)"
              placeholderTextColor={colors.placeholder}
              value={activityTime}
              onChangeText={setActivityTime}
              testID="activity-time-input"
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.text + '08',
              }}
            />
            <TextInput
              placeholder="Location"
              placeholderTextColor={colors.placeholder}
              value={activityLocation}
              onChangeText={setActivityLocation}
              testID="activity-location-input"
              style={{
                flex: 2,
                color: colors.text,
                fontSize: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.text + '08',
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Pressable
              onPress={() => setActiveDay(null)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.text + '10',
                alignItems: 'center',
              }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onSubmitActivity}
              disabled={submitting || !activityLabel.trim()}
              testID="activity-save-button"
              style={{
                flex: 2,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: GOLD,
                alignItems: 'center',
                opacity: submitting || !activityLabel.trim() ? 0.5 : 1,
              }}>
              <Text style={{ color: IRON, fontWeight: '800', fontSize: 13 }}>
                {submitting ? 'Saving…' : 'Add'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
