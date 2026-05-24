import { useMutation, useQuery } from '@/lib/persona-convex';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { H2HSideBySide } from '@/components/friends/H2HSideBySide';
import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { formatGoal, getActivity, type ActivityDef } from '@/lib/activities';
import { getActivityMascot, SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { startTrackingForBet } from '@/lib/locationTracking';
import { EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function BetDetail() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const challenge = useQuery(api.challenges.get, id ? { id: id as Id<'challenges'> } : 'skip');
  const me = useQuery(api.users.me);
  const join = useMutation(api.challenges.join);
  const takeSide = useMutation(api.challenges.takeSide);
  const [acting, setActing] = useState<'join' | 'over' | 'under' | null>(null);
  const [justJoined, setJustJoined] = useState(false);

  // 3-second post-join confirmation banner.
  useEffect(() => {
    if (!justJoined) return;
    const t = setTimeout(() => setJustJoined(false), 3000);
    return () => clearTimeout(t);
  }, [justJoined]);

  if (!challenge) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        }}>
        <SimpleHeader colors={colors} title="" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  const activity = getActivity(challenge.activityKey);
  const shape = challenge.betShape ?? 'solo';
  const myParticipant = challenge.participants.find((p) => p.isMe);
  const isParticipant = !!myParticipant && myParticipant.status !== 'pending';
  const stakeFitsWallet = (me?.walletBalance ?? 0) >= challenge.stakeAmount;
  const startsInPast = challenge.startsAt <= Date.now();
  // 24h-before-end join lock — server enforces, we just gate the CTA and
  // show a countdown so the user understands why.
  const joinClosesAtMs = (challenge as any).joinClosesAt as number | undefined;
  const joinLocked =
    joinClosesAtMs != null && Date.now() > joinClosesAtMs;
  const lockHoursLeft =
    joinClosesAtMs != null
      ? Math.max(0, (joinClosesAtMs - Date.now()) / 3_600_000)
      : null;
  const goalText = formatGoal(activity, challenge.stepGoal);
  const heroMascot =
    myParticipant?.status === 'won'
      ? SCENARIO_MASCOTS.betWon
      : myParticipant?.status === 'forfeit'
        ? SCENARIO_MASCOTS.betForfeit
        : shape === 'h2h'
          ? SCENARIO_MASCOTS.vsFriend
          : shape === 'market'
            ? SCENARIO_MASCOTS.jackpotRunPool
            : getActivityMascot(activity.key);

  async function onJoin() {
    if (!id || !challenge) return;
    try {
      setActing('join');
      await join({ id: id as Id<'challenges'> });
      setJustJoined(true);
      // For non-sensor activities, request background location and start
      // pinging for the bet window. Failure is non-blocking — the user can
      // still settle by submitting proof manually.
      if (!getActivity(challenge.activityKey).sensor) {
        startTrackingForBet(id, challenge.endsAt).catch((e) =>
          console.warn('[tracking] start failed', e)
        );
      }
    } catch (e: any) {
      Alert.alert('Could not join', e?.message ?? String(e));
    } finally {
      setActing(null);
    }
  }

  async function onTakeSide(side: 'over' | 'under') {
    if (!id || !challenge) return;
    try {
      setActing(side);
      await takeSide({ id: id as Id<'challenges'>, side });
      setJustJoined(true);
      if (!getActivity(challenge.activityKey).sensor) {
        startTrackingForBet(id, challenge.endsAt).catch((e) =>
          console.warn('[tracking] start failed', e)
        );
      }
    } catch (e: any) {
      Alert.alert('Could not take side', e?.message ?? String(e));
    } finally {
      setActing(null);
    }
  }

  async function onShare() {
    if (!id) return;
    try {
      await Share.share({
        message: `Take the other side: fitstake://bets/${id}`,
        title: challenge!.title,
      });
    } catch {
      // user-cancelled share is not an error
    }
  }

  async function onSubmitProof() {
    if (!myParticipant) return;
    router.push(`/proof/${myParticipant._id}` as any);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
      }}>
      <SimpleHeader colors={colors} title={shape === 'market' ? 'MARKET' : 'BET'} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}>
        <Image
          source={heroMascot}
          resizeMode="cover"
          style={{
            width: '100%',
            height: 176,
            borderRadius: 18,
            marginTop: 10,
            marginBottom: 18,
            backgroundColor: colors.text + '10',
          }}
        />
        {/* Hero — activity icon + title + goal */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              alignItems: 'center',
              marginRight: 14,
            }}>
            <Icon name={activity.icon as any} size={26} color={GOLD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...EYEBROW, color: GOLD }}>{activity.name.toUpperCase()}</Text>
            <Text
              style={{
                marginTop: 2,
                color: colors.text,
                fontSize: 26,
                fontWeight: '800',
                letterSpacing: -0.6,
              }}>
              {challenge.title}
            </Text>
          </View>
        </View>

        {/* Goal + stake paired numbers */}
        <View
          style={{
            marginTop: 22,
            paddingTop: 18,
            paddingBottom: 18,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.text + '14',
            flexDirection: 'row',
          }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
              {shape === 'market' ? 'LINE' : 'GOAL'}
            </Text>
            <Text
              style={{
                marginTop: 4,
                color: colors.text,
                fontSize: 30,
                fontWeight: '800',
                letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}>
              {shape === 'market' ? (challenge.marketLine?.toLocaleString() ?? '—') : goalText}
            </Text>
            <Text style={{ marginTop: 2, color: colors.text, opacity: 0.5, fontSize: 12 }}>
              {challenge.durationDays === 1 ? 'today' : `over ${challenge.durationDays} days`}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>STAKE</Text>
            <Text
              style={{
                marginTop: 4,
                color: EMBER,
                fontSize: 30,
                fontWeight: '800',
                letterSpacing: -1,
                fontVariant: ['tabular-nums'],
              }}>
              ${challenge.stakeAmount}
            </Text>
            <Text style={{ marginTop: 2, color: colors.text, opacity: 0.5, fontSize: 12 }}>
              per side
            </Text>
          </View>
        </View>

        {challenge.description ? (
          <Text
            style={{
              marginTop: 18,
              color: colors.text,
              opacity: 0.7,
              fontSize: 14,
              lineHeight: 20,
            }}>
            {challenge.description}
          </Text>
        ) : null}

        {/* Side-by-side live progress — h2h bets where I'm a participant.
            Sits above the participants list so the rivalry reads first. */}
        {shape === 'h2h' && isParticipant && id ? (
          <H2HSideBySide challengeId={id as Id<'challenges'>} />
        ) : null}

        {/* Shape-specific section */}
        {shape === 'market' ? (
          <MarketSidesSection
            colors={colors}
            participants={challenge.participants}
            line={challenge.marketLine ?? 0}
            unit={activity.unit}
          />
        ) : (
          <ParticipantsSection
            colors={colors}
            participants={challenge.participants}
            shape={shape}
            activity={activity}
            goal={challenge.stepGoal}
          />
        )}

        {/* Session check-in strip — only multi-session non-sensor bets where
            I'm a participant. Shows "X of N sessions" with one cell per day
            and surfaces missed days I can back-fill from background pings. */}
        {myParticipant && !activity.sensor && challenge.stepGoal > 1 ? (
          <SessionStripSection
            colors={colors}
            participantId={myParticipant._id}
            onCheckIn={(forDate) =>
              router.push(`/proof/${myParticipant._id}?forDate=${forDate}` as any)
            }
          />
        ) : null}

        {/* Settle hint */}
        <View
          style={{
            marginTop: SECTION_GAP,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.text + '14',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={activity.sensor ? 'Activity' : 'Camera'} size={14} color={colors.text} />
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>SETTLES BY</Text>
          </View>
          <Text
            style={{
              marginTop: 6,
              color: colors.text,
              fontSize: 14,
              opacity: 0.85,
            }}>
            {activity.sensor
              ? `${activity.name} from your fitness sensor settles automatically.`
              : `Photo${activity.proofKinds.includes('gps') ? ' + GPS' : ''}${
                  activity.proofKinds.includes('scorecard') ? ' + scorecard' : ''
                }. Counterparty trusts the submission unless they dispute.`}
          </Text>
        </View>
      </ScrollView>

      {/* Action area */}
      <View
        style={{
          position: 'absolute',
          left: PAGE_X,
          right: PAGE_X,
          bottom: insets.bottom + 12,
        }}>
        {justJoined ? (
          <ActionButton
            label={`✓ You're in for $${challenge.stakeAmount}`}
            tone="lime"
            colors={colors}
            disabled
          />
        ) : isParticipant && !activity.sensor ? (
          <ActionButton label="Submit proof" tone="gold" onPress={onSubmitProof} colors={colors} />
        ) : isParticipant ? (
          // Sensor-tracked + already in. The participant row carries the
          // status; no CTA needed here.
          null
        ) : joinLocked ? (
          <ActionButton
            label="Locked · last 24h of the bet"
            tone="ember"
            colors={colors}
            disabled
          />
        ) : shape === 'market' ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionButton
              label={`Take OVER ${challenge.marketLine}`}
              tone="lime"
              onPress={() => onTakeSide('over')}
              colors={colors}
              flex
              loading={acting === 'over'}
              disabled={!stakeFitsWallet}
            />
            <ActionButton
              label={`Take UNDER ${challenge.marketLine}`}
              tone="ember"
              onPress={() => onTakeSide('under')}
              colors={colors}
              flex
              loading={acting === 'under'}
              disabled={!stakeFitsWallet}
            />
          </View>
        ) : !stakeFitsWallet ? (
          <ActionButton
            label={`Need $${challenge.stakeAmount - (me?.walletBalance ?? 0)} more`}
            tone="ember"
            onPress={() => router.push('/(tabs)/wallet')}
            colors={colors}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ActionButton
              label={
                shape === 'naysayer'
                  ? `Bet $${challenge.stakeAmount} they won't`
                  : shape === 'h2h'
                    ? `Accept · $${challenge.stakeAmount}`
                    : `Stake $${challenge.stakeAmount}`
              }
              tone={shape === 'naysayer' ? 'ember' : 'gold'}
              onPress={onJoin}
              colors={colors}
              flex
              loading={acting === 'join'}
              disabled={startsInPast}
            />
            {shape === 'h2h' && me?._id === challenge.creatorId ? (
              <ActionButton label="Share invite" tone="ghost" onPress={onShare} colors={colors} />
            ) : null}
          </View>
        )}
        {/* Lock countdown — visible only when there's still time to bet
            against the doer AND I'm not already in. Disappears for
            participants and once the window has shut. */}
        {!isParticipant && !joinLocked && lockHoursLeft != null && lockHoursLeft > 0 ? (
          <Text
            style={{
              marginTop: 8,
              textAlign: 'center',
              color: colors.text,
              opacity: 0.55,
              fontSize: 12,
            }}>
            New bets lock in{' '}
            {lockHoursLeft < 24
              ? `${Math.max(1, Math.round(lockHoursLeft))}h`
              : `${Math.floor(lockHoursLeft / 24)}d ${Math.round(lockHoursLeft % 24)}h`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SimpleHeader({
  colors,
  title,
}: {
  colors: ReturnType<typeof useThemeColors>;
  title: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: PAGE_X,
        paddingTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
        <Icon name="ChevronLeft" size={22} color={colors.text} />
      </Pressable>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>{title}</Text>
      <View style={{ width: 22 }} />
    </View>
  );
}

function MarketSidesSection({
  colors,
  participants,
  line,
  unit,
}: {
  colors: ReturnType<typeof useThemeColors>;
  participants: {
    _id: string;
    side?: 'over' | 'under';
    displayName: string | null;
    stakeAmount: number;
    isMe?: boolean;
  }[];
  line: number;
  unit: string;
}) {
  const overs = participants.filter((p) => p.side === 'over');
  const unders = participants.filter((p) => p.side === 'under');
  const overTotal = overs.reduce((s, p) => s + p.stakeAmount, 0);
  const underTotal = unders.reduce((s, p) => s + p.stakeAmount, 0);

  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
        MARKET · LINE {line.toLocaleString()} {unit}
      </Text>
      <View style={{ marginTop: 14, flexDirection: 'row', gap: 12 }}>
        <SideStack tone={LIME} label="OVER" total={overTotal} count={overs.length} />
        <SideStack tone={EMBER} label="UNDER" total={underTotal} count={unders.length} />
      </View>

      <Text
        style={{
          ...EYEBROW,
          color: colors.text,
          opacity: 0.5,
          marginTop: SECTION_GAP,
          marginBottom: 4,
        }}>
        TAKERS · {participants.length}
      </Text>
      {participants.map((p, i) => (
        <View
          key={p._id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: colors.text + '14',
          }}>
          <Avatar name={p.displayName} colors={colors} />
          <Text
            style={{
              flex: 1,
              marginLeft: 12,
              color: colors.text,
              fontWeight: '600',
            }}>
            {p.displayName ?? 'Anonymous'} {p.isMe ? '· you' : ''}
          </Text>
          <Text
            style={{
              color: p.side === 'over' ? LIME : p.side === 'under' ? EMBER : colors.text,
              fontWeight: '700',
              fontSize: 13,
              marginRight: 12,
            }}>
            {p.side?.toUpperCase() ?? '—'}
          </Text>
          <Text
            style={{
              color: colors.text,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
            }}>
            ${p.stakeAmount}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ParticipantsSection({
  colors,
  participants,
  shape,
  activity,
  goal,
}: {
  colors: ReturnType<typeof useThemeColors>;
  participants: any[];
  shape: 'solo' | 'h2h' | 'naysayer';
  activity: ActivityDef;
  goal: number;
}) {
  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
        {shape === 'h2h' ? 'BOTH SIDES' : `IN · ${participants.length}`}
      </Text>
      <View style={{ marginTop: 4 }}>
        {participants.map((p: any, i: number) => {
          const tone =
            p.status === 'won'
              ? LIME
              : p.status === 'forfeit'
                ? EMBER
                : p.status === 'pending'
                  ? colors.text
                  : colors.text;
          const statusText = p.status === 'pending' ? 'waiting to accept' : p.status;
          const showProgress =
            p.isStepBet && p.status !== 'pending' && p.liveProgress != null;
          const ratio = Math.max(0, Math.min(1, p.progressRatio ?? 0));
          const ahead = ratio >= 1;
          const ringColor = ahead ? LIME : p.status === 'forfeit' ? EMBER : tone;
          return (
            <Pressable
              key={p._id}
              onPress={() =>
                !p.isMe && p.userId
                  ? router.push(`/friends/${p.userId}` as any)
                  : undefined
              }
              style={{
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.text + '14',
                opacity: p.status === 'pending' ? 0.55 : 1,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Avatar name={p.displayName} colors={colors} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        fontSize: 15,
                        flexShrink: 1,
                      }}>
                      {p.displayName ?? 'Anonymous'}
                    </Text>
                    {p.isMe ? (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          backgroundColor: tone === colors.text ? GOLD : tone,
                        }}>
                        <Text
                          style={{
                            color: IRON,
                            fontSize: 9,
                            fontWeight: '900',
                            letterSpacing: 1,
                          }}>
                          YOU
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      marginTop: 2,
                      color: tone,
                      opacity: tone === colors.text ? 0.6 : 1,
                      fontSize: 12,
                      fontWeight: '600',
                    }}>
                    {statusText}
                    {showProgress && p.liveProgress > 0
                      ? ` · ${Math.round(ratio * 100)}%`
                      : ''}
                  </Text>
                </View>
                <Text
                  style={{
                    color: tone,
                    opacity: tone === colors.text ? 0.75 : 1,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}>
                  ${p.stakeAmount}
                </Text>
              </View>
              {/* Per-participant live progress bar — only meaningful for
                  sensor-tracked step bets. Hidden for non-sensor (proof)
                  rows and for pending/settled-but-progress-unknown rows. */}
              {showProgress ? (
                <View style={{ marginTop: 8, marginLeft: 48 }}>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.text + '14',
                      overflow: 'hidden',
                    }}>
                    <View
                      style={{
                        width: `${ratio * 100}%`,
                        height: '100%',
                        backgroundColor: ringColor,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      marginTop: 4,
                      color: colors.text,
                      opacity: 0.55,
                      fontSize: 11,
                      fontVariant: ['tabular-nums'],
                    }}>
                    {Math.round(p.liveProgress).toLocaleString()} / {goal.toLocaleString()}
                    {!ahead
                      ? ` · need ${Math.max(0, goal - Math.round(p.liveProgress)).toLocaleString()} more`
                      : ' · cleared'}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SideStack({
  tone,
  label,
  total,
  count,
}: {
  tone: string;
  label: string;
  total: number;
  count: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: tone + '14',
      }}>
      <Text style={{ ...EYEBROW, color: tone }}>{label}</Text>
      <Text
        style={{
          marginTop: 6,
          color: tone,
          fontSize: 26,
          fontWeight: '800',
          letterSpacing: -0.7,
          fontVariant: ['tabular-nums'],
        }}>
        ${total}
      </Text>
      <Text style={{ marginTop: 2, color: tone, opacity: 0.7, fontSize: 12 }}>
        {count} {count === 1 ? 'taker' : 'takers'}
      </Text>
    </View>
  );
}

function Avatar({
  name,
  colors,
}: {
  name: string | null;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const letter = (name ?? '?')[0]?.toUpperCase() ?? '?';
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.text + '14',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>{letter}</Text>
    </View>
  );
}

function SessionStripSection({
  colors,
  participantId,
  onCheckIn,
}: {
  colors: ReturnType<typeof useThemeColors>;
  participantId: Id<'participants'>;
  onCheckIn: (forDate: string) => void;
}) {
  const strip = useQuery(api.proofs.sessionStrip, { participantId });
  if (!strip) return null;
  const { goal, totalDays, sessionsDone, cells, today } = strip;
  const required = Math.min(goal, totalDays);
  const onTrack = sessionsDone >= sessionIndexExpected(strip);
  const trackTone = onTrack ? LIME : EMBER;
  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="CalendarCheck" size={13} color={GOLD} />
        <Text style={{ ...EYEBROW, color: GOLD }}>SESSION CHECK-INS</Text>
      </View>
      <Text
        style={{
          marginTop: 6,
          color: colors.text,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.5,
          fontVariant: ['tabular-nums'],
        }}>
        {sessionsDone} of {required} <Text style={{ color: trackTone, fontSize: 13, fontWeight: '700' }}>
          {onTrack ? '· on track' : '· catch up'}
        </Text>
      </Text>
      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        }}>
        {cells.map((cell) => {
          const stateBg =
            cell.state === 'done'
              ? LIME + '24'
              : cell.state === 'disputed'
                ? EMBER + '24'
                : cell.state === 'today'
                  ? GOLD + '24'
                  : cell.state === 'missed'
                    ? EMBER + '14'
                    : colors.text + '0C';
          const stateBorder =
            cell.state === 'done'
              ? LIME
              : cell.state === 'disputed'
                ? EMBER
                : cell.state === 'today'
                  ? GOLD
                  : cell.state === 'missed'
                    ? EMBER + '60'
                    : colors.text + '20';
          const stateFg =
            cell.state === 'done'
              ? LIME
              : cell.state === 'disputed'
                ? EMBER
                : cell.state === 'today'
                  ? GOLD
                  : cell.state === 'missed'
                    ? EMBER
                    : colors.text;
          const d = new Date(cell.date);
          const day = d.toLocaleDateString([], { weekday: 'short' })[0];
          const num = d.getDate();
          const isInteractable =
            cell.state === 'today' || cell.state === 'missed';
          return (
            <Pressable
              key={cell.date}
              onPress={() => (isInteractable ? onCheckIn(cell.date) : undefined)}
              style={{
                width: 44,
                height: 56,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: stateBorder,
                backgroundColor: stateBg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: cell.state === 'upcoming' ? 0.5 : 1,
              }}>
              <Text
                style={{
                  color: stateFg,
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  opacity: 0.8,
                }}>
                {day}
              </Text>
              <Text
                style={{
                  color: stateFg,
                  fontSize: 17,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}>
                {num}
              </Text>
              {cell.state === 'done' ? (
                <Icon
                  name={cell.derivedFromPings ? 'MapPin' : 'Check'}
                  size={10}
                  color={LIME}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {cells.some((c) => c.state === 'today') ? (
        <Pressable
          onPress={() => onCheckIn(today)}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: GOLD + '18',
            borderWidth: 1,
            borderColor: GOLD + '40',
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}>
          <Icon name="Camera" size={14} color={GOLD} />
          <Text style={{ color: GOLD, fontWeight: '800', fontSize: 13 }}>
            Check in for today
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Expected sessions-done count by today's date — used to colour the
// "on track" / "catch up" hint. We expect one session per day elapsed,
// capped at the bet's goal.
function sessionIndexExpected(strip: {
  cells: { date: string; state: string }[];
  goal: number;
  today: string;
}): number {
  let elapsed = 0;
  for (const cell of strip.cells) {
    if (cell.date <= strip.today) elapsed += 1;
  }
  return Math.min(strip.goal, elapsed);
}

function ActionButton({
  label,
  tone,
  onPress,
  colors,
  flex,
  loading,
  disabled,
}: {
  label: string;
  tone: 'gold' | 'lime' | 'ember' | 'ghost';
  onPress?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  flex?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    tone === 'gold'
      ? GOLD
      : tone === 'lime'
        ? LIME
        : tone === 'ember'
          ? EMBER + '24'
          : 'transparent';
  const fg = tone === 'gold' || tone === 'lime' ? IRON : tone === 'ember' ? EMBER : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || loading || disabled}
      style={{
        height: 54,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: tone === 'ghost' ? 1 : 0,
        borderColor: colors.text + '20',
        opacity: disabled || loading ? 0.6 : 1,
        flex: flex ? 1 : undefined,
      }}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '800', fontSize: 15 }}>{label}</Text>
      )}
    </Pressable>
  );
}
