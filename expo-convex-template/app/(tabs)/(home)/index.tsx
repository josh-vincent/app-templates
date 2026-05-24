import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthSteps } from '@/app/hooks/useHealthSteps';
import Icon from '@jv/ui';
import { PaceRing } from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { formatGoal, getActivity } from '@/lib/activities';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

// Layout tokens — kept inline. Lift into a shared file once they multiply.
const PAGE_X = 20;
const SECTION_GAP = 28;
const ROW_GAP = 14;
const HERO_NUMBER = 48;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
const fmtSteps = (n: number) => Math.round(n).toLocaleString();
const todayKey = () => new Date().toISOString().slice(0, 10);

// Format remaining time. Under 60 minutes the demo wants second-level
// resolution ("4:32") so the countdown reads as live. Above 1h, hours/days.
function fmtEndsIn(endsAt: number, nowMs: number = Date.now()): string {
  const ms = endsAt - nowMs;
  if (ms <= 0) return 'overtime';
  const sec = Math.ceil(ms / 1000);
  if (sec < 60 * 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const hours = ms / 3_600_000;
  if (hours < 24) return `${Math.round(hours)}h`;
  // Round to whole hours first so the day boundary doesn't show "6d 24h".
  const totalHours = Math.round(hours);
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours - days * 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

// Re-render every `intervalMs` ms so countdowns tick live. Returns the
// current epoch ms — pass it into fmtEndsIn so each render uses the same
// reference time and the displayed countdown can't "stutter".
function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useTweenedNumber(target: number, durationMs = 600) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === value) return;
    fromRef.current = value;
    startRef.current = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - t, 4);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);
  return value;
}

type Settlement = {
  participantId: string;
  status: 'won' | 'forfeit';
  stakeAmount: number;
  finalSteps: number | null;
  challengeTitle: string;
  stepGoal: number;
  endsAt: number;
};

function summariseSettlements(rows: Settlement[]) {
  if (rows.length === 0) return null;
  const won = rows.filter((r) => r.status === 'won');
  const lost = rows.filter((r) => r.status === 'forfeit');
  const wonAmount = won.reduce((s, r) => s + r.stakeAmount, 0);
  const lostAmount = lost.reduce((s, r) => s + r.stakeAmount, 0);
  if (lostAmount >= wonAmount && lost.length > 0) {
    return {
      kind: 'forfeit' as const,
      amount: lostAmount,
      count: lost.length,
      sample: lost[0],
    };
  }
  return {
    kind: 'won' as const,
    amount: wonAmount,
    count: won.length,
    sample: won[0],
  };
}

function YesterdayStrip({
  summary,
  onDismiss,
}: {
  summary: NonNullable<ReturnType<typeof summariseSettlements>>;
  onDismiss: () => void;
}) {
  const won = summary.kind === 'won';
  const accent = won ? LIME : EMBER;
  const sub =
    summary.count > 1
      ? `Across ${summary.count} ${won ? 'stakes' : 'forfeits'}`
      : won
        ? `${summary.sample.challengeTitle} · ${
            summary.sample.finalSteps?.toLocaleString() ?? '—'
          } steps`
        : `Goal ${summary.sample.stepGoal.toLocaleString()}, finished ${
            summary.sample.finalSteps?.toLocaleString() ?? '—'
          }`;
  return (
    <View
      style={{
        marginTop: 14,
        paddingVertical: 12,
        paddingLeft: 18,
        paddingRight: 8,
        backgroundColor: accent + '1f',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...EYEBROW, color: accent }}>YESTERDAY</Text>
        <Text
          style={{
            color: accent,
            fontSize: 22,
            fontWeight: '800',
            letterSpacing: -0.4,
            marginTop: 2,
          }}>
          {won ? `WON +${fmtMoney(summary.amount)}` : `FORFEIT −${fmtMoney(summary.amount)}`}
        </Text>
        <Text
          numberOfLines={1}
          style={{ marginTop: 1, fontSize: 12, color: accent, opacity: 0.75 }}>
          {sub}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Dismiss yesterday's result"
        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        <Icon name="X" size={16} color={accent} />
      </Pressable>
    </View>
  );
}

function HealthBlocker({ onGrant }: { onGrant: () => void }) {
  return (
    <Pressable
      onPress={onGrant}
      style={{
        marginTop: SECTION_GAP,
        padding: 20,
        borderRadius: 18,
        backgroundColor: EMBER + '14',
        borderWidth: 1,
        borderColor: EMBER + '40',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="HeartPulse" size={18} color={EMBER} />
        <Text style={{ ...EYEBROW, color: EMBER }}>HEALTH ACCESS NEEDED</Text>
      </View>
      <Text
        style={{
          marginTop: 10,
          fontSize: 22,
          fontWeight: '800',
          color: EMBER,
          letterSpacing: -0.4,
        }}>
        FitStake counts your steps from Health.
      </Text>
      <Text style={{ marginTop: 6, fontSize: 13, color: EMBER, opacity: 0.85 }}>
        Without it your stakes can&apos;t settle. Tap to grant access.
      </Text>
    </Pressable>
  );
}

// -------------------- Friends Pool gold hero --------------------

function fmtPct(fraction: number) {
  const p = fraction * 100;
  if (p >= 10) return `${Math.round(p)}%`;
  if (p >= 1) return `${p.toFixed(1)}%`;
  return `${p.toFixed(2)}%`;
}

function FriendsPoolHero({
  total,
  settlesAt,
  contributorCount,
  eligibleWinners,
  playersCount,
  myShare,
  mySharePct,
  amIEligible,
  nowMs,
}: {
  total: number;
  settlesAt: number;
  contributorCount: number;
  eligibleWinners: number;
  playersCount: number;
  myShare: number | null;
  mySharePct: number | null;
  amIEligible: boolean;
  nowMs: number;
}) {
  const settling = settlesAt - nowMs <= 60_000 && settlesAt - nowMs > -60_000;
  const overtime = settlesAt - nowMs < -1_000;
  const closeTo = settlesAt - nowMs <= 60 * 60_000;
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/jackpot' as any)}
      accessibilityRole="button"
      accessibilityLabel={`Friends pool ${fmtMoney(total)}, settles in ${fmtEndsIn(
        settlesAt,
        nowMs
      )}`}
      style={{
        marginTop: SECTION_GAP,
        backgroundColor: GOLD,
        borderRadius: 22,
        paddingVertical: 18,
        paddingHorizontal: 22,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="Trophy" size={13} color={IRON} />
            <Text style={{ ...EYEBROW, color: IRON }}>FRIENDS POOL</Text>
            {settling || overtime ? (
              <View
                style={{
                  marginLeft: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: IRON,
                }}>
                <Text style={{ color: GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>
                  {overtime ? 'PAYING OUT' : 'CLOSING'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{
              marginTop: 4,
              color: IRON,
              fontSize: 36,
              fontWeight: '900',
              letterSpacing: -1.2,
              fontVariant: ['tabular-nums'],
            }}>
            {fmtMoney(total)}
          </Text>
          <Text style={{ marginTop: 1, color: IRON, opacity: 0.7, fontSize: 12 }}>
            settles in{' '}
            <Text style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {fmtEndsIn(settlesAt, nowMs)}
            </Text>
            {closeTo ? '' : contributorCount > 0 ? ` · ${contributorCount} feeding it` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', paddingLeft: 12 }}>
          <Text style={{ ...EYEBROW, color: IRON, opacity: 0.65 }}>YOUR SHARE</Text>
          <Text
            style={{
              marginTop: 4,
              color: IRON,
              fontSize: 26,
              fontWeight: '900',
              letterSpacing: -0.6,
              fontVariant: ['tabular-nums'],
            }}>
            {amIEligible && mySharePct != null ? fmtPct(mySharePct) : '—'}
          </Text>
          <Text style={{ marginTop: 1, color: IRON, opacity: 0.7, fontSize: 11, fontVariant: ['tabular-nums'] }}>
            {amIEligible && myShare != null
              ? `~${fmtMoney(myShare)} now`
              : eligibleWinners > 0
                ? 'Win 3 to qualify'
                : 'No winners yet'}
          </Text>
        </View>
      </View>

      {/* Players strip — shows the audience size at a glance */}
      {playersCount > 0 ? (
        <View
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: IRON + '24',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Text style={{ color: IRON, opacity: 0.75, fontSize: 11, fontWeight: '700' }}>
            {playersCount} player{playersCount === 1 ? '' : 's'} ·{' '}
            {eligibleWinners} eligible to share
          </Text>
          <Icon name="ChevronRight" size={16} color={IRON} />
        </View>
      ) : null}
    </Pressable>
  );
}

// -------------------- Friends-in-motion live cards --------------------

type LiveRow = {
  challengeId: string;
  title: string;
  activityKey: string;
  betShape: 'solo' | 'h2h' | 'market' | 'naysayer';
  subjectUserId: string;
  subjectDisplayName: string | null;
  subjectUsername: string | null;
  stakeAmount: number;
  stepGoal: number;
  startsAt: number;
  endsAt: number;
  progress: number | null;
  pace: 'ahead' | 'on_pace' | 'behind' | null;
  iAlreadyStaked: boolean;
  canTakeUnder: boolean;
};

function paceColor(pace: LiveRow['pace']) {
  if (pace === 'ahead') return LIME;
  if (pace === 'behind') return EMBER;
  return GOLD;
}

function paceLabel(pace: LiveRow['pace']) {
  if (pace === 'ahead') return 'AHEAD';
  if (pace === 'behind') return 'BEHIND';
  if (pace === 'on_pace') return 'ON PACE';
  return 'IN PROGRESS';
}

function FriendInMotionCard({
  row,
  colors,
  nowMs,
  onTakeUnder,
}: {
  row: LiveRow;
  colors: ReturnType<typeof useThemeColors>;
  nowMs: number;
  onTakeUnder: (row: LiveRow) => void;
}) {
  const activity = getActivity(row.activityKey);
  const accent = paceColor(row.pace);
  const display =
    row.subjectDisplayName ??
    (row.subjectUsername ? `@${row.subjectUsername}` : 'A friend');
  const initial = (display.replace(/^@/, '')[0] ?? '?').toUpperCase();
  const ratio =
    row.progress != null && row.stepGoal > 0 ? row.progress / row.stepGoal : 0;
  const subline =
    row.progress != null
      ? `${fmtSteps(row.progress)} / ${fmtSteps(row.stepGoal)} ${activity.unit}`
      : formatGoal(activity, row.stepGoal);

  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 18,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: GOLD + '20',
        overflow: 'hidden',
      }}>
      <Pressable
        onPress={() => router.push(`/(tabs)/challenges/${row.challengeId}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${display}'s ${row.title}`}
        style={{ paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: accent + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: accent, fontWeight: '800', fontSize: 15 }}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
              {display}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.text, opacity: 0.6, fontSize: 12, marginTop: 1 }}>
              {row.title}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ ...EYEBROW, color: accent }}>{paceLabel(row.pace)}</Text>
            <Text
              style={{
                color:
                  row.endsAt - nowMs < 5 * 60_000 ? EMBER : colors.text,
                opacity:
                  row.endsAt - nowMs < 5 * 60_000 ? 0.95 : 0.55,
                fontWeight: row.endsAt - nowMs < 5 * 60_000 ? '800' : '500',
                fontSize: 12,
                marginTop: 2,
                fontVariant: ['tabular-nums'],
              }}>
              {fmtEndsIn(row.endsAt, nowMs)} left
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ marginTop: 12, position: 'relative' }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.text,
              opacity: 0.08,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: 6,
              borderRadius: 3,
              width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
              backgroundColor: accent,
            }}
          />
        </View>
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            color: colors.text,
            opacity: 0.7,
            fontVariant: ['tabular-nums'],
          }}>
          {subline}
        </Text>
      </Pressable>

      {/* Action strip */}
      {row.canTakeUnder ? (
        <View
          style={{
            flexDirection: 'row',
            borderTopWidth: 1,
            borderTopColor: colors.text + '12',
          }}>
          <Pressable
            onPress={() => onTakeUnder(row)}
            accessibilityRole="button"
            accessibilityLabel={`Take under for ${fmtMoney(row.stakeAmount)}`}
            style={{
              flex: 1,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: GOLD + '12',
              gap: 8,
            }}>
            <Icon name="ArrowDownRight" size={15} color={GOLD} />
            <Text style={{ color: GOLD, fontWeight: '800', fontSize: 14 }}>
              Take UNDER · {fmtMoney(row.stakeAmount)}
            </Text>
          </Pressable>
        </View>
      ) : row.iAlreadyStaked ? (
        <View
          style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderTopWidth: 1,
            borderTopColor: colors.text + '12',
            backgroundColor: accent + '0e',
          }}>
          <Text style={{ color: accent, fontWeight: '700', fontSize: 12 }}>
            You're staked on this bet
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// -------------------- Just started cards --------------------

type JustStartedRow = {
  challengeId: string;
  title: string;
  activityKey: string;
  betShape: 'solo' | 'h2h' | 'market' | 'naysayer';
  subjectUserId: string;
  subjectDisplayName: string | null;
  subjectUsername: string | null;
  stakeAmount: number;
  stepGoal: number;
  startedAt: number;
};

function JustStartedCard({
  row,
  colors,
}: {
  row: JustStartedRow;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const activity = getActivity(row.activityKey);
  const display =
    row.subjectDisplayName ??
    (row.subjectUsername ? `@${row.subjectUsername}` : 'A friend');
  const startedMin = Math.max(
    1,
    Math.round((Date.now() - row.startedAt) / 60_000)
  );
  const startedLabel =
    startedMin < 60
      ? `${startedMin}m ago`
      : startedMin < 60 * 24
        ? `${Math.round(startedMin / 60)}h ago`
        : `${Math.floor(startedMin / 60 / 24)}d ago`;
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/challenges/${row.challengeId}` as any)}
      style={{
        width: 210,
        marginRight: 10,
        padding: 14,
        borderRadius: 16,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: colors.text + '14',
      }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>
        {startedLabel.toUpperCase()}
      </Text>
      <Text
        numberOfLines={1}
        style={{ marginTop: 6, color: colors.text, fontWeight: '800', fontSize: 15 }}>
        {display}
      </Text>
      <Text
        numberOfLines={2}
        style={{ marginTop: 2, color: colors.text, opacity: 0.65, fontSize: 12 }}>
        {row.title}
      </Text>
      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text
          style={{
            color: colors.text,
            opacity: 0.55,
            fontSize: 11,
            fontVariant: ['tabular-nums'],
          }}>
          {formatGoal(activity, row.stepGoal)}
        </Text>
        <Text
          style={{
            color: GOLD,
            fontWeight: '800',
            fontSize: 14,
            fontVariant: ['tabular-nums'],
          }}>
          {fmtMoney(row.stakeAmount)}
        </Text>
      </View>
    </Pressable>
  );
}

// -------------------- Confirm sheet --------------------

function TakeUnderSheet({
  row,
  visible,
  onClose,
  onConfirm,
  pending,
  errorMessage,
  colors,
}: {
  row: LiveRow | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  errorMessage: string | null;
  colors: ReturnType<typeof useThemeColors>;
}) {
  if (!row) return null;
  const display =
    row.subjectDisplayName ??
    (row.subjectUsername ? `@${row.subjectUsername}` : 'them');
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}>
        <Pressable
          // eat taps inside the sheet
          onPress={() => {}}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
            borderTopWidth: 1,
            borderTopColor: GOLD + '40',
          }}>
          <Text style={{ ...EYEBROW, color: GOLD }}>STAKE AGAINST</Text>
          <Text
            style={{
              marginTop: 8,
              color: colors.text,
              fontSize: 22,
              fontWeight: '800',
              letterSpacing: -0.4,
            }}>
            {display} won&apos;t hit it
          </Text>
          <Text
            style={{
              marginTop: 6,
              color: colors.text,
              opacity: 0.7,
              fontSize: 14,
              lineHeight: 20,
            }}>
            Stake {fmtMoney(row.stakeAmount)}. If {display} misses {row.title}, you
            get {fmtMoney(row.stakeAmount * 2)} back. If they hit it, your stake
            joins their winnings.
          </Text>

          {errorMessage ? (
            <View
              style={{
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: EMBER + '1c',
                borderRadius: 10,
              }}>
              <Text style={{ color: EMBER, fontSize: 12, fontWeight: '700' }}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: 20, flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={onClose}
              disabled={pending}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: colors.text + '10',
                alignItems: 'center',
              }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={pending}
              style={{
                flex: 2,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: GOLD,
                alignItems: 'center',
                opacity: pending ? 0.6 : 1,
              }}>
              <Text style={{ color: IRON, fontWeight: '800', fontSize: 14 }}>
                {pending
                  ? 'Staking…'
                  : `Stake ${fmtMoney(row.stakeAmount)} against ${display}`}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// -------------------- Screen --------------------

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const stepsToday = useHealthSteps();
  const me = useQuery(api.users.me, {});
  const active = useQuery(api.challenges.myActive, {});
  const recent = useQuery(api.challenges.myRecentSettlements, {});
  const friendsPool = useQuery(api.home.friendsPoolSummary, {});
  const friendsLive = useQuery(api.home.friendsLive, {});
  const justStarted = useQuery(api.home.friendsJustStarted, {});

  const stakeAgainst = useMutation(api.challenges.stakeAgainst);
  const nowMs = useNow(1000);

  const [yDismissedFor, setYDismissedFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheetRow, setSheetRow] = useState<LiveRow | null>(null);
  const [pending, setPending] = useState(false);
  const [stakeErr, setStakeErr] = useState<string | null>(null);
  const [flashOk, setFlashOk] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('home.yesterdayDismissedFor').then(setYDismissedFor);
  }, []);

  const isLoadingCore = me === undefined || active === undefined;
  const stake = ((active ?? []) as any[]).reduce(
    (s: number, c: any) => s + c.stakeAmount,
    0
  );
  const steps = stepsToday.steps;
  const animatedSteps = useTweenedNumber(steps, 500);
  const summary = summariseSettlements((recent ?? []) as Settlement[]);
  const showYesterday = summary && yDismissedFor !== todayKey();

  const stakeRows = ((active ?? []) as any[]).map((c: any) => {
    const activity = getActivity(c.activityKey);
    const isStepsLive = activity.key === 'steps';
    const needed = isStepsLive ? Math.max(0, c.stepGoal - steps) : 0;
    const ratio = isStepsLive && c.stepGoal > 0 ? steps / c.stepGoal : 0;
    const ahead = isStepsLive && needed === 0;
    return { c, activity, isStepsLive, needed, ratio, ahead };
  });
  const stepStakes = stakeRows.filter((r) => r.isStepsLive);
  const mostUrgent = stepStakes
    .filter((r) => r.needed > 0)
    .sort((a, b) => b.needed - a.needed)[0];
  const headlineAccent = mostUrgent ? EMBER : stepStakes.length > 0 ? LIME : GOLD;
  const headlineMessage = mostUrgent
    ? `${fmtSteps(mostUrgent.needed)} steps to keep ${fmtMoney(
        mostUrgent.c.stakeAmount
      )} alive`
    : stepStakes.length > 0
      ? `On pace · ${fmtMoney(
          stepStakes.reduce((s, r) => s + r.c.stakeAmount, 0)
        )} secured`
      : 'No live stakes — start one to play';

  const liveRows = (friendsLive ?? []) as LiveRow[];
  const justStartedRows = (justStarted ?? []) as JustStartedRow[];
  const visibleActiveRows = stakeRows.slice(0, 3);

  const onDismissYesterday = () => {
    const k = todayKey();
    setYDismissedFor(k);
    AsyncStorage.setItem('home.yesterdayDismissedFor', k);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 350));
    setRefreshing(false);
  };

  const openSheet = (row: LiveRow) => {
    setStakeErr(null);
    setSheetRow(row);
  };
  const closeSheet = () => {
    if (pending) return;
    setSheetRow(null);
    setStakeErr(null);
  };
  const confirmStake = async () => {
    if (!sheetRow) return;
    setPending(true);
    setStakeErr(null);
    try {
      await stakeAgainst({ id: sheetRow.challengeId as any });
      const display =
        sheetRow.subjectDisplayName ??
        (sheetRow.subjectUsername ? `@${sheetRow.subjectUsername}` : 'them');
      setFlashOk(`Staked ${fmtMoney(sheetRow.stakeAmount)} against ${display}`);
      setSheetRow(null);
      setTimeout(() => setFlashOk(null), 2400);
    } catch (e: any) {
      setStakeErr(e?.message ?? 'Could not place that stake.');
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
        }>
        {/* Yesterday strip */}
        {showYesterday && summary ? (
          <YesterdayStrip summary={summary} onDismiss={onDismissYesterday} />
        ) : null}

        {/* Header */}
        <View style={{ marginTop: showYesterday ? 18 : 22 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>TODAY</Text>
          <Text
            style={{
              marginTop: 2,
              color: colors.text,
              fontSize: 24,
              fontWeight: '800',
              letterSpacing: -0.6,
            }}>
            {me?.displayName ?? 'Welcome'}
          </Text>
        </View>

        {/* Compressed you-strip */}
        {!stepsToday.hasPermission && stepsToday.didAsk ? (
          <HealthBlocker onGrant={stepsToday.requestPermission} />
        ) : isLoadingCore ? (
          <View style={{ marginTop: SECTION_GAP, height: 80 }} />
        ) : (
          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                  STEPS TODAY
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 2,
                    color: colors.text,
                    fontSize: HERO_NUMBER,
                    fontWeight: '800',
                    letterSpacing: -1.6,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {fmtSteps(animatedSteps)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                  {stakeRows.length > 0 ? 'AT STAKE' : 'NOTHING'}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    color: headlineAccent,
                    fontSize: HERO_NUMBER,
                    fontWeight: '800',
                    letterSpacing: -1.6,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {fmtMoney(stake)}
                </Text>
              </View>
            </View>
            <Text
              style={{
                marginTop: 8,
                color: headlineAccent,
                fontWeight: '700',
                fontSize: 13,
              }}>
              {headlineMessage}
            </Text>
          </View>
        )}

        {/* Friends pool gold hero */}
        {friendsPool ? (
          <FriendsPoolHero
            total={friendsPool.total}
            settlesAt={friendsPool.nextSettlesAt}
            contributorCount={friendsPool.contributorCount}
            eligibleWinners={friendsPool.eligibleWinners ?? 0}
            playersCount={friendsPool.playersCount ?? 0}
            myShare={friendsPool.myShare ?? null}
            mySharePct={friendsPool.mySharePct ?? null}
            amIEligible={friendsPool.amIEligible ?? false}
            nowMs={nowMs}
          />
        ) : null}

        {/* Friends in motion — live cards with Take UNDER */}
        <View style={{ marginTop: SECTION_GAP }}>
          <Pressable
            onPress={() => router.push('/friends' as any)}
            accessibilityRole="link"
            accessibilityLabel="Open friends hub"
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
              FRIENDS IN MOTION{liveRows.length > 0 ? ` · ${liveRows.length}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, color: colors.text, opacity: 0.5 }}>
                See all
              </Text>
              <Icon name="ChevronRight" size={12} color={colors.text + '80'} />
            </View>
          </Pressable>

          {friendsLive === undefined ? (
            <View
              style={{
                marginTop: 12,
                height: 130,
                borderRadius: 18,
                backgroundColor: colors.text + '08',
                borderWidth: 1,
                borderColor: colors.text + '12',
              }}
            />
          ) : liveRows.length > 0 ? (
            liveRows.map((r) => (
              <FriendInMotionCard
                key={r.challengeId}
                row={r}
                colors={colors}
                nowMs={nowMs}
                onTakeUnder={openSheet}
              />
            ))
          ) : (
            <Pressable
              onPress={() => router.push('/(tabs)/challenges/create' as any)}
              style={{
                marginTop: 12,
                padding: 18,
                borderRadius: 16,
                borderStyle: 'dashed',
                borderWidth: 1,
                borderColor: colors.border,
              }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Nothing live from your friends.
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: colors.text, opacity: 0.6 }}>
                Start your own bet — they&apos;ll see it next.
              </Text>
            </Pressable>
          )}
        </View>

        {/* Just started — friend bets opened in last 24h */}
        {justStartedRows.length > 0 ? (
          <View style={{ marginTop: SECTION_GAP, marginHorizontal: -PAGE_X }}>
            <View style={{ paddingHorizontal: PAGE_X }}>
              <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                JUST STARTED · {justStartedRows.length}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: PAGE_X,
                paddingTop: 12,
                paddingRight: PAGE_X,
              }}>
              {justStartedRows.map((r) => (
                <JustStartedCard key={r.challengeId} row={r} colors={colors} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* My active stakes — compact */}
        {stakeRows.length > 0 ? (
          <View style={{ marginTop: SECTION_GAP }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}>
              <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
                MY ACTIVE STAKES · {stakeRows.length}
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/challenges' as any)}>
                <Text style={{ fontSize: 12, color: colors.text, opacity: 0.5 }}>
                  See all
                </Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 8 }}>
              {visibleActiveRows.map(({ c, activity, isStepsLive, needed, ratio, ahead }, i) => {
                const accent = isStepsLive ? (ahead ? LIME : EMBER) : colors.text;
                const sub = isStepsLive
                  ? ahead
                    ? `${c.stepGoal.toLocaleString()} ${activity.unit} · cleared`
                    : `need ${fmtSteps(needed)} ${activity.unit}`
                  : activity.sensor
                    ? 'workout sync pending'
                    : activity.proofKinds.includes('scorecard')
                      ? 'scorecard to settle'
                      : 'photo + GPS to settle';
                return (
                  <Pressable
                    key={c._id}
                    onPress={() =>
                      router.push(`/(tabs)/challenges/${c._id}` as any)
                    }
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: ROW_GAP,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: colors.text + '14',
                    }}>
                    <View
                      style={{
                        width: 30,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                      }}>
                      {isStepsLive ? (
                        <PaceRing
                          ratio={ratio}
                          color={accent}
                          trackColor={colors.text}
                        />
                      ) : (
                        <Icon
                          name={activity.icon as any}
                          size={20}
                          color={colors.text}
                        />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {c.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: colors.text,
                          opacity: 0.55,
                        }}>
                        {sub}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: isStepsLive ? accent : GOLD,
                        fontVariant: ['tabular-nums'],
                      }}>
                      {fmtMoney(c.stakeAmount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Inline success flash */}
      {flashOk ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 16,
            backgroundColor: LIME,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 18,
          }}>
          <Text style={{ color: IRON, fontWeight: '800', fontSize: 14 }}>
            {flashOk}
          </Text>
        </View>
      ) : null}

      <TakeUnderSheet
        visible={!!sheetRow}
        row={sheetRow}
        onClose={closeSheet}
        onConfirm={confirmStake}
        pending={pending}
        errorMessage={stakeErr}
        colors={colors}
      />
    </View>
  );
}
