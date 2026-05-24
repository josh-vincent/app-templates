import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthHistory } from '@/app/hooks/useHealthHistory';
import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { getActivity } from '@/lib/activities';
import {
  type ActivitySuggestion,
  suggestionsForSummary,
} from '@/lib/activitySuggestions';
import { useMutation } from '@/lib/persona-convex';
import { EMBER, GOLD, IRON, LIME, SKY } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function OnboardingFirstBet() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [busy, setBusy] = useState(false);

  const { summary, isReady } = useHealthHistory();
  const suggestions = useMemo(() => suggestionsForSummary(summary), [summary]);
  const hasData = summary.totalDays > 0;

  async function pickSuggestion(s: ActivitySuggestion) {
    try {
      setBusy(true);
      await completeOnboarding({});
      router.replace({
        pathname: '/(tabs)/challenges/create',
        params: {
          activity: s.activityKey,
          goal: String(s.goal),
          stake: String(s.stakeAmount),
          days: String(s.durationDays),
        },
      } as any);
    } finally {
      setBusy(false);
    }
  }

  async function customPath() {
    try {
      setBusy(true);
      await completeOnboarding({});
      router.replace('/(tabs)/challenges/create' as any);
    } finally {
      setBusy(false);
    }
  }

  async function skipPath() {
    try {
      setBusy(true);
      await completeOnboarding({});
      router.replace('/(tabs)/(home)' as any);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 18,
        }}
        showsVerticalScrollIndicator={false}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>STEP 4 OF 4</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 30,
            fontWeight: '900',
            letterSpacing: -0.8,
            marginTop: 8,
            lineHeight: 36,
          }}>
          {hasData ? 'Pick a bet that fits.' : 'Place your first bet.'}
        </Text>
        <Text
          style={{
            color: colors.text,
            opacity: 0.65,
            fontSize: 15,
            marginTop: 12,
            lineHeight: 22,
          }}>
          {hasData
            ? `Based on your last 30 days — averaging ${summary.avgSteps.toLocaleString()} steps a day${
                summary.weeklyWorkouts > 0
                  ? `, ${summary.weeklyWorkouts} sessions a week`
                  : ''
              }${summary.weeklyRunKm >= 5 ? `, ${summary.weeklyRunKm}km of running` : ''}.`
            : 'Connect Apple Health on the last step and we tailor these. For now: three numbers and you’re staked.'}
        </Text>

        {/* Suggestion cards — first thing in eye line if we have data. */}
        <View style={{ marginTop: 22, gap: 12 }}>
          {suggestions.map((s, i) => (
            <SuggestionCard
              key={`${s.activityKey}-${i}`}
              suggestion={s}
              colors={colors}
              disabled={busy}
              onPress={() => pickSuggestion(s)}
              tone={i === 0 ? GOLD : i === 1 ? LIME : SKY}
            />
          ))}
        </View>

        <Text
          style={{
            ...EYEBROW,
            color: colors.text,
            opacity: 0.4,
            marginTop: 26,
            marginBottom: 8,
          }}>
          OR
        </Text>
        <Pressable
          onPress={customPath}
          disabled={busy}
          style={{
            height: 54,
            borderRadius: 16,
            backgroundColor: colors.text + '0c',
            borderWidth: 1,
            borderColor: colors.text + '14',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: busy ? 0.6 : 1,
          }}>
          <Icon name="Sliders" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>
            Build my own
          </Text>
        </Pressable>
        <Pressable
          onPress={skipPath}
          disabled={busy}
          style={{
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 4,
          }}>
          <Text style={{ color: colors.text, opacity: 0.55, fontWeight: '600', fontSize: 13 }}>
            Skip — explore first
          </Text>
        </Pressable>

        {/* Loading state if history is still resolving. Non-blocking — the
            user can still skip / build their own. */}
        {!isReady ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 18,
              opacity: 0.5,
            }}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 12 }}>
              Reading your last 30 days…
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SuggestionCard({
  suggestion,
  colors,
  onPress,
  disabled,
  tone,
}: {
  suggestion: ActivitySuggestion;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
  disabled?: boolean;
  tone: string;
}) {
  const activity = getActivity(suggestion.activityKey);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        padding: 16,
        borderRadius: 18,
        backgroundColor: tone + '0e',
        borderWidth: 1,
        borderColor: tone + '33',
        flexDirection: 'row',
        alignItems: 'center',
        opacity: disabled ? 0.55 : 1,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: tone + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}>
        <Icon name={activity.icon as any} size={20} color={tone} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
          {suggestion.title}
        </Text>
        <Text
          style={{
            color: colors.text,
            opacity: 0.6,
            fontSize: 12,
            marginTop: 3,
            lineHeight: 17,
          }}>
          {suggestion.reason}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            color: tone,
            fontSize: 22,
            fontWeight: '900',
            fontVariant: ['tabular-nums'],
          }}>
          ${suggestion.stakeAmount}
        </Text>
        <Icon name="ArrowRight" size={14} color={tone} />
      </View>
    </Pressable>
  );
}
