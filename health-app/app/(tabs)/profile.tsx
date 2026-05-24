import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { useThemeColors } from '@/contexts/ThemeColors';
import { subscribe, type Workout } from '@/lib/workoutStore';
import { EMBER, GOLD, LIME, SKY } from '@/lib/theme';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

function Row({
  colors,
  icon,
  iconColor,
  title,
  hint,
  isFirst,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: string;
  iconColor: string;
  title: string;
  hint: string;
  isFirst?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
      }}>
      <View style={{ width: 28, alignItems: 'center', marginRight: 12 }}>
        <Icon name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
          {title}
        </Text>
        <Text
          style={{ color: colors.text, opacity: 0.55, fontSize: 12, marginTop: 2 }}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    return subscribe(setWorkouts);
  }, []);

  // Lifetime stats — totals across the local log.
  const stats = useMemo(() => {
    let totalMin = 0;
    let totalCal = 0;
    const seenDays = new Set<string>();
    for (const w of workouts) {
      totalMin += w.durationMin;
      totalCal += w.caloriesBurned;
      const d = new Date(w.loggedAt);
      seenDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return {
      total: workouts.length,
      minutes: totalMin,
      calories: totalCal,
      days: seenDays.size,
    };
  }, [workouts]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
          }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>PROFILE</Text>
          <ThemeToggle accessibilityLabel="Toggle color theme" />
        </View>

        {/* Identity */}
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: LIME,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#0d1014', fontSize: 24, fontWeight: '800' }}>
              H
            </Text>
          </View>
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}>
              You
            </Text>
            <Text
              style={{
                color: colors.text,
                opacity: 0.55,
                fontSize: 13,
                marginTop: 2,
              }}>
              HealthPulse member
            </Text>
          </View>
        </View>

        {/* Lifetime panel */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>LIFETIME</Text>
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: LIME + '14',
                borderWidth: 1,
                borderColor: LIME + '30',
              }}>
              <Text style={{ ...EYEBROW, color: LIME }}>WORKOUTS</Text>
              <Text
                style={{
                  marginTop: 4,
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}>
                {stats.total}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: SKY + '14',
                borderWidth: 1,
                borderColor: SKY + '30',
              }}>
              <Text style={{ ...EYEBROW, color: SKY }}>MINUTES</Text>
              <Text
                style={{
                  marginTop: 4,
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}>
                {stats.minutes}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: GOLD + '14',
                borderWidth: 1,
                borderColor: GOLD + '30',
              }}>
              <Text style={{ ...EYEBROW, color: GOLD }}>CAL</Text>
              <Text
                style={{
                  marginTop: 4,
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}>
                {stats.calories.toLocaleString()}
              </Text>
            </View>
          </View>
          <Text
            style={{
              marginTop: 12,
              fontSize: 12,
              color: colors.text,
              opacity: 0.55,
            }}>
            Active on {stats.days} day{stats.days === 1 ? '' : 's'}
          </Text>
        </View>

        {/* About / settings rows */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Text
            style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginBottom: 4 }}>
            ABOUT
          </Text>
          <Row
            colors={colors}
            icon="Activity"
            iconColor={LIME}
            title="HealthPulse"
            hint="A simple health & fitness tracker"
            isFirst
          />
          <Row
            colors={colors}
            icon="HeartPulse"
            iconColor={EMBER}
            title="Mock data mode"
            hint="Step count is simulated for this demo build"
          />
          <Row
            colors={colors}
            icon="Tag"
            iconColor={GOLD}
            title="Version"
            hint="0.1.0 · demo"
          />
        </View>

        <Text
          style={{
            marginTop: SECTION_GAP,
            textAlign: 'center',
            color: colors.text,
            opacity: 0.35,
            fontSize: 11,
          }}>
          HealthPulse v0.1 · local-only demo
        </Text>
      </ScrollView>
    </View>
  );
}
