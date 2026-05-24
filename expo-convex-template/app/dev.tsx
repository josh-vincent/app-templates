// Dev tools — gated behind __DEV__ in Profile so production builds never
// show the entry point. Single page so testing flows live in one place
// without cluttering Profile.
//
// What lives here:
//   - Persona switcher (None / Josh / Jeff)
//   - Reset dev session (signs out the anonymous user)
//   - Seed dev data (rebuilds players + bets + ledger from scratch)
//   - Moments preview (mascot states / streaks / activation / permissions)
//   - Demo · drama in 5 min (pool + live bets + scheduled payout)

import { useAuthActions } from '@convex-dev/auth/react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useDevPersona } from '@/contexts/DevPersonaContext';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { useCelebrations } from '@/lib/celebrations';
import { useMutation } from '@/lib/persona-convex';
import { EMBER, GOLD, LIME, SKY } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function DevScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { signOut } = useAuthActions();
  const { persona, setPersona } = useDevPersona();

  const seed = useMutation(api.seed.seedDevData);
  const seedDrama = useMutation(api.seed.seedFriendsPoolDrama);
  const [seeding, setSeeding] = useState(false);
  const [dramaPending, setDramaPending] = useState(false);
  const { showWon, showRunningOut, showStreak } = useCelebrations();

  // Each row triggers one full-screen modal in isolation so QA can scrub
  // visual states without waiting for a real bet to settle. Live triggers
  // (real wins, bets ending) reuse these same modals — this is just the
  // catalog.
  const uiStatePreviews: {
    title: string;
    hint: string;
    icon: string;
    tone: string;
    onPress: () => void;
  }[] = [
    {
      title: 'You won — bet',
      hint: 'Full-screen celebration · $20 stake refund',
      icon: 'Trophy',
      tone: LIME,
      onPress: () =>
        showWon({
          amount: 20,
          betTitle: 'Morning Steppers',
          source: 'bet',
          finalSteps: 10_840,
          goal: 10_000,
        }),
    },
    {
      title: 'You won — jackpot',
      hint: 'Big-money pool share win',
      icon: 'Sparkles',
      tone: GOLD,
      onPress: () =>
        showWon({
          amount: 145,
          betTitle: 'Weekly jackpot pool',
          source: 'jackpot',
        }),
    },
    {
      title: 'Running out · 4 hours',
      hint: 'Time-pressure warning · stake at risk',
      icon: 'Timer',
      tone: EMBER,
      onPress: () =>
        showRunningOut({
          betTitle: 'Weekend Warriors',
          hoursLeft: 4,
          shortReason: '6,080 steps to keep $20 alive',
          stakeAmount: 20,
        }),
    },
    {
      title: 'Running out · 24 hours',
      hint: 'Day-before nudge',
      icon: 'AlarmClock',
      tone: EMBER,
      onPress: () =>
        showRunningOut({
          betTitle: 'Holiday Hustle',
          hoursLeft: 24,
          shortReason: '12 sessions to go',
          stakeAmount: 25,
        }),
    },
    {
      title: 'Overtime',
      hint: 'Past deadline · settling now',
      icon: 'AlertOctagon',
      tone: EMBER,
      onPress: () =>
        showRunningOut({
          betTitle: 'Sunday Sweat',
          hoursLeft: 0,
          shortReason: 'Settling…',
          stakeAmount: 10,
        }),
    },
    {
      title: 'Streak day 7',
      hint: 'Consecutive-day momentum',
      icon: 'Flame',
      tone: GOLD,
      onPress: () => showStreak({ days: 7, betTitle: 'Morning Steppers' }),
    },
    {
      title: 'Streak day 30',
      hint: 'Championship pace celebration',
      icon: 'Crown',
      tone: GOLD,
      onPress: () => showStreak({ days: 30, betTitle: 'No Days Off' }),
    },
    {
      title: 'Streak day 90',
      hint: 'Season dominance celebration',
      icon: 'BadgeCheck',
      tone: GOLD,
      onPress: () => showStreak({ days: 90, betTitle: 'Top Board Run' }),
    },
  ];

  async function onResetSession() {
    try {
      await signOut();
    } catch (e) {
      console.warn('[reset]', e);
    }
  }

  async function onSeed() {
    try {
      setSeeding(true);
      const result = await seed();
      Alert.alert(
        'Seed loaded',
        `${result.fakePlayers} players · ${
          result.challenges.settled + result.challenges.running + result.challenges.open
        } challenges · ${result.transactions} txs`
      );
    } catch (e: any) {
      Alert.alert('Seed failed', e?.message ?? String(e));
    } finally {
      setSeeding(false);
    }
  }

  async function onDrama() {
    try {
      setDramaPending(true);
      const result = await seedDrama();
      Alert.alert(
        'Drama loaded',
        `Friends pool seeded for both personas. ${result.dramaBets} live bets, pool pays out in ${Math.round(
          result.settlesInSec / 60
        )} minutes.`
      );
    } catch (e: any) {
      Alert.alert('Drama failed', e?.message ?? String(e));
    } finally {
      setDramaPending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}>
          <Icon name="ChevronLeft" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>
          DEV TOOLS
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}>
        <Section title="PERSONA" colors={colors}>
          <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 8 }}>
            <PersonaChip
              label="None"
              active={persona === null}
              onPress={() => setPersona(null)}
              colors={colors}
            />
            <PersonaChip
              label="Josh"
              active={persona === 'josh'}
              onPress={() => setPersona('josh')}
              colors={colors}
              accent={SKY}
            />
            <PersonaChip
              label="Jeff"
              active={persona === 'jeff'}
              onPress={() => setPersona('jeff')}
              colors={colors}
              accent={LIME}
            />
          </View>
          <Text
            style={{
              color: colors.text,
              opacity: 0.5,
              fontSize: 12,
              marginTop: 4,
              lineHeight: 16,
            }}>
            Per-device persona. Pick Josh on one simulator and Jeff on the
            other to test multi-user flows. Switches identity instantly — no
            reload needed.
          </Text>
        </Section>

        <Section title="DATA" colors={colors}>
          <Row
            colors={colors}
            icon="Database"
            iconColor={GOLD}
            title={seeding ? 'Seeding…' : 'Seed dev data'}
            hint="Wipes + reloads players, challenges, jackpot, ledger"
            onPress={seeding ? undefined : onSeed}
            isFirst
          />
          <Row
            colors={colors}
            icon="Timer"
            iconColor={GOLD}
            title={dramaPending ? 'Loading drama…' : 'Demo · drama in 5 min'}
            hint="Seeds friends pool + 3 live bets that resolve in minutes"
            onPress={dramaPending ? undefined : onDrama}
          />
        </Section>

        <Section title="PREVIEW" colors={colors}>
          <Row
            colors={colors}
            icon="Sparkles"
            iconColor={GOLD}
            title="Moments preview"
            hint="All mascot states, streaks, activation, and permissions"
            onPress={() => router.push('/moments-preview' as any)}
            isFirst
          />
        </Section>

        <Section title="UI STATES" colors={colors}>
          {uiStatePreviews.map((p, i) => (
            <Row
              key={p.title}
              colors={colors}
              icon={p.icon}
              iconColor={p.tone}
              title={p.title}
              hint={p.hint}
              onPress={p.onPress}
              isFirst={i === 0}
            />
          ))}
          <Text
            style={{
              color: colors.text,
              opacity: 0.4,
              fontSize: 11,
              marginTop: 8,
            }}>
            Tap any row to render that modal in isolation. Live triggers
            (real wins, bets ending) reuse the same modals.
          </Text>
        </Section>

        <Section title="SESSION" colors={colors}>
          <Row
            colors={colors}
            icon="RefreshCcw"
            iconColor={EMBER}
            title="Reset dev session"
            hint="Clears anonymous user; a new one is created on reload"
            onPress={onResetSession}
            isFirst
          />
        </Section>
      </ScrollView>
    </View>
  );
}

// ---- Local helpers (mirrors of profile.tsx — kept inline to avoid a
//      shared-component file just for two screens).

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useThemeColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginBottom: 4 }}>
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function Row({
  colors,
  icon,
  iconColor,
  title,
  hint,
  onPress,
  isFirst,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: string;
  iconColor: string;
  title: string;
  hint: string;
  onPress?: () => void;
  isFirst?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
        opacity: !onPress ? 0.55 : 1,
      }}>
      <View style={{ width: 28, alignItems: 'center', marginRight: 12 }}>
        <Icon name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
          {title}
        </Text>
        <Text style={{ color: colors.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>
          {hint}
        </Text>
      </View>
      {onPress ? <Icon name="ChevronRight" size={16} color={colors.text} /> : null}
    </Pressable>
  );
}

function PersonaChip({
  label,
  active,
  onPress,
  colors,
  accent,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  accent?: string;
}) {
  const bg = active ? (accent ?? colors.text) : colors.text + '0d';
  const fg = active ? '#0d1014' : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: active ? bg : colors.text + '14',
        backgroundColor: bg,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
      }}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
