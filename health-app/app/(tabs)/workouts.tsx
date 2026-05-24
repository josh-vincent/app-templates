import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { subscribe, type Workout } from '@/lib/workoutStore';
import { GOLD, IRON, LIME } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const ICON_FOR_TYPE: Record<string, string> = {
  Run: 'Footprints',
  Walk: 'Footprints',
  Cycle: 'Bike',
  Strength: 'Dumbbell',
  Yoga: 'Sparkles',
  Other: 'Activity',
};

function fmtDay(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function intensityColor(i: string): string {
  if (i === 'Hard') return '#ff7568';
  if (i === 'Moderate') return GOLD;
  return LIME;
}

// Group workouts by ISO day for a date-banded list.
function groupByDay(rows: Workout[]): { day: string; sample: number; items: Workout[] }[] {
  const map = new Map<string, { sample: number; items: Workout[] }>();
  for (const w of rows) {
    const d = new Date(w.loggedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(w);
    } else {
      map.set(key, { sample: w.loggedAt, items: [w] });
    }
  }
  return Array.from(map.entries())
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => b.sample - a.sample);
}

export default function WorkoutsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    return subscribe(setWorkouts);
  }, []);

  const grouped = useMemo(() => groupByDay(workouts), [workouts]);
  const totalMin = workouts.reduce((s, w) => s + w.durationMin, 0);
  const totalCal = workouts.reduce((s, w) => s + w.caloriesBurned, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 22 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>ACTIVITY LOG</Text>
          <Text
            style={{
              marginTop: 4,
              color: colors.text,
              fontSize: 28,
              fontWeight: '800',
              letterSpacing: -0.6,
            }}>
            Workouts
          </Text>
        </View>

        {/* Totals strip */}
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            gap: 12,
          }}>
          <View
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.text + '08',
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>TOTAL</Text>
            <Text
              style={{
                marginTop: 4,
                color: colors.text,
                fontSize: 22,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}>
              {workouts.length}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 11, color: colors.text, opacity: 0.55 }}>
              workouts
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.text + '08',
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>MINUTES</Text>
            <Text
              style={{
                marginTop: 4,
                color: colors.text,
                fontSize: 22,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}>
              {totalMin}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 11, color: colors.text, opacity: 0.55 }}>
              active
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.text + '08',
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>CALORIES</Text>
            <Text
              style={{
                marginTop: 4,
                color: colors.text,
                fontSize: 22,
                fontWeight: '800',
                fontVariant: ['tabular-nums'],
              }}>
              {totalCal.toLocaleString()}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 11, color: colors.text, opacity: 0.55 }}>
              burned
            </Text>
          </View>
        </View>

        {/* List */}
        {grouped.length === 0 ? (
          <Pressable
            onPress={() => router.push('/(tabs)/add' as any)}
            style={{
              marginTop: 22,
              padding: 18,
              borderRadius: 16,
              borderStyle: 'dashed',
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              No workouts yet.
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: colors.text, opacity: 0.6 }}>
              Tap Add to log your first one.
            </Text>
          </Pressable>
        ) : (
          grouped.map((group) => (
            <View key={group.day} style={{ marginTop: 22 }}>
              <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                {fmtDay(group.sample).toUpperCase()}
              </Text>
              <View style={{ marginTop: 4 }}>
                {group.items.map((w, i) => (
                  <View
                    key={w.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.text + '14',
                    }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        marginRight: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: intensityColor(w.intensity) + '22',
                      }}>
                      <Icon
                        name={(ICON_FOR_TYPE[w.type] as any) ?? 'Activity'}
                        size={18}
                        color={intensityColor(w.intensity)}
                      />
                    </View>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {w.type}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: colors.text,
                          opacity: 0.55,
                        }}>
                        {w.durationMin} min · {w.intensity} · {fmtTime(w.loggedAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '800',
                          color: GOLD,
                          fontVariant: ['tabular-nums'],
                        }}>
                        {w.caloriesBurned}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.text, opacity: 0.5 }}>
                        cal
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
