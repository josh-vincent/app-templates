import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { statsForToday, subscribe, type Workout } from '@/lib/workoutStore';
import { BONE, EMBER, GOLD, IRON, LIME, SKY } from '@/lib/theme';

// Layout tokens
const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

// Daily targets — pure mock numbers for the demo.
const STEP_GOAL = 10000;
const ACTIVE_MIN_GOAL = 30;
const CAL_GOAL = 600;

// Deterministic mock "steps today" — a value between 4k and 9.5k that's
// stable for a day so the screen doesn't bounce on re-renders.
function mockStepsToday(): number {
  const d = new Date();
  const seed =
    d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const pct = ((seed * 9301 + 49297) % 233280) / 233280; // 0..1
  return Math.round(4000 + pct * 5500);
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString();
}

function fmtWhen(t: number, nowMs: number = Date.now()): string {
  const diffMin = Math.max(0, Math.round((nowMs - t) / 60_000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return new Date(t).toLocaleDateString();
}

function StatRing({
  label,
  value,
  goal,
  accent,
  unit,
}: {
  label: string;
  value: number;
  goal: number;
  accent: string;
  unit?: string;
}) {
  const colors = useThemeColors();
  const pct = Math.min(1, goal > 0 ? value / goal : 0);
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: accent + '30',
      }}>
      <Text style={{ ...EYEBROW, color: accent }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 4,
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.8,
          fontVariant: ['tabular-nums'],
        }}>
        {fmtInt(value)}
        {unit ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, opacity: 0.55 }}>
            {' ' + unit}
          </Text>
        ) : null}
      </Text>
      <View
        style={{
          marginTop: 10,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.text + '12',
          overflow: 'hidden',
        }}>
        <View
          style={{
            height: 5,
            width: `${Math.max(3, pct * 100)}%`,
            backgroundColor: accent,
            borderRadius: 3,
          }}
        />
      </View>
      <Text
        style={{
          marginTop: 6,
          fontSize: 11,
          color: colors.text,
          opacity: 0.55,
          fontVariant: ['tabular-nums'],
        }}>
        {fmtInt(value)} / {fmtInt(goal)}
      </Text>
    </View>
  );
}

function ActivityRow({
  workout,
  isFirst,
  nowMs,
}: {
  workout: Workout;
  isFirst: boolean;
  nowMs: number;
}) {
  const colors = useThemeColors();
  const iconFor: Record<string, string> = {
    Run: 'Footprints',
    Walk: 'Footprints',
    Cycle: 'Bike',
    Strength: 'Dumbbell',
    Yoga: 'Sparkles',
    Other: 'Activity',
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
      }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          marginRight: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: LIME + '22',
        }}>
        <Icon name={(iconFor[workout.type] as any) ?? 'Activity'} size={18} color={LIME} />
      </View>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
          {workout.type}
        </Text>
        <Text
          numberOfLines={1}
          style={{ marginTop: 2, fontSize: 12, color: colors.text, opacity: 0.55 }}>
          {workout.durationMin} min · {workout.intensity} · {fmtWhen(workout.loggedAt, nowMs)}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '800',
          color: GOLD,
          fontVariant: ['tabular-nums'],
        }}>
        {workout.caloriesBurned} cal
      </Text>
    </View>
  );
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    return subscribe(setWorkouts);
  }, []);

  const nowMs = Date.now();
  const stats = useMemo(() => statsForToday(workouts), [workouts]);
  const steps = mockStepsToday();
  const recent = workouts.slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 22 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>HEALTHPULSE</Text>
          <Text
            style={{
              marginTop: 4,
              color: colors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.6,
            }}>
            Today
          </Text>
          <Text
            style={{
              marginTop: 4,
              color: colors.text,
              fontSize: 13,
              opacity: 0.6,
            }}>
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Steps hero */}
        <View
          style={{
            marginTop: SECTION_GAP,
            padding: 20,
            borderRadius: 22,
            backgroundColor: LIME,
          }}>
          <Text style={{ ...EYEBROW, color: IRON }}>STEPS</Text>
          <Text
            style={{
              marginTop: 6,
              color: IRON,
              fontSize: 52,
              fontWeight: '900',
              letterSpacing: -1.6,
              fontVariant: ['tabular-nums'],
            }}>
            {fmtInt(steps)}
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: IRON,
              opacity: 0.7,
              fontSize: 13,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}>
            Goal {fmtInt(STEP_GOAL)} · {Math.round((steps / STEP_GOAL) * 100)}%
          </Text>
          <View
            style={{
              marginTop: 14,
              height: 7,
              borderRadius: 4,
              backgroundColor: IRON + '22',
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: 7,
                width: `${Math.min(100, Math.max(3, (steps / STEP_GOAL) * 100))}%`,
                backgroundColor: IRON,
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        {/* Two-up stat tiles */}
        <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
          <StatRing
            label="ACTIVE MIN"
            value={stats.activeMinutes}
            goal={ACTIVE_MIN_GOAL}
            accent={SKY}
          />
          <StatRing
            label="CALORIES"
            value={stats.caloriesBurned}
            goal={CAL_GOAL}
            accent={GOLD}
            unit="cal"
          />
        </View>

        {/* Recent activity */}
        <View style={{ marginTop: SECTION_GAP }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
              RECENT · {workouts.length}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/workouts' as any)}
              accessibilityRole="link">
              <Text style={{ fontSize: 12, color: colors.text, opacity: 0.6 }}>
                See all
              </Text>
            </Pressable>
          </View>

          {recent.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              {recent.map((w, i) => (
                <ActivityRow key={w.id} workout={w} isFirst={i === 0} nowMs={nowMs} />
              ))}
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/add' as any)}
              style={{
                marginTop: 12,
                padding: 18,
                borderRadius: 16,
                borderStyle: 'dashed',
                borderWidth: 1,
                borderColor: colors.border,
              }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                No workouts logged yet.
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: colors.text, opacity: 0.6 }}>
                Tap Add to log your first one.
              </Text>
            </Pressable>
          )}
        </View>

        {/* Quick add CTA */}
        <Pressable
          onPress={() => router.push('/(tabs)/add' as any)}
          accessibilityRole="button"
          accessibilityLabel="Log a workout"
          style={{
            marginTop: SECTION_GAP,
            paddingVertical: 16,
            paddingHorizontal: 18,
            borderRadius: 18,
            backgroundColor: GOLD,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
          <Icon name="Plus" size={18} color={IRON} />
          <Text style={{ color: IRON, fontWeight: '800', fontSize: 15 }}>
            Log a workout
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
