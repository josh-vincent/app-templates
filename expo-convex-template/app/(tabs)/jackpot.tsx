import { useMutation, useQuery } from '@/lib/persona-convex';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { EMBER, GOLD, IRON } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 32;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };
const TIER_ORDER: Tier[] = ['easy', 'medium', 'hard'];
const TIER_LABELS: Record<Tier, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
// Mirror of jackpotTiers.TIER_THRESHOLDS — kept here for client-only copy.
// If the backend numbers shift, update both.
const TIER_THRESHOLDS = { easy: 1, medium: 3, hard: 7 } as const;

type Tier = 'easy' | 'medium' | 'hard';
type Scope = 'friends' | 'region' | 'global';

type Cell = {
  scope: Scope;
  scopeKey: string;
  tier: Tier;
  pool: { _id: string; total: number; settlesAt: number } | null;
  total: number;
  eligibleWinners: number;
  contributorCount: number;
  mySharePct: number | null;
  myShare: number | null;
  eligible: boolean;
  threshold: number;
  nextSettlesAt: number;
};

function fmtMoneyBig(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(fraction: number) {
  const p = fraction * 100;
  if (p >= 10) return `${Math.round(p)}%`;
  if (p >= 1) return `${p.toFixed(1)}%`;
  return `${p.toFixed(2)}%`;
}

function useCountdown(target: number | undefined | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const ms = Math.max(0, target - now);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { ms, days, hours, minutes };
}

function fmtCountdown(c: ReturnType<typeof useCountdown>) {
  if (!c) return null;
  if (c.days > 0) return `${c.days}d ${c.hours % 24}h`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m`;
  if (c.minutes > 0) return `${c.minutes}m`;
  return 'now';
}

// Pick the lowest tier the user is NOT yet eligible for; null when they're
// already at the top tier.
function nextLockedTier(eligibility: Record<Tier, boolean>): Tier | null {
  for (const t of TIER_ORDER) if (!eligibility[t]) return t;
  return null;
}

export default function JackpotScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const board = useQuery(api.jackpot.tierBoard, {});
  const aboutToForfeit = useQuery(api.jackpot.aboutToForfeit, {});
  const history = useQuery(api.jackpot.history, {});
  const watches = useQuery(api.watches.list, {});

  const setForPool = useMutation(api.watches.setForPool);
  const clearWatch = useMutation(api.watches.clear);

  const [expanded, setExpanded] = useState<Scope | null>(null);

  const watchByPool = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of watches ?? []) {
      if (w.targetKind === 'pool' && w.poolId) {
        m.set(w.poolId as unknown as string, w._id as unknown as string);
      }
    }
    return m;
  }, [watches]);

  // Group cells by scope. Order is fixed: friends, region, global.
  const grouped = useMemo(() => {
    const map: Record<Scope, Cell[]> = { friends: [], region: [], global: [] };
    for (const c of (board?.cells ?? []) as Cell[]) {
      map[c.scope].push(c);
    }
    for (const s of Object.keys(map) as Scope[]) {
      map[s].sort(
        (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
      );
    }
    return map;
  }, [board]);

  // Sum totals across all cells — drives the empty-invitation hero.
  const allPoolTotal = useMemo(() => {
    const cells = (board?.cells ?? []) as Cell[];
    return cells.reduce((s, c) => s + c.total, 0);
  }, [board]);

  // Soonest settle across any open pool — header countdown.
  const soonestSettle = useMemo(() => {
    const cells = (board?.cells ?? []) as Cell[];
    let min: number | null = null;
    for (const c of cells) {
      if (!c.pool) continue;
      if (min == null || c.pool.settlesAt < min) min = c.pool.settlesAt;
    }
    return min;
  }, [board]);
  const headerCountdown = useCountdown(soonestSettle ?? undefined);

  const eligibility = (board?.eligibility?.tiers ?? {
    easy: false,
    medium: false,
    hard: false,
  }) as Record<Tier, boolean>;
  const settledCount = board?.eligibility?.settledCount ?? 0;
  const lockedNext = nextLockedTier(eligibility);
  const countryCode = board?.countryCode ?? null;

  async function toggleWatchScope(scope: Scope) {
    const cells = grouped[scope].filter((c) => c.pool);
    const anyWatched = cells.some((c) =>
      watchByPool.has(c.pool!._id as unknown as string)
    );
    if (anyWatched) {
      for (const c of cells) {
        const id = watchByPool.get(c.pool!._id as unknown as string);
        if (id) await clearWatch({ id: id as any });
      }
    } else {
      for (const c of cells) {
        await setForPool({
          poolId: c.pool!._id as any,
          alertMinutesBefore: 60,
        });
      }
    }
  }

  function isWatched(scope: Scope): boolean {
    const cells = grouped[scope].filter((c) => c.pool);
    if (cells.length === 0) return false;
    return cells.every((c) =>
      watchByPool.has(c.pool!._id as unknown as string)
    );
  }

  // Loading skeleton for first paint.
  if (board === undefined) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: PAGE_X, paddingTop: 4 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="Trophy" size={14} color={GOLD} />
            <Text style={{ ...EYEBROW, color: GOLD }}>JACKPOTS</Text>
          </View>
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
          <SkeletonCard colors={colors} />
        </View>
      </View>
    );
  }

  // True empty state: every pool is $0. The user might or might not be in
  // the system yet — either way, the page should sell the act of betting.
  const showInvitation = allPoolTotal === 0 && settledCount === 0;

  // Friends scope is always visible (it'll just say "Bet with a friend to
  // start your pool" if no contributions). Region scope hides only when
  // BOTH the user has no countryCode AND no contributions to it.
  const regionHasContent =
    grouped.region.length > 0 && grouped.region.some((c) => c.total > 0);
  const showRegion = !!countryCode || regionHasContent;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}>
        <View
          style={{
            paddingTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="Trophy" size={14} color={GOLD} />
            <Text style={{ ...EYEBROW, color: GOLD }}>JACKPOTS</Text>
          </View>
          {soonestSettle ? (
            <Text style={{ color: colors.text, opacity: 0.55, fontSize: 12 }}>
              next settle · {fmtCountdown(headerCountdown)}
            </Text>
          ) : null}
        </View>

        {showInvitation ? (
          <InvitationHero colors={colors} />
        ) : (
          <Image
            source={SCENARIO_MASCOTS.jackpotRunPool}
            resizeMode="cover"
            style={{
              width: '100%',
              height: 156,
              borderRadius: 18,
              marginTop: 14,
              marginBottom: 12,
              backgroundColor: colors.text + '10',
            }}
          />
        )}

        {/* v3 simplified: only the Friends pool is visible to the user.
            Region + Global pools keep filling on the backend (settle.ts
            still routes forfeits there) but they don't render until a
            future release. */}
        <ScopeCard
          scope="friends"
          title="Friends"
          subline={
            grouped.friends.some((c) => c.total > 0)
              ? 'Pool of forfeits from friends. Winners split it.'
              : 'Bet with a friend to start your pool'
          }
          cells={grouped.friends}
          eligibility={eligibility}
          isWatched={isWatched('friends')}
          isExpanded={expanded === 'friends'}
          onToggleExpand={() =>
            setExpanded((e) => (e === 'friends' ? null : 'friends'))
          }
          onToggleWatch={() => toggleWatchScope('friends')}
          colors={colors}
        />

        <Text
          style={{
            marginTop: 12,
            color: colors.text,
            opacity: 0.4,
            fontSize: 11,
            lineHeight: 15,
          }}>
          Country and global pools come later. Until then, your forfeits
          still feed them in the background.
        </Text>

        <EligibilityLegend
          colors={colors}
          settledCount={settledCount}
          lockedNext={lockedNext}
          eligibility={eligibility}
        />

        <Text
          style={{
            ...EYEBROW,
            color: colors.text,
            opacity: 0.5,
            marginTop: SECTION_GAP,
            marginBottom: 6,
          }}>
          ABOUT TO FORFEIT
          {(aboutToForfeit?.length ?? 0) > 0
            ? ` · ${aboutToForfeit!.length}`
            : ''}
        </Text>
        {(aboutToForfeit ?? []).length === 0 ? (
          <Text
            style={{
              marginTop: 6,
              color: colors.text,
              opacity: 0.4,
              fontSize: 13,
            }}>
            Nobody&apos;s bleeding right now.
          </Text>
        ) : (
          <View>
            {(aboutToForfeit as any[]).map((row: any, i: number) => (
              <ForfeitRow
                key={row.participantId}
                row={row}
                isFirst={i === 0}
                colors={colors}
              />
            ))}
          </View>
        )}

        <Text
          style={{
            ...EYEBROW,
            color: colors.text,
            opacity: 0.5,
            marginTop: SECTION_GAP,
            marginBottom: 4,
          }}>
          PAST POOLS{' '}
          {(history?.length ?? 0) > 0 ? `· ${history!.length}` : ''}
        </Text>

        {(history ?? []).length === 0 ? (
          <Text
            style={{
              marginTop: 12,
              color: colors.text,
              opacity: 0.4,
              fontSize: 13,
            }}>
            No settled pools yet.
          </Text>
        ) : (
          <View>
            {((history ?? []) as any[]).map((p: any, i: number) => {
              const perWinner =
                p.winnerCount > 0 ? p.total / p.winnerCount : 0;
              return (
                <View
                  key={p._id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.text + '14',
                  }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 15,
                        fontWeight: '700',
                      }}>
                      {p.settledAt
                        ? new Date(p.settledAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        color: colors.text,
                        opacity: 0.5,
                        fontSize: 12,
                      }}>
                      {p.winnerCount} winner
                      {p.winnerCount === 1 ? '' : 's'} ·{' '}
                      {fmtMoneyBig(perWinner)} each
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: GOLD,
                      fontWeight: '800',
                      fontSize: 18,
                      fontVariant: ['tabular-nums'],
                    }}>
                    {fmtMoneyBig(p.total)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InvitationHero({
  colors,
}: {
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/challenges/create')}
      style={{
        marginTop: 14,
        marginBottom: 8,
        padding: 22,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: GOLD + '40',
        backgroundColor: GOLD + '0e',
      }}>
      <Image
        source={SCENARIO_MASCOTS.jackpotRunPool}
        resizeMode="cover"
        style={{
          width: '100%',
          height: 130,
          borderRadius: 12,
          marginBottom: 16,
          backgroundColor: colors.text + '10',
        }}
      />
      <Text style={{ ...EYEBROW, color: GOLD }}>NOTHING IN THE POT YET</Text>
      <Text
        style={{
          marginTop: 6,
          color: colors.text,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.5,
          lineHeight: 28,
        }}>
        Place a stake.{'\n'}Forfeits build the pot.{'\n'}Finishers split it.
      </Text>
      <View
        style={{
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        <Text style={{ color: GOLD, fontSize: 14, fontWeight: '700' }}>
          Place your first bet
        </Text>
        <Icon name="ArrowRight" size={14} color={GOLD} />
      </View>
    </Pressable>
  );
}

function ScopeCard({
  scope: _scope,
  title,
  subline,
  cells,
  eligibility,
  isWatched,
  isExpanded,
  onToggleExpand,
  onToggleWatch,
  colors,
  disabled,
}: {
  scope: Scope;
  title: string;
  subline: string;
  cells: Cell[];
  eligibility: Record<Tier, boolean>;
  isWatched: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleWatch: () => void;
  colors: ReturnType<typeof useThemeColors>;
  disabled?: boolean;
}) {
  const total = cells.reduce((s, c) => s + c.total, 0);
  const anyEligible = TIER_ORDER.some((t) => eligibility[t]);
  // Best concrete share + percentage across the scope's eligible tiers.
  // Pick the cell with the highest projected share so the displayed
  // number is the most generous accurate read.
  const best = useMemo(() => {
    let bestShare: number | null = null;
    let bestPct: number | null = null;
    for (const c of cells) {
      if (!c.eligible) continue;
      if (c.mySharePct == null) continue;
      if (bestPct == null || c.mySharePct > bestPct) {
        bestPct = c.mySharePct;
        bestShare = c.myShare;
      }
    }
    return { share: bestShare, pct: bestPct };
  }, [cells]);
  const lockedNext = nextLockedTier(eligibility);
  // Always honor cell.nextSettlesAt — server fills it in even when no
  // pool exists yet, so the countdown is never blank.
  const settlesAt = useMemo(() => {
    let min: number | null = null;
    for (const c of cells) {
      const at = c.nextSettlesAt;
      if (at == null) continue;
      if (min == null || at < min) min = at;
    }
    return min;
  }, [cells]);
  const cd = useCountdown(settlesAt);

  const allLocked = !anyEligible || disabled;
  const accent = allLocked ? colors.text : GOLD;

  return (
    <Pressable
      onPress={disabled ? undefined : onToggleExpand}
      style={{
        marginTop: 14,
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: allLocked ? colors.text + '14' : GOLD + '30',
        backgroundColor: allLocked ? colors.text + '04' : GOLD + '08',
        opacity: disabled ? 0.55 : 1,
      }}>
      {/* Header row: scope label + bell */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text style={{ ...EYEBROW, color: accent, opacity: allLocked ? 0.6 : 1 }}>
          {title.toUpperCase()}
        </Text>
        {!allLocked && cells.some((c) => c.pool) ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onToggleWatch();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              isWatched ? `Unwatch ${title}` : `Watch ${title}`
            }>
            <Icon
              name={isWatched ? 'Bell' : 'BellOff'}
              size={16}
              color={isWatched ? GOLD : colors.text + '99'}
            />
          </Pressable>
        ) : null}
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          marginTop: 4,
          color: accent,
          opacity: allLocked ? 0.5 : 1,
          fontSize: 56,
          fontWeight: '900',
          letterSpacing: -2,
          fontVariant: ['tabular-nums'],
        }}>
        {fmtMoneyBig(total)}
      </Text>

      <Text
        style={{
          marginTop: 2,
          color: colors.text,
          opacity: allLocked ? 0.4 : 0.55,
          fontSize: 12,
        }}>
        {subline}
      </Text>

      {/* Tier eligibility chips — three small dots so the user can see
          at a glance which sub-pools they're in. */}
      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
        {TIER_ORDER.map((t) => {
          const ok = eligibility[t];
          return (
            <View
              key={t}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: ok ? GOLD + '60' : colors.text + '20',
              }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: ok ? GOLD : colors.text + '40',
                }}
              />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 0.6,
                  color: ok ? GOLD : colors.text + '80',
                }}>
                {TIER_LABELS[t].toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Bottom strip: settles-in + your share or gate hint */}
      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.text + '12',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
        <View>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
            SETTLES IN
          </Text>
          <Text
            style={{
              marginTop: 2,
              color: colors.text,
              fontSize: 16,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}>
            {fmtCountdown(cd) ?? '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', flex: 1, paddingLeft: 12 }}>
          {anyEligible && best.pct != null ? (
            <>
              <Text style={{ ...EYEBROW, color: GOLD, opacity: 0.85 }}>
                YOUR SHARE
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  color: GOLD,
                  fontSize: 22,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                  fontVariant: ['tabular-nums'],
                }}>
                {fmtPct(best.pct)}
              </Text>
              {best.share != null && best.share > 0 ? (
                <Text
                  style={{
                    marginTop: 1,
                    color: GOLD,
                    opacity: 0.7,
                    fontSize: 11,
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                  }}>
                  {fmtMoneyBig(best.share)} today
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={{ ...EYEBROW, color: EMBER, opacity: 0.85 }}>
                LOCKED
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  marginTop: 2,
                  color: EMBER,
                  fontSize: 12,
                  fontWeight: '600',
                  textAlign: 'right',
                  lineHeight: 16,
                }}>
                {gateHint(eligibility, lockedNext)}
              </Text>
            </>
          )}
        </View>
      </View>

      {isExpanded ? (
        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.text + '12',
          }}>
          {cells.map((c, i) => (
            <TierRow key={c.tier} cell={c} isFirst={i === 0} colors={colors} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function gateHint(
  _eligibility: Record<Tier, boolean>,
  lockedNext: Tier | null
): string {
  if (!lockedNext) return 'You qualify for every tier.';
  const need = TIER_THRESHOLDS[lockedNext];
  return `Win ${need} bet${need === 1 ? '' : 's'} in 30 days for ${TIER_LABELS[lockedNext].toLowerCase()}.`;
}

function TierRow({
  cell,
  isFirst,
  colors,
}: {
  cell: Cell;
  isFirst: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '0c',
      }}>
      <Text
        style={{
          flex: 1,
          color: cell.eligible ? colors.text : colors.text + '80',
          fontSize: 13,
          fontWeight: '700',
        }}>
        {TIER_LABELS[cell.tier]}{' '}
        <Text
          style={{
            color: colors.text + '70',
            fontSize: 11,
            fontWeight: '600',
          }}>
          · {cell.eligibleWinners} winner
          {cell.eligibleWinners === 1 ? '' : 's'}
        </Text>
      </Text>
      <Text
        style={{
          color: cell.eligible ? GOLD : colors.text + '60',
          fontSize: 14,
          fontWeight: '800',
          fontVariant: ['tabular-nums'],
          marginRight: 12,
        }}>
        {fmtMoneyBig(cell.total)}
      </Text>
      <Text
        style={{
          color:
            cell.eligible && cell.mySharePct != null
              ? GOLD
              : colors.text + '50',
          fontSize: 12,
          fontWeight: '700',
          minWidth: 56,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}>
        {cell.eligible && cell.mySharePct != null
          ? fmtPct(cell.mySharePct)
          : '—'}
      </Text>
    </View>
  );
}

function EligibilityLegend({
  colors,
  settledCount,
  lockedNext,
  eligibility,
}: {
  colors: ReturnType<typeof useThemeColors>;
  settledCount: number;
  lockedNext: Tier | null;
  eligibility: Record<Tier, boolean>;
}) {
  const allUnlocked = TIER_ORDER.every((t) => eligibility[t]);
  return (
    <View
      style={{
        marginTop: 18,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.text + '14',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
        <Icon name="Info" size={12} color={colors.text + '99'} />
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>
          HOW SHARES UNLOCK
        </Text>
      </View>
      <Text
        style={{
          marginTop: 6,
          color: colors.text,
          opacity: 0.7,
          fontSize: 12,
          lineHeight: 17,
        }}>
        Win bets in the last 30 days to unlock pool tiers.{' '}
        <Text style={{ fontWeight: '700' }}>1</Text> for easy ·{' '}
        <Text style={{ fontWeight: '700' }}>3</Text> for medium ·{' '}
        <Text style={{ fontWeight: '700' }}>7</Text> for hard. Forfeits
        don&apos;t count.
      </Text>
      <Text
        style={{
          marginTop: 6,
          color: allUnlocked ? GOLD : EMBER,
          fontSize: 12,
          fontWeight: '700',
        }}>
        {allUnlocked
          ? `You're at ${settledCount} wins/30d. Every tier in reach.`
          : lockedNext
            ? `${settledCount} wins/30d so far. Win ${TIER_THRESHOLDS[lockedNext] - settledCount} more for ${TIER_LABELS[lockedNext].toLowerCase()}.`
            : ''}
      </Text>
    </View>
  );
}

function ForfeitRow({
  row,
  isFirst,
  colors,
}: {
  row: any;
  isFirst: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const cd = useCountdown(row.endsAt);
  const initial = (row.displayName ?? '?')[0]?.toUpperCase() ?? '?';
  return (
    <Pressable
      onPress={() =>
        router.push(`/(tabs)/challenges/${row.challengeId}` as any)
      }
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.text + '14',
      }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: EMBER + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: EMBER, fontWeight: '800', fontSize: 13 }}>
          {initial}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          numberOfLines={1}
          style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
          {row.displayName ?? 'Anonymous'} · {row.title}
        </Text>
        <Text
          style={{
            marginTop: 2,
            color: EMBER,
            opacity: 0.85,
            fontSize: 12,
          }}>
          {fmtCountdown(cd) ?? 'now'} · {row.shortReason}
        </Text>
      </View>
      <Text
        style={{
          color: EMBER,
          fontWeight: '800',
          fontSize: 16,
          fontVariant: ['tabular-nums'],
        }}>
        ${row.stakeAmount}
      </Text>
    </Pressable>
  );
}

function SkeletonCard({
  colors,
}: {
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={{
        marginTop: 14,
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.text + '14',
      }}>
      <View
        style={{
          width: 70,
          height: 11,
          borderRadius: 4,
          backgroundColor: colors.text + '10',
        }}
      />
      <View
        style={{
          marginTop: 8,
          width: 180,
          height: 48,
          borderRadius: 8,
          backgroundColor: colors.text + '10',
        }}
      />
      <View
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.text + '12',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        <View
          style={{
            width: 80,
            height: 30,
            borderRadius: 6,
            backgroundColor: colors.text + '10',
          }}
        />
        <View
          style={{
            width: 80,
            height: 30,
            borderRadius: 6,
            backgroundColor: colors.text + '10',
          }}
        />
      </View>
    </View>
  );
}
