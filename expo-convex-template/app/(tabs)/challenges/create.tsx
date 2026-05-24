import { useMutation } from '@/lib/persona-convex';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import {
  ACTIVITY_KEYS,
  type ActivityDef,
  type ActivityKey,
  formatGoal,
  getActivity,
} from '@/lib/activities';
import { getActivityMascot, SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { startTrackingForBet } from '@/lib/locationTracking';
import { EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

type Step = 1 | 2 | 3 | 4 | 5;
type BetShape = 'solo' | 'h2h' | 'market' | 'naysayer';
type PoolScope = 'global' | 'region' | 'friends';

const STEP_LABELS: Record<Step, string> = {
  1: 'ACTIVITY',
  2: 'GOAL',
  3: 'STAKE',
  4: 'OPPONENT',
  5: 'CONFIRM',
};

const STAKES = [5, 10, 20, 50];
const DAYS = [1, 3, 7, 14];

// Sensible goal preset chips per activity goalKind.
function goalPresets(activity: ActivityDef): number[] {
  switch (activity.goalKind) {
    case 'count':
      return [5_000, 8_000, 10_000, 12_500, 15_000];
    case 'distance':
      return [3, 5, 8, 10, 15];
    case 'duration':
      return [15, 30, 45, 60];
    case 'binary':
      return [1, 3, 5, 7];
    case 'score':
      return activity.key === 'golf' ? [80, 85, 90, 95] : [1, 2, 3];
  }
}

function defaultGoal(activity: ActivityDef): number {
  return goalPresets(activity)[Math.floor(goalPresets(activity).length / 2)];
}

export default function CreateBet() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const createBet = useMutation(api.challenges.createBet);

  // Deep-link prefill from a friend's profile (counterparty + betShape)
  // OR from the onboarding suggestion cards (activity + goal + stake + days).
  // When the suggestion includes everything but the opponent, we jump to
  // the STAKE step (3) so the user is one tap away from creating.
  const params = useLocalSearchParams<{
    counterparty?: string;
    counterpartyName?: string;
    betShape?: string;
    activity?: string;
    goal?: string;
    stake?: string;
    days?: string;
  }>();
  const counterpartyName = params.counterpartyName?.trim() || '';
  const prefillShape: BetShape | null =
    params.betShape === 'h2h' || params.betShape === 'naysayer'
      ? (params.betShape as BetShape)
      : null;
  const prefillActivity =
    params.activity && (ACTIVITY_KEYS as readonly string[]).includes(params.activity)
      ? (params.activity as ActivityKey)
      : null;
  const prefillGoal = params.goal ? Number(params.goal) : null;
  const prefillStake = params.stake ? Number(params.stake) : null;
  const prefillDays = params.days ? Number(params.days) : null;

  // Only jump straight to the OPPONENT/CONFIRM step when the deep-link
  // pre-filled the activity AND the goal AND the stake (the onboarding
  // suggestion cards do this). When the friend-profile h2h CTA only
  // pre-fills counterparty + shape, drop the user at the activity
  // picker so they can choose what they're betting on.
  const initialStep: Step =
    prefillActivity && prefillGoal != null && prefillStake != null
      ? 4
      : 1;

  const [step, setStep] = useState<Step>(initialStep);
  const [activityKey, setActivityKey] = useState<ActivityKey>(prefillActivity ?? 'steps');
  const activity = getActivity(activityKey);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<number>(() =>
    prefillGoal && Number.isFinite(prefillGoal) ? prefillGoal : defaultGoal(activity)
  );
  const [days, setDays] = useState<number>(
    prefillDays && Number.isFinite(prefillDays) ? prefillDays : 1
  );
  const [stake, setStake] = useState<number>(
    prefillStake && Number.isFinite(prefillStake) ? prefillStake : 10
  );
  const [shape, setShape] = useState<BetShape>(prefillShape ?? 'h2h');

  useEffect(() => {
    if (prefillShape) setShape(prefillShape);
  }, [prefillShape]);
  const [marketLine, setMarketLine] = useState<number>(() => defaultGoal(activity));
  const [marketSide, setMarketSide] = useState<'over' | 'under'>('over');
  const [poolScope, setPoolScope] = useState<PoolScope>('global');
  const [busy, setBusy] = useState(false);

  // When activity changes, re-snap goal/marketLine to a sensible default.
  function changeActivity(next: ActivityKey) {
    setActivityKey(next);
    const a = getActivity(next);
    setGoal(defaultGoal(a));
    setMarketLine(defaultGoal(a));
  }

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return !!activityKey;
      case 2:
        return goal > 0 && days >= 1;
      case 3:
        return stake > 0;
      case 4:
        if (shape === 'market') return marketLine > 0 && !!marketSide;
        return true;
      case 5:
        return true;
    }
  }, [step, activityKey, goal, days, stake, shape, marketLine, marketSide]);

  const onContinue = () => {
    if (step < 5) {
      setStep((s) => Math.min(5, s + 1) as Step);
      return;
    }
    onSubmit();
  };

  const onBack = () => {
    if (step > 1) setStep((s) => Math.max(1, s - 1) as Step);
    else router.back();
  };

  async function onSubmit() {
    try {
      setBusy(true);
      const finalTitle = title.trim() || defaultTitle(activity, goal, shape);
      const id = await createBet({
        title: finalTitle,
        activityKey,
        goal,
        stakeAmount: stake,
        durationDays: days,
        betShape: shape,
        marketLine: shape === 'market' ? marketLine : undefined,
        side: shape === 'market' ? marketSide : undefined,
        // Pool scope is meaningful for solo + naysayer (others handle internally).
        poolScope: shape === 'solo' || shape === 'naysayer' ? poolScope : 'global',
      });
      // For non-sensor bets, start background pings now that we know the
      // bet's id and end time. Failure is non-blocking.
      if (!activity.sensor) {
        const endsAt = Date.now() + days * 24 * 60 * 60 * 1000;
        startTrackingForBet(id as unknown as string, endsAt).catch((e) =>
          console.warn('[tracking] start failed', e)
        );
      }
      router.replace(`/(tabs)/challenges/${id}` as any);
    } catch (e: any) {
      Alert.alert('Could not place bet', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: PAGE_X,
            paddingTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
            <Icon name="ChevronLeft" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
            STEP {step} OF 5 · {STEP_LABELS[step]}
          </Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Progress segments */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: PAGE_X,
            marginTop: 14,
            gap: 4,
          }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View
              key={n}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: n <= step ? GOLD : colors.text + '14',
              }}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: PAGE_X,
            paddingTop: 24,
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}>
          {step === 1 && (
            <ActivityStep
              colors={colors}
              activityKey={activityKey}
              onChange={changeActivity}
              counterpartyName={shape === 'h2h' ? counterpartyName : ''}
            />
          )}
          {step === 2 && (
            <GoalStep
              colors={colors}
              activity={activity}
              goal={goal}
              setGoal={setGoal}
              days={days}
              setDays={setDays}
              title={title}
              setTitle={setTitle}
            />
          )}
          {step === 3 && <StakeStep colors={colors} stake={stake} setStake={setStake} />}
          {step === 4 && (
            <OpponentStep
              colors={colors}
              shape={shape}
              setShape={setShape}
              activity={activity}
              marketLine={marketLine}
              setMarketLine={setMarketLine}
              marketSide={marketSide}
              setMarketSide={setMarketSide}
              poolScope={poolScope}
              setPoolScope={setPoolScope}
              counterpartyName={shape === 'h2h' ? counterpartyName : ''}
            />
          )}
          {step === 5 && (
            <ConfirmStep
              colors={colors}
              activity={activity}
              goal={goal}
              days={days}
              stake={stake}
              shape={shape}
              marketLine={marketLine}
              marketSide={marketSide}
              title={title || defaultTitle(activity, goal, shape)}
            />
          )}
        </ScrollView>

        {/* Sticky CTA */}
        <View
          style={{
            position: 'absolute',
            left: PAGE_X,
            right: PAGE_X,
            bottom: insets.bottom + 12,
          }}>
          <Pressable
            onPress={onContinue}
            disabled={!canAdvance || busy}
            style={{
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canAdvance ? GOLD : colors.text + '14',
              opacity: busy ? 0.7 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <Text
                style={{
                  color: canAdvance ? IRON : colors.text,
                  fontWeight: '800',
                  fontSize: 16,
                  letterSpacing: -0.2,
                }}>
                {step === 5
                  ? shape === 'h2h'
                    ? `Create invite · stake $${stake}`
                    : `Place bet · stake $${stake}`
                  : 'Continue'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function defaultTitle(activity: ActivityDef, goal: number, shape: BetShape) {
  const goalText = formatGoal(activity, goal);
  if (shape === 'market') return `${activity.name} · over/under ${goal}`;
  return `${activity.verb} · ${goalText}`;
}

function ActivityStep({
  colors,
  activityKey,
  onChange,
  counterpartyName,
}: {
  colors: ReturnType<typeof useThemeColors>;
  activityKey: ActivityKey;
  onChange: (k: ActivityKey) => void;
  counterpartyName?: string;
}) {
  const activity = getActivity(activityKey);
  const hasCounterparty = !!counterpartyName;
  return (
    <View>
      <StepMascot source={getActivityMascot(activity.key)} colors={colors} />
      {hasCounterparty ? (
        <Text style={{ ...EYEBROW, color: GOLD, marginBottom: 6 }}>
          VS {counterpartyName!.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
        }}>
        {hasCounterparty
          ? `What's the challenge?`
          : 'What are you betting on?'}
      </Text>
      <Text style={{ marginTop: 6, color: colors.text, opacity: 0.55, fontSize: 13 }}>
        {hasCounterparty
          ? `Pick the activity you and ${counterpartyName} will go head-to-head on.`
          : 'Pick the activity. Goal options change to match.'}
      </Text>
      <View style={{ marginTop: 22 }}>
        {ACTIVITY_KEYS.map((k, i) => {
          const a = getActivity(k);
          const selected = k === activityKey;
          return (
            <Pressable
              key={k}
              onPress={() => onChange(k)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.text + '14',
              }}>
              <View
                style={{
                  width: 30,
                  alignItems: 'center',
                  marginRight: 14,
                }}>
                <Icon name={a.icon as any} size={20} color={selected ? GOLD : colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '700',
                  }}>
                  {a.name}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    color: colors.text,
                    opacity: 0.55,
                    fontSize: 12,
                  }}>
                  {a.sensor ? 'Sensor settles automatically' : 'Photo + GPS to settle'}
                </Text>
              </View>
              {selected ? <Icon name="Check" size={18} color={GOLD} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function GoalStep({
  colors,
  activity,
  goal,
  setGoal,
  days,
  setDays,
  title,
  setTitle,
}: {
  colors: ReturnType<typeof useThemeColors>;
  activity: ActivityDef;
  goal: number;
  setGoal: (v: number) => void;
  days: number;
  setDays: (v: number) => void;
  title: string;
  setTitle: (v: string) => void;
}) {
  const presets = goalPresets(activity);
  return (
    <View>
      <StepMascot source={getActivityMascot(activity.key)} colors={colors} />
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
        }}>
        Set the bar.
      </Text>
      <Text style={{ marginTop: 6, color: colors.text, opacity: 0.55, fontSize: 13 }}>
        {activity.name} · pick a goal you have to hit each day.
      </Text>

      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginTop: 26 }}>GOAL</Text>
      <View
        style={{
          marginTop: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {presets.map((v) => (
          <Chip
            key={v}
            label={formatGoal(activity, v)}
            selected={v === goal}
            onPress={() => setGoal(v)}
            colors={colors}
          />
        ))}
      </View>

      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginTop: 28 }}>DURATION</Text>
      <View
        style={{
          marginTop: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {DAYS.map((d) => (
          <Chip
            key={d}
            label={d === 1 ? 'today' : `${d} days`}
            selected={d === days}
            onPress={() => setDays(d)}
            colors={colors}
          />
        ))}
      </View>

      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginTop: 28 }}>
        TITLE (OPTIONAL)
      </Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={defaultTitle(activity, goal, 'solo')}
        placeholderTextColor={colors.text + '60'}
        style={{
          marginTop: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.text + '24',
          paddingVertical: 10,
          color: colors.text,
          fontSize: 16,
          fontWeight: '600',
        }}
      />
    </View>
  );
}

function StakeStep({
  colors,
  stake,
  setStake,
}: {
  colors: ReturnType<typeof useThemeColors>;
  stake: number;
  setStake: (v: number) => void;
}) {
  return (
    <View>
      <StepMascot source={SCENARIO_MASCOTS.atRisk} colors={colors} />
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
        }}>
        How much is on the line?
      </Text>
      <Text style={{ marginTop: 6, color: colors.text, opacity: 0.55, fontSize: 13 }}>
        Miss the goal, lose this stake. Keep it small until you trust yourself.
      </Text>

      <View style={{ marginTop: 28, alignItems: 'center' }}>
        <Text
          style={{
            color: EMBER,
            fontSize: 88,
            fontWeight: '900',
            letterSpacing: -3,
            fontVariant: ['tabular-nums'],
          }}>
          ${stake}
        </Text>
      </View>

      <View
        style={{
          marginTop: 28,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        }}>
        {STAKES.map((v) => (
          <Chip
            key={v}
            label={`$${v}`}
            selected={v === stake}
            onPress={() => setStake(v)}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

function OpponentStep({
  colors,
  shape,
  setShape,
  activity,
  marketLine,
  setMarketLine,
  marketSide,
  setMarketSide,
  poolScope,
  setPoolScope,
  counterpartyName,
}: {
  colors: ReturnType<typeof useThemeColors>;
  shape: BetShape;
  setShape: (s: BetShape) => void;
  activity: ActivityDef;
  marketLine: number;
  setMarketLine: (v: number) => void;
  marketSide: 'over' | 'under';
  setMarketSide: (s: 'over' | 'under') => void;
  poolScope: PoolScope;
  setPoolScope: (s: PoolScope) => void;
  counterpartyName?: string;
}) {
  const lineText = String(marketLine);
  const hasCounterparty = !!counterpartyName;
  return (
    <View>
      <StepMascot
        source={
          shape === 'market'
            ? SCENARIO_MASCOTS.jackpotRunPool
            : shape === 'solo'
              ? SCENARIO_MASCOTS.atRisk
              : SCENARIO_MASCOTS.friendMatch
        }
        colors={colors}
      />
      {hasCounterparty ? (
        <Text style={{ ...EYEBROW, color: GOLD, marginBottom: 6 }}>
          MATCH · {counterpartyName!.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
        }}>
        {hasCounterparty ? 'Confirm the matchup.' : 'Find your match.'}
      </Text>
      <Text style={{ marginTop: 6, color: colors.text, opacity: 0.55, fontSize: 13 }}>
        {hasCounterparty
          ? `Keep it 1:1 with ${counterpartyName}, or switch shape if you've changed your mind.`
          : 'Ping a friend first. If nobody bites, you can still bet against yourself or open a market.'}
      </Text>

      <View style={{ marginTop: 22 }}>
        <ShapeOption
          colors={colors}
          icon="UserPlus"
          title="Ping a friend"
          sub="Invite link. Loser pays winner. 1:1 even money."
          selected={shape === 'h2h'}
          onPress={() => setShape('h2h')}
          isFirst
        />
        <ShapeOption
          colors={colors}
          icon="ShieldOff"
          title="Naysayer (friends bet against you)"
          sub="Friends only. They stake. If you fail, they take your forfeit."
          selected={shape === 'naysayer'}
          onPress={() => setShape('naysayer')}
        />
        <ShapeOption
          colors={colors}
          icon="User"
          title="Bet against yourself"
          sub="You vs the house. Forfeits feed the jackpot."
          selected={shape === 'solo'}
          onPress={() => setShape('solo')}
        />
        <ShapeOption
          colors={colors}
          icon="LineChart"
          title="Open market (over/under)"
          sub="Anyone can take the other side of your line."
          selected={shape === 'market'}
          onPress={() => setShape('market')}
        />
      </View>

      {shape === 'market' ? (
        <View style={{ marginTop: 30 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>LINE</Text>
          <TextInput
            value={lineText}
            keyboardType="number-pad"
            onChangeText={(t) => {
              const n = Number(t.replace(/[^0-9.]/g, '')) || 0;
              setMarketLine(n);
            }}
            style={{
              marginTop: 6,
              borderBottomWidth: 1,
              borderBottomColor: colors.text + '24',
              paddingVertical: 10,
              color: colors.text,
              fontSize: 24,
              fontWeight: '800',
              letterSpacing: -0.5,
              fontVariant: ['tabular-nums'],
            }}
          />
          <Text style={{ marginTop: 4, color: colors.text, opacity: 0.5, fontSize: 12 }}>
            {activity.unit ? `Counted in ${activity.unit}.` : 'Use the natural unit.'} Others bet
            over or under this number.
          </Text>

          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginTop: 24 }}>
            YOUR SIDE
          </Text>
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
            <Chip
              label="Over"
              selected={marketSide === 'over'}
              onPress={() => setMarketSide('over')}
              colors={colors}
              accent={LIME}
            />
            <Chip
              label="Under"
              selected={marketSide === 'under'}
              onPress={() => setMarketSide('under')}
              colors={colors}
              accent={EMBER}
            />
          </View>
        </View>
      ) : null}

      {shape === 'h2h' ? (
        <View
          style={{
            marginTop: 22,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.text + '14',
          }}>
          <Text style={{ color: colors.text, fontSize: 13, opacity: 0.7 }}>
            After you place the bet, you'll get a share link. Send it to one person. The bet locks
            when they accept.
          </Text>
        </View>
      ) : null}

      {shape === 'naysayer' ? (
        <View
          style={{
            marginTop: 22,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.text + '14',
          }}>
          <Text style={{ color: colors.text, fontSize: 13, opacity: 0.7 }}>
            Only your friends can take the other side. Hit your goal: their stakes pay you. Miss it:
            they split your stake.
          </Text>
        </View>
      ) : null}

      {shape === 'solo' || shape === 'naysayer' ? (
        <View style={{ marginTop: 28 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>FORFEIT GOES TO</Text>
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
            <Chip
              label="Global pool"
              selected={poolScope === 'global'}
              onPress={() => setPoolScope('global')}
              colors={colors}
            />
            <Chip
              label="My country"
              selected={poolScope === 'region'}
              onPress={() => setPoolScope('region')}
              colors={colors}
            />
            <Chip
              label="My friends"
              selected={poolScope === 'friends'}
              onPress={() => setPoolScope('friends')}
              colors={colors}
            />
          </View>
          <Text
            style={{
              marginTop: 8,
              color: colors.text,
              opacity: 0.5,
              fontSize: 11,
              lineHeight: 16,
            }}>
            Region needs your country set in Profile; falls back to Global if missing.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ConfirmStep({
  colors,
  activity,
  goal,
  days,
  stake,
  shape,
  marketLine,
  marketSide,
  title,
}: {
  colors: ReturnType<typeof useThemeColors>;
  activity: ActivityDef;
  goal: number;
  days: number;
  stake: number;
  shape: BetShape;
  marketLine: number;
  marketSide: 'over' | 'under';
  title: string;
}) {
  const goalText = formatGoal(activity, goal);
  const durationText = days === 1 ? 'today' : `${days}d`;
  const shapeText =
    shape === 'solo'
      ? 'Solo'
      : shape === 'h2h'
        ? 'Head-to-head'
        : `Over/under · you take ${marketSide.toUpperCase()} ${marketLine}`;
  return (
    <View>
      <StepMascot
        source={
          shape === 'h2h'
            ? SCENARIO_MASCOTS.vsFriend
            : shape === 'market'
              ? SCENARIO_MASCOTS.jackpotRunPool
              : getActivityMascot(activity.key)
        }
        colors={colors}
      />
      <Text
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.6,
        }}>
        Lock it in.
      </Text>
      <Text style={{ marginTop: 6, color: colors.text, opacity: 0.55, fontSize: 13 }}>
        Read it back. Stake leaves your wallet now.
      </Text>

      {/* Bet card preview — minimal, mimics a Home row but bigger */}
      <View
        style={{
          marginTop: 26,
          paddingVertical: 22,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.text + '14',
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              alignItems: 'center',
              marginRight: 14,
            }}>
            <Icon name={activity.icon as any} size={22} color={GOLD} />
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
            <Text
              style={{
                marginTop: 2,
                color: colors.text,
                opacity: 0.6,
                fontSize: 13,
              }}>
              {goalText} · {durationText} · {shapeText}
            </Text>
          </View>
          <Text
            style={{
              color: EMBER,
              fontSize: 22,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}>
            ${stake}
          </Text>
        </View>
      </View>

      <Text
        style={{
          marginTop: 22,
          color: colors.text,
          opacity: 0.55,
          fontSize: 12,
          lineHeight: 18,
        }}>
        {shape === 'solo'
          ? `If you miss, your $${stake} feeds the jackpot. If you finish, you get it back.`
          : shape === 'h2h'
            ? `Loser pays winner. If both finish, both get refunded. If neither finishes, both stakes feed the jackpot.`
            : `Winners on the right side of ${marketLine} split the losers' pot evenly.`}
      </Text>
    </View>
  );
}

function StepMascot({
  source,
  colors,
}: {
  source: ReturnType<typeof getActivityMascot>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Image
      source={source}
      resizeMode="cover"
      style={{
        width: '100%',
        height: 150,
        borderRadius: 16,
        marginBottom: 22,
        backgroundColor: colors.text + '10',
      }}
    />
  );
}

function ShapeOption({
  colors,
  icon,
  title,
  sub,
  selected,
  onPress,
  isFirst,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: string;
  title: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
  isFirst?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
      }}>
      <View style={{ width: 30, alignItems: 'center', marginRight: 14 }}>
        <Icon name={icon as any} size={20} color={selected ? GOLD : colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text
          style={{
            marginTop: 2,
            color: colors.text,
            opacity: 0.55,
            fontSize: 12,
          }}>
          {sub}
        </Text>
      </View>
      {selected ? <Icon name="Check" size={18} color={GOLD} /> : null}
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
  colors,
  accent,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  accent?: string;
}) {
  const fill = accent ?? GOLD;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? fill : colors.text + '20',
        backgroundColor: selected ? fill : 'transparent',
      }}>
      <Text
        style={{
          color: selected ? IRON : colors.text,
          fontWeight: '700',
          fontSize: 14,
          fontVariant: ['tabular-nums'],
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
