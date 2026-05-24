import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import {
  addWorkout,
  estimateCalories,
  type WorkoutIntensity,
  type WorkoutType,
} from '@/lib/workoutStore';
import { EMBER, GOLD, IRON, LIME, SKY } from '@/lib/theme';

const PAGE_X = 20;
const SECTION_GAP = 22;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const TYPES: { key: WorkoutType; icon: string; label: string }[] = [
  { key: 'Run', icon: 'Footprints', label: 'Run' },
  { key: 'Walk', icon: 'Footprints', label: 'Walk' },
  { key: 'Cycle', icon: 'Bike', label: 'Cycle' },
  { key: 'Strength', icon: 'Dumbbell', label: 'Strength' },
  { key: 'Yoga', icon: 'Sparkles', label: 'Yoga' },
  { key: 'Other', icon: 'Activity', label: 'Other' },
];

const INTENSITIES: { key: WorkoutIntensity; color: string }[] = [
  { key: 'Easy', color: LIME },
  { key: 'Moderate', color: GOLD },
  { key: 'Hard', color: EMBER },
];

const DURATION_PRESETS = [10, 15, 30, 45, 60];

export default function AddWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const [type, setType] = useState<WorkoutType>('Run');
  const [duration, setDuration] = useState<string>('30');
  const [intensity, setIntensity] = useState<WorkoutIntensity>('Moderate');
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const durationNum = useMemo(() => {
    const n = parseInt(duration, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [duration]);

  const calEst = useMemo(
    () => (durationNum > 0 ? estimateCalories(type, durationNum, intensity) : 0),
    [type, durationNum, intensity]
  );

  async function onSave() {
    setErrMsg(null);
    if (durationNum <= 0) {
      setErrMsg('Duration must be at least 1 minute.');
      return;
    }
    if (durationNum > 600) {
      setErrMsg('Duration must be under 10 hours.');
      return;
    }
    setSaving(true);
    try {
      await addWorkout({ type, durationMin: durationNum, intensity });
      // Navigate to the log so the user sees the new entry.
      router.replace('/(tabs)/workouts' as any);
    } catch (e: any) {
      setErrMsg(e?.message ?? 'Could not save the workout.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: 22 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>LOG</Text>
          <Text
            style={{
              marginTop: 4,
              color: colors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.6,
            }}>
            Add workout
          </Text>
        </View>

        {/* Type picker */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>TYPE</Text>
          <View
            style={{
              marginTop: 10,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
            }}>
            {TYPES.map((opt) => {
              const active = opt.key === type;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setType(opt.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Type: ${opt.label}`}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: active ? GOLD : colors.border,
                    backgroundColor: active ? GOLD + '18' : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                  <Icon
                    name={opt.icon as any}
                    size={16}
                    color={active ? GOLD : colors.text}
                  />
                  <Text
                    style={{
                      color: active ? GOLD : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Duration */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>DURATION (MIN)</Text>
          <TextInput
            value={duration}
            onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="30"
            placeholderTextColor={colors.placeholder}
            accessibilityLabel="Duration in minutes"
            style={{
              marginTop: 10,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              fontSize: 20,
              fontWeight: '700',
              color: colors.text,
              backgroundColor: colors.text + '06',
              fontVariant: ['tabular-nums'],
            }}
          />
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
            {DURATION_PRESETS.map((p) => {
              const active = String(p) === duration;
              return (
                <Pressable
                  key={p}
                  onPress={() => setDuration(String(p))}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: active ? SKY : colors.border,
                    backgroundColor: active ? SKY + '14' : 'transparent',
                    alignItems: 'center',
                  }}>
                  <Text
                    style={{
                      color: active ? SKY : colors.text,
                      fontWeight: '700',
                      fontVariant: ['tabular-nums'],
                    }}>
                    {p}m
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Intensity */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>INTENSITY</Text>
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
            {INTENSITIES.map((opt) => {
              const active = opt.key === intensity;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setIntensity(opt.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Intensity: ${opt.key}`}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: active ? opt.color : colors.border,
                    backgroundColor: active ? opt.color + '20' : 'transparent',
                    alignItems: 'center',
                  }}>
                  <Text
                    style={{
                      color: active ? opt.color : colors.text,
                      fontWeight: '800',
                      fontSize: 14,
                    }}>
                    {opt.key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Estimate card */}
        <View
          style={{
            marginTop: SECTION_GAP,
            padding: 18,
            borderRadius: 18,
            backgroundColor: GOLD + '10',
            borderWidth: 1,
            borderColor: GOLD + '40',
          }}>
          <Text style={{ ...EYEBROW, color: GOLD }}>EST. BURN</Text>
          <Text
            style={{
              marginTop: 4,
              color: colors.text,
              fontSize: 32,
              fontWeight: '800',
              letterSpacing: -0.8,
              fontVariant: ['tabular-nums'],
            }}>
            {calEst} <Text style={{ fontSize: 14, fontWeight: '700', opacity: 0.6 }}>cal</Text>
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: colors.text, opacity: 0.55 }}>
            {durationNum > 0 ? `${durationNum} min of ${type} · ${intensity}` : 'Add a duration to estimate'}
          </Text>
        </View>

        {errMsg ? (
          <View
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              backgroundColor: EMBER + '1c',
            }}>
            <Text style={{ color: EMBER, fontWeight: '700', fontSize: 13 }}>
              {errMsg}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save workout"
          style={{
            marginTop: SECTION_GAP,
            paddingVertical: 16,
            borderRadius: 18,
            backgroundColor: LIME,
            alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}>
          <Text style={{ color: IRON, fontWeight: '800', fontSize: 15 }}>
            {saving ? 'Saving…' : 'Save workout'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          disabled={saving}
          style={{
            marginTop: 10,
            paddingVertical: 14,
            alignItems: 'center',
          }}>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>
            Cancel
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
