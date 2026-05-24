import { useConvexAuth } from 'convex/react';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFitStakeProGate } from '@/app/hooks/useFitStakeProGate';
import { useHealthSteps } from '@/app/hooks/useHealthSteps';
import Icon from '@jv/ui';
import ThemeToggle from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { EMBER, GOLD, LIME } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const auth = useConvexAuth();
  const me = useQuery(api.users.me);
  const health = useHealthSteps();
  const pro = useFitStakeProGate();
  const [restoring, setRestoring] = useState(false);

  async function onUpgrade() {
    try {
      await pro.presentPaywall();
    } catch (e) {
      console.warn('[paywall] failed', e);
    }
  }

  async function onManageSubscription() {
    try {
      await pro.presentCustomerCenter();
    } catch (e) {
      console.warn('[customer-center] failed', e);
    }
  }

  async function onRestore() {
    try {
      setRestoring(true);
      const info = await pro.restorePurchases();
      if (info && info.entitlements.active['fitStake Pro']) {
        Alert.alert('Restored', 'Your fitStake Pro subscription is active.');
      } else {
        Alert.alert('Nothing to restore', 'No previous purchases were found on this account.');
      }
    } finally {
      setRestoring(false);
    }
  }

  // pushEnabled defaults to true server-side when undefined.
  const pushEnabled = me?.pushEnabled !== false;
  const hasCustomLeads = (me?.notifyLeadHours ?? null) != null;
  const customLeadsMuted = hasCustomLeads && (me?.notifyLeadHours ?? []).length === 0;
  const notificationsHint = !pushEnabled
    ? 'Off · tap to enable'
    : customLeadsMuted
      ? 'On · all reminders muted'
      : hasCustomLeads
        ? 'On · custom reminder schedule'
        : 'On · smart defaults';

  const initials = (me?.displayName ?? 'A')[0]?.toUpperCase() ?? '?';
  const won = me?.totalWon ?? 0;
  const lost = me?.totalForfeited ?? 0;
  const net = won - lost;
  // Win rate is dollar-weighted: share of staked $ that came back. It's the
  // identity-level signal Wallet doesn't carry — Wallet shows the money,
  // Profile shows the record.
  const stakedTotal = won + lost;
  const winRate = stakedTotal > 0 ? Math.round((won / stakedTotal) * 100) : null;
  const winRateTone = winRate == null ? colors.text : winRate >= 50 ? LIME : EMBER;

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

        {/* Identity row — initial chip + name + handle */}
        <Image
          source={net >= 0 ? SCENARIO_MASCOTS.betWon : SCENARIO_MASCOTS.betForfeit}
          resizeMode="cover"
          style={{
            width: '100%',
            height: 148,
            borderRadius: 18,
            marginTop: 14,
            marginBottom: 18,
            backgroundColor: colors.text + '10',
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: GOLD,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: '#0d1014', fontSize: 22, fontWeight: '800' }}>{initials}</Text>
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: 24,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}>
              {me?.displayName ?? 'Anonymous'}
            </Text>
            <Text
              style={{
                color: colors.text,
                opacity: 0.5,
                fontSize: 12,
              }}>
              {auth.isAuthenticated ? 'Signed in' : 'Anonymous · v0 testing'}
            </Text>
          </View>
        </View>

        {/* Record — identity-level stat (win rate), distinct from Wallet's
            dollars. Dollar deltas live in Wallet so we don't duplicate. */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>RECORD</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
            <Text
              style={{
                color: winRateTone,
                fontSize: 56,
                fontWeight: '800',
                letterSpacing: -2,
                fontVariant: ['tabular-nums'],
              }}>
              {winRate == null ? '—' : `${winRate}%`}
            </Text>
            <Text
              style={{
                marginLeft: 10,
                color: colors.text,
                opacity: 0.55,
                fontSize: 13,
              }}>
              win rate
            </Text>
          </View>
          <Text
            style={{
              marginTop: 4,
              color: colors.text,
              opacity: 0.55,
              fontSize: 12,
            }}>
            {stakedTotal === 0
              ? 'No settled bets yet.'
              : `Net ${net >= 0 ? '+' : '−'}$${Math.abs(net)} across $${stakedTotal} staked.`}
          </Text>
        </View>

        {!pro.isPro ? (
          <ProUpgradeCard colors={colors} onUpgrade={onUpgrade} />
        ) : null}

        <Section title="SUBSCRIPTION" colors={colors}>
          {pro.isPro ? (
            <Row
              colors={colors}
              icon="BadgeCheck"
              iconColor={LIME}
              title="fitStake Pro · Active"
              hint="Tap to manage, switch plan, or view billing"
              onPress={onManageSubscription}
              isFirst
            />
          ) : null}
          <Row
            colors={colors}
            icon="RotateCcw"
            iconColor={colors.text}
            title={restoring ? 'Restoring…' : 'Restore purchases'}
            hint="Already paid on another device? Restore here."
            onPress={restoring ? undefined : onRestore}
            isFirst={pro.isPro ? false : true}
          />
        </Section>

        <Section title="HEALTH" colors={colors}>
          <Row
            colors={colors}
            icon="HeartPulse"
            iconColor={health.hasPermission ? LIME : EMBER}
            title="Activity sensor"
            hint={
              health.hasPermission
                ? `Connected · ${health.steps.toLocaleString()} steps today`
                : 'Tap to grant step access (HealthKit / Health Connect)'
            }
            onPress={() => health.requestPermission()}
            isFirst
          />
        </Section>

        <Section title="ACCOUNT" colors={colors}>
          <Row
            colors={colors}
            icon="Wallet"
            iconColor={GOLD}
            title="Wallet"
            hint={`$${me?.walletBalance ?? 0} virtual balance`}
            onPress={() => router.push('/(tabs)/wallet')}
            isFirst
          />
          <Row
            colors={colors}
            icon="AtSign"
            iconColor={me?.username ? GOLD : EMBER}
            title={me?.username ? `@${me.username}` : 'Pick a username'}
            hint={
              me?.username
                ? 'Tap to change · friends find you by handle'
                : 'Required for friends to find you'
            }
            onPress={() => router.push('/onboarding/username' as any)}
          />
          <Row
            colors={colors}
            icon="MapPin"
            iconColor={me?.countryCode ? LIME : colors.text}
            title={me?.countryCode ? `Region · ${me.countryCode}` : 'Set your region'}
            hint={
              me?.countryCode ? 'Used for regional jackpot eligibility' : 'Tap to use your location'
            }
            onPress={() => router.push('/onboarding/region' as any)}
          />
          <Row
            colors={colors}
            icon="Users"
            iconColor={colors.text}
            title="Friends"
            hint="Head-to-head opponents and invites"
            onPress={() => router.push('/friends' as any)}
          />
          <Row
            colors={colors}
            icon="Bell"
            iconColor={pushEnabled ? LIME : colors.text}
            title="Notifications"
            hint={notificationsHint}
            onPress={() => router.push('/notifications' as any)}
          />
          <Row
            colors={colors}
            icon="LogIn"
            iconColor={colors.text}
            title={auth.isAuthenticated ? 'Linked Apple sign-in' : 'Upgrade to Apple sign-in'}
            hint={
              auth.isAuthenticated
                ? 'Link this device to an Apple account'
                : 'Sign in to recover this wallet on a new device'
            }
            onPress={() => router.push('/(auth)/sign-in')}
          />
        </Section>

        <ForfeitDestinationSection
          colors={colors}
          current={me?.forfeitDestination ?? null}
          countryCode={me?.countryCode ?? null}
        />

        <Pressable
          // Long-press the footer to reach Dev tools. Hidden from casual
          // browsers; reachable to anyone who knows. Dev-builds only.
          onLongPress={
            __DEV__ ? () => router.push('/dev' as any) : undefined
          }
          delayLongPress={600}>
          <Text
            style={{
              marginTop: SECTION_GAP,
              textAlign: 'center',
              color: colors.text,
              opacity: 0.35,
              fontSize: 11,
            }}>
            FitStake v0.1 · virtual balance · App Store testing only
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ProUpgradeCard({
  colors,
  onUpgrade,
}: {
  colors: ReturnType<typeof useThemeColors>;
  onUpgrade: () => void;
}) {
  return (
    <Pressable
      onPress={onUpgrade}
      accessibilityRole="button"
      accessibilityLabel="Upgrade to fitStake Pro"
      style={{
        marginTop: SECTION_GAP,
        backgroundColor: GOLD,
        borderRadius: 20,
        paddingVertical: 18,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(13,16,20,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}>
        <Icon name="Sparkles" size={20} color="#0d1014" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...EYEBROW, color: '#0d1014', opacity: 0.65 }}>
          UNLOCK
        </Text>
        <Text
          style={{
            marginTop: 2,
            color: '#0d1014',
            fontSize: 20,
            fontWeight: '900',
            letterSpacing: -0.6,
          }}>
          fitStake Pro
        </Text>
        <Text
          style={{
            marginTop: 2,
            color: '#0d1014',
            opacity: 0.7,
            fontSize: 12,
          }}>
          Bigger stakes, deeper history, naysayer multipliers.
        </Text>
      </View>
      <Icon name="ChevronRight" size={20} color="#0d1014" />
    </Pressable>
  );
}

function ForfeitDestinationSection({
  colors,
  current,
  countryCode,
}: {
  colors: ReturnType<typeof useThemeColors>;
  current: 'friends' | 'region' | 'global' | null;
  countryCode: string | null;
}) {
  const setForfeitDestination = useMutation(api.users.setForfeitDestination);
  const [busy, setBusy] = useState(false);

  async function pick(value: 'friends' | 'region' | 'global' | null) {
    try {
      setBusy(true);
      await setForfeitDestination({ destination: value });
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const options: {
    key: 'friends' | 'region' | 'global';
    title: string;
    sub: string;
    disabled?: boolean;
  }[] = [
    {
      key: 'friends',
      title: 'Friends pool',
      sub: 'Your failures fund your friend graph. Stays close.',
    },
    {
      key: 'region',
      title: countryCode ? `Region · ${countryCode}` : 'Region',
      sub: countryCode
        ? `Goes to the ${countryCode} country pool.`
        : 'Set your region first to enable.',
      disabled: !countryCode,
    },
    {
      key: 'global',
      title: 'Global',
      sub: 'Everyone, everywhere. Largest pool, lowest share.',
    },
  ];

  const activeKey = current ?? null;
  const activeSub = options.find((o) => o.key === activeKey)?.sub;
  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginBottom: 10 }}>
        WHEN YOU FORFEIT
      </Text>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.text + '0d',
          borderRadius: 12,
          padding: 4,
        }}>
        {options.map((opt) => {
          const active = activeKey === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => !opt.disabled && !busy && pick(opt.key)}
              disabled={opt.disabled || busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 9,
                backgroundColor: active ? GOLD : 'transparent',
                alignItems: 'center',
                opacity: opt.disabled ? 0.4 : 1,
              }}>
              <Text
                numberOfLines={1}
                style={{
                  color: active ? '#0d1014' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}>
                {opt.key === 'region' && countryCode ? countryCode : opt.title.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        style={{
          marginTop: 10,
          color: colors.text,
          opacity: 0.55,
          fontSize: 12,
          lineHeight: 17,
        }}>
        {activeSub ??
          'Smart default: friends if you have any, else region, else global.'}
      </Text>
      {current ? (
        <Pressable
          onPress={() => pick(null)}
          disabled={busy}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Text style={{ color: colors.text, opacity: 0.5, fontSize: 12 }}>
            Reset to smart default
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}


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
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginBottom: 4 }}>{title}</Text>
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
  disabled,
  isFirst,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: string;
  iconColor: string;
  title: string;
  hint: string;
  onPress?: () => void;
  disabled?: boolean;
  isFirst?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
        opacity: disabled ? 0.55 : 1,
      }}>
      <View style={{ width: 28, alignItems: 'center', marginRight: 12 }}>
        <Icon name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>{hint}</Text>
      </View>
      {onPress && !disabled ? <Icon name="ChevronRight" size={16} color={colors.text} /> : null}
    </Pressable>
  );
}

