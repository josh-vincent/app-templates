// Friend detail screen — tap a friend (from /friends, Today's
// FRIENDS' PROGRESS strip, or the participants list on a bet detail) to
// land here.
//
// Sections, top to bottom:
//   1. Hero — avatar, name, @handle, lifetime stats
//   2. HEAD-TO-HEAD — record between you + them + lifetime net
//   3. ACTIVE STAKES — their currently-running bets
//   4. HISTORY — their last 14d of settled bets
//   5. CTAs (side-by-side) — Challenge h2h | Dare them (naysayer)

import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { H2HSideBySide } from '@/components/friends/H2HSideBySide';
import Header from '@jv/ui';
import Icon from '@jv/ui';
import { PaceRing } from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getActivity } from '@/lib/activities';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const POKE_EMOJIS = ['👋', '🔥', '💪', '🏃', '🎯'] as const;

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const fmtMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;
const fmtSteps = (n: number) => Math.round(n).toLocaleString();

export default function FriendDetail() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const friendId = (id ?? '') as Id<'profiles'>;

  const friendsList = useQuery(api.friends.list);
  const friend = (friendsList ?? []).find((f: any) => f.profileId === friendId);
  const h2h = useQuery(
    api.friends.headToHeadRecord,
    id ? { otherUserId: friendId } : 'skip'
  );
  // Per-stake progress (rings + what's-left labels) for the friend.
  // Replaces the prior `activeForUser` fetch — `progressDetail` already
  // walks active stakes and includes goal/ratio/whatsLeft per row.
  const progress = useQuery(
    api.friends.progressDetail,
    id ? { friendId } : 'skip'
  );
  const history = useQuery(
    api.challenges.recentSettlementsForUser,
    id ? { userId: friendId } : 'skip'
  );

  // Hooks must be declared before any early return — moved up here from
  // their original spot below the loading/not-found guards.
  const sendPoke = useMutation(api.pokes.sendPoke);
  const [poking, setPoking] = React.useState<string | null>(null);

  const loading =
    friendsList === undefined ||
    h2h === undefined ||
    progress === undefined ||
    history === undefined;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <Header showBackButton title="Friend" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  if (!friend) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <Header showBackButton title="Friend" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Icon name="UserX" size={28} color={colors.text} />
          <Text
            style={{
              color: colors.text,
              fontSize: 17,
              fontWeight: '700',
              marginTop: 12,
              textAlign: 'center',
            }}>
            Not in your friends list
          </Text>
          <Text
            style={{
              color: colors.text,
              opacity: 0.55,
              fontSize: 13,
              marginTop: 6,
              textAlign: 'center',
              maxWidth: 280,
            }}>
            Add them from the search above to see their bets and stake against
            them.
          </Text>
        </View>
      </View>
    );
  }

  const initial = (friend.displayName ?? '?')[0]?.toUpperCase() ?? '?';
  const lifetimeNet = (friend.totalWon ?? 0) - (friend.totalForfeited ?? 0);

  async function pokeThem(emoji: string) {
    if (!friendId) return;
    try {
      setPoking(emoji);
      await sendPoke({ toUserId: friendId, emoji });
    } catch (e: any) {
      console.warn('[poke] failed', e?.message ?? e);
    } finally {
      // brief flash so the user gets feedback even if Convex returns instantly
      setTimeout(() => setPoking(null), 350);
    }
  }

  function challengeThem(shape: 'h2h' | 'naysayer') {
    router.push({
      pathname: '/(tabs)/challenges/create',
      params: {
        counterparty: friendId,
        betShape: shape,
        // Pass the name through so the activity step can address them
        // by name without a second profile lookup. Falls back gracefully
        // when the friend row doesn't have a display name yet.
        counterpartyName: friend?.displayName ?? '',
      },
    } as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}>
        {/* Back */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.text + '0d',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="ChevronLeft" size={18} color={colors.text} />
          </Pressable>
          <Text style={{ marginLeft: 12, ...EYEBROW, color: colors.text, opacity: 0.5 }}>
            FRIEND
          </Text>
        </View>

        {/* Hero */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: GOLD,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: IRON, fontSize: 26, fontWeight: '900' }}>{initial}</Text>
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: 26,
                fontWeight: '900',
                letterSpacing: -0.6,
              }}>
              {friend.displayName ?? 'Anonymous'}
            </Text>
            {friend.username ? (
              <Text style={{ color: colors.text, opacity: 0.55, fontSize: 13, marginTop: 2 }}>
                @{friend.username}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Pokes — featherweight nudge. Sends a push + queues a floating
            emoji on the recipient's screen. */}
        <View style={{ marginTop: 18 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginBottom: 8 }}>
            POKE
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {POKE_EMOJIS.map((emoji) => {
              const active = poking === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => pokeThem(emoji)}
                  disabled={!!poking}
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: 14,
                    backgroundColor: active ? GOLD : colors.text + '0c',
                    borderWidth: 1,
                    borderColor: active ? GOLD : colors.text + '14',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Lifetime stats */}
        <View
          style={{
            flexDirection: 'row',
            marginTop: 18,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: colors.text + '14',
          }}>
          <Stat
            label="LIFETIME WON"
            value={`+$${friend.totalWon ?? 0}`}
            color={LIME}
            textColor={colors.text}
          />
          <Stat
            label="FORFEITED"
            value={`−$${friend.totalForfeited ?? 0}`}
            color={EMBER}
            textColor={colors.text}
            alignEnd
          />
        </View>
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.text + '14',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>Net result</Text>
          <Text
            style={{
              color: lifetimeNet >= 0 ? LIME : EMBER,
              fontSize: 18,
              fontWeight: '900',
              fontVariant: ['tabular-nums'],
            }}>
            {lifetimeNet >= 0 ? '+' : '−'}${Math.abs(lifetimeNet)}
          </Text>
        </View>

        {/* Head-to-head */}
        <H2HSection h2h={h2h!} friendName={friend.displayName ?? 'Them'} colors={colors} />

        {/* Live side-by-side panels — one per open shared h2h stake. */}
        {((h2h!.shared ?? []) as Array<{
          challengeId: any;
          title: string;
          meStatus: string;
          themStatus: string;
        }>)
          .filter(
            (s) => s.meStatus === 'active' || s.themStatus === 'active'
          )
          .map((s) => (
            <H2HSideBySide
              key={String(s.challengeId)}
              challengeId={s.challengeId as Id<'challenges'>}
              title={s.title}
            />
          ))}

        {/* Active stakes — per-stake rings + what's-left from progressDetail. */}
        {(() => {
          const stakes: StakeShape[] = progress?.stakes ?? [];
          return (
            <>
              <Text
                style={{
                  ...EYEBROW,
                  color: colors.text,
                  opacity: 0.5,
                  marginTop: SECTION_GAP,
                }}>
                THEIR ACTIVE STAKES · {stakes.length}
              </Text>
              {stakes.length === 0 ? (
                <View
                  style={{
                    marginTop: 10,
                    padding: 18,
                    borderRadius: 16,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                  <Text
                    style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>
                    No active stakes
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {stakes.map((s, i) => (
                    <StakeRow
                      key={String(s.challengeId)}
                      stake={s}
                      friendName={friend.displayName ?? 'Anonymous'}
                      colors={colors}
                      first={i === 0}
                    />
                  ))}
                </View>
              )}
            </>
          );
        })()}

        {/* History */}
        <Text
          style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginTop: SECTION_GAP }}>
          LAST 14 DAYS · {history!.length}
        </Text>
        {history!.length === 0 ? (
          <View
            style={{
              marginTop: 10,
              padding: 18,
              borderRadius: 16,
              borderStyle: 'dashed',
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>
              Nothing settled lately.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            {history!.map((row, i) => {
              const won = row.status === 'won';
              return (
                <View
                  key={row.participantId}
                  style={{
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.text + '14',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: (won ? LIME : EMBER) + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}>
                    <Icon
                      name={won ? 'Check' : 'X'}
                      size={15}
                      color={won ? LIME : EMBER}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
                      {row.challengeTitle}
                    </Text>
                    <Text
                      style={{ color: colors.text, opacity: 0.55, fontSize: 12, marginTop: 2 }}>
                      {row.finalSteps != null
                        ? `${fmtSteps(row.finalSteps)} / ${fmtSteps(row.stepGoal)}`
                        : 'Settled'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: won ? LIME : EMBER,
                      fontWeight: '800',
                      fontSize: 14,
                    }}>
                    {won ? '+' : '−'}
                    {fmtMoney(row.stakeAmount)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky CTAs */}
      <View
        style={{
          position: 'absolute',
          left: PAGE_X,
          right: PAGE_X,
          bottom: insets.bottom + 12,
          flexDirection: 'row',
          gap: 10,
        }}>
        <Pressable
          onPress={() => challengeThem('h2h')}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 16,
            backgroundColor: GOLD,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}>
          <Icon name="Swords" size={16} color={IRON} />
          <Text style={{ color: IRON, fontWeight: '900', fontSize: 14 }}>Head-to-head</Text>
        </Pressable>
        <Pressable
          onPress={() => challengeThem('naysayer')}
          style={{
            flex: 1,
            height: 54,
            borderRadius: 16,
            backgroundColor: colors.text,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
          }}>
          <Icon name="Flame" size={16} color={colors.bg} />
          <Text style={{ color: colors.bg, fontWeight: '900', fontSize: 14 }}>
            Dare them
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// Shape of a single stake row from `api.friends.progressDetail`. Mirrored
// locally so we get type help inside the map callbacks even though
// `useQuery` returns `any` from the persona wrapper.
type StakeShape = {
  challengeId: Id<'challenges'>;
  title: string;
  activityKey: string;
  betShape: string;
  stakeAmount: number;
  goal: number;
  progress: number;
  progressRatio: number;
  hoursLeft: number;
  atRisk: boolean;
  ahead: boolean;
  whatsLeft: { label: string };
};

// Per-stake row for "their active stakes". Fallback in-file render —
// Group 3 owns the shared `components/friends/FriendStakeRow.tsx` and
// `WhatsLeftBreakdown.tsx`, but those don't exist when this file lands.
// Mirrors the planned layout: avatar/activity icon, title + what's-left
// label, PaceRing on the right.
function StakeRow({
  stake,
  friendName,
  colors,
  first,
}: {
  stake: StakeShape;
  friendName: string;
  colors: ReturnType<typeof useThemeColors>;
  first: boolean;
}) {
  const a = getActivity(stake.activityKey);
  const ringColor = stake.atRisk ? EMBER : stake.ahead ? GOLD : LIME;
  const ratio = Math.max(0, Math.min(1, stake.progressRatio ?? 0));
  void friendName; // reserved for future avatar wiring once shared row lands
  return (
    <Pressable
      onPress={() =>
        router.push(`/(tabs)/challenges/${stake.challengeId}` as any)
      }
      style={{
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.text + '14',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.text + '14',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
        <Icon name={a.icon as any} size={16} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
          {stake.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            opacity: 0.6,
            fontSize: 12,
            marginTop: 2,
          }}>
          {stake.whatsLeft.label}
        </Text>
      </View>
      <View style={{ alignItems: 'center', marginLeft: 10 }}>
        <PaceRing
          ratio={ratio}
          color={ringColor}
          trackColor={BONE}
          size={36}
          stroke={4}
        />
        <Text
          style={{
            marginTop: 4,
            color: EMBER,
            fontWeight: '800',
            fontSize: 11,
            fontVariant: ['tabular-nums'],
          }}>
          {fmtMoney(stake.stakeAmount)}
        </Text>
      </View>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  color,
  textColor,
  alignEnd,
}: {
  label: string;
  value: string;
  color: string;
  textColor: string;
  alignEnd?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: alignEnd ? 'flex-end' : 'flex-start' }}>
      <Text style={{ ...EYEBROW, color: color, opacity: 0.85 }}>{label}</Text>
      <Text
        style={{
          color,
          fontSize: 26,
          fontWeight: '900',
          letterSpacing: -0.8,
          marginTop: 4,
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}

function H2HSection({
  h2h,
  friendName,
  colors,
}: {
  h2h: {
    meWon: number;
    themWon: number;
    openCount: number;
    netToMe: number;
    shared: Array<{
      challengeId: any;
      title: string;
      stakeAmount: number;
      endsAt: number;
      meStatus: string;
      themStatus: string;
    }>;
  };
  friendName: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const total = h2h.meWon + h2h.themWon;
  const meRatio = total > 0 ? h2h.meWon / total : 0.5;
  const youAhead = h2h.meWon > h2h.themWon;
  const tied = h2h.meWon === h2h.themWon;

  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>HEAD-TO-HEAD</Text>

      {total === 0 && h2h.openCount === 0 ? (
        <View
          style={{
            marginTop: 10,
            padding: 18,
            borderRadius: 16,
            borderStyle: 'dashed',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13 }}>
            You haven't faced off yet. Start one below.
          </Text>
        </View>
      ) : (
        <View
          style={{
            marginTop: 10,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: colors.text + '0a',
            borderWidth: 1,
            borderColor: colors.text + '14',
          }}>
          <View style={{ flexDirection: 'row' }}>
            <View
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                alignItems: 'center',
                borderRightWidth: 1,
                borderRightColor: colors.text + '14',
                backgroundColor: youAhead ? LIME + '12' : 'transparent',
              }}>
              <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>YOU</Text>
              <Text
                style={{
                  color: LIME,
                  fontSize: 32,
                  fontWeight: '900',
                  marginTop: 2,
                  fontVariant: ['tabular-nums'],
                }}>
                {h2h.meWon}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 16,
                alignItems: 'center',
                backgroundColor: !youAhead && !tied ? EMBER + '12' : 'transparent',
              }}>
              <Text
                numberOfLines={1}
                style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>
                {friendName.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: EMBER,
                  fontSize: 32,
                  fontWeight: '900',
                  marginTop: 2,
                  fontVariant: ['tabular-nums'],
                }}>
                {h2h.themWon}
              </Text>
            </View>
          </View>
          {/* Net to me / open count */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: colors.text + '14',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}>
            <Text style={{ color: colors.text, opacity: 0.6, fontSize: 12 }}>
              {h2h.openCount > 0
                ? `${h2h.openCount} open between you`
                : tied
                  ? 'Tied'
                  : youAhead
                    ? `You lead by ${h2h.meWon - h2h.themWon}`
                    : `${friendName} leads by ${h2h.themWon - h2h.meWon}`}
            </Text>
            <Text
              style={{
                color: h2h.netToMe >= 0 ? LIME : EMBER,
                fontWeight: '800',
                fontSize: 13,
                fontVariant: ['tabular-nums'],
              }}>
              {h2h.netToMe >= 0 ? '+' : '−'}${Math.abs(h2h.netToMe)}
            </Text>
          </View>

          {/* Recent shared (top 5) */}
          {h2h.shared.slice(0, 5).map((s, i) => (
            <Pressable
              key={String(s.challengeId)}
              onPress={() => router.push(`/(tabs)/challenges/${s.challengeId}` as any)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                borderTopWidth: 1,
                borderTopColor: colors.text + '14',
              }}>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                  {s.title}
                </Text>
                <Text style={{ color: colors.text, opacity: 0.5, fontSize: 11, marginTop: 1 }}>
                  You: {s.meStatus} · Them: {s.themStatus}
                </Text>
              </View>
              <Text
                style={{
                  color:
                    s.meStatus === 'won' && s.themStatus === 'forfeit'
                      ? LIME
                      : s.themStatus === 'won' && s.meStatus === 'forfeit'
                        ? EMBER
                        : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}>
                ${s.stakeAmount}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
