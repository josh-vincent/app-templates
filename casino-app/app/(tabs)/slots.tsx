import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceHeader } from '@/components/BalanceHeader';
import Icon from '@/components/Icon';
import { useBalance } from '@/contexts/BalanceContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { EMBER, GOLD, IRON, LIME } from '@/lib/theme';

// Symbols used by the slot machine. Order matters: the random reel uses
// uniform weights, but the payout table treats CHERRY as the "easy" payout
// and DIAMOND as the jackpot.
const SYMBOLS = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎'] as const;
type Symbol = (typeof SYMBOLS)[number];

const SPIN_COST = 25;

// Outcome rules — applied to the final reel triple.
//   - all three of the same symbol: pay table by symbol
//   - any two cherries: small win
//   - everything else: lose stake
const TRIPLE_PAYOUTS: Record<Symbol, number> = {
  '🍒': 100,
  '🍋': 150,
  '🔔': 200,
  '⭐': 400,
  '7️⃣': 750,
  '💎': 1500,
};
const PAIR_CHERRY_PAYOUT = 40;

const REEL_TICK_MS = 70;
const REEL_DURATIONS_MS = [900, 1300, 1700]; // staggered stop, left → right

function pickSymbol(): Symbol {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function evaluateSpin(reels: Symbol[]) {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    return { delta: TRIPLE_PAYOUTS[a] - SPIN_COST, label: `Triple ${a}` };
  }
  const cherryCount = reels.filter((s) => s === '🍒').length;
  if (cherryCount >= 2) {
    return {
      delta: PAIR_CHERRY_PAYOUT - SPIN_COST,
      label: `${cherryCount}× 🍒`,
    };
  }
  return { delta: -SPIN_COST, label: `${a} ${b} ${c}` };
}

function Reel({
  value,
  spinning,
  testID,
}: {
  value: Symbol;
  spinning: boolean;
  testID?: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        height: 110,
        marginHorizontal: 4,
        borderRadius: 16,
        backgroundColor: colors.text + '08',
        borderWidth: 1,
        borderColor: spinning ? GOLD : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: 56, opacity: spinning ? 0.6 : 1 }}>{value}</Text>
    </View>
  );
}

export default function SlotsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { balance, recordRound } = useBalance();

  const [reels, setReels] = useState<Symbol[]>(['🍒', '🍋', '🔔']);
  const [spinningMask, setSpinningMask] = useState<[boolean, boolean, boolean]>(
    [false, false, false]
  );
  const [lastResult, setLastResult] = useState<{
    delta: number;
    label: string;
  } | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finalRef = useRef<Symbol[]>(reels);

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    stopTimers.current.forEach((t) => clearTimeout(t));
    stopTimers.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const isSpinning = spinningMask.some(Boolean);
  const canSpin = !isSpinning && balance >= SPIN_COST;

  const onSpin = () => {
    if (!canSpin) return;
    cleanup();
    setLastResult(null);
    setSpinningMask([true, true, true]);

    // Pre-decide the final reel result. While spinning the UI shows fast
    // random symbols, then each reel "lands" on the precomputed final.
    const final: Symbol[] = [pickSymbol(), pickSymbol(), pickSymbol()];
    finalRef.current = final;

    // While any reel is still spinning, tick through random symbols.
    tickRef.current = setInterval(() => {
      setReels((prev) => {
        const next = [...prev] as Symbol[];
        setSpinningMask((mask) => {
          const m = mask;
          for (let i = 0; i < 3; i++) {
            if (m[i]) next[i] = pickSymbol();
          }
          return m;
        });
        return next;
      });
    }, REEL_TICK_MS);

    REEL_DURATIONS_MS.forEach((dur, idx) => {
      const t = setTimeout(() => {
        setReels((prev) => {
          const next = [...prev] as Symbol[];
          next[idx] = final[idx];
          return next;
        });
        setSpinningMask((mask) => {
          const m: [boolean, boolean, boolean] = [mask[0], mask[1], mask[2]];
          m[idx] = false;
          // When the last reel stops, evaluate the spin.
          if (!m[0] && !m[1] && !m[2]) {
            if (tickRef.current) {
              clearInterval(tickRef.current);
              tickRef.current = null;
            }
            const result = evaluateSpin(finalRef.current);
            setLastResult(result);
            recordRound({
              game: 'slots',
              outcome:
                result.delta > 0 ? 'win' : result.delta === 0 ? 'push' : 'loss',
              delta: result.delta,
              detail: `${finalRef.current.join(' ')} · ${result.label}`,
            });
          }
          return m;
        });
      }, dur);
      stopTimers.current.push(t);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <BalanceHeader />

        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <Text
            style={{
              color: colors.text,
              opacity: 0.55,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.3,
            }}>
            SLOTS · STAKE {SPIN_COST}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <Reel value={reels[0]} spinning={spinningMask[0]} testID="reel-0" />
            <Reel value={reels[1]} spinning={spinningMask[1]} testID="reel-1" />
            <Reel value={reels[2]} spinning={spinningMask[2]} testID="reel-2" />
          </View>

          {/* Spin button */}
          <Pressable
            onPress={onSpin}
            disabled={!canSpin}
            accessibilityRole="button"
            accessibilityLabel="Spin the reels"
            testID="slots-spin"
            style={{
              marginTop: 24,
              backgroundColor: canSpin ? GOLD : colors.text + '14',
              borderRadius: 18,
              paddingVertical: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              opacity: canSpin ? 1 : 0.6,
            }}>
            <Icon
              name={isSpinning ? 'Loader' : 'Play'}
              size={20}
              color={canSpin ? IRON : colors.text}
            />
            <Text
              style={{
                marginLeft: 8,
                color: canSpin ? IRON : colors.text,
                fontWeight: '900',
                fontSize: 16,
                letterSpacing: 0.4,
              }}>
              {isSpinning
                ? 'Spinning…'
                : balance < SPIN_COST
                  ? 'Not enough credits'
                  : `SPIN · −${SPIN_COST}`}
            </Text>
          </Pressable>

          {/* Last result strip */}
          {lastResult ? (
            <View
              testID="slots-result"
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 14,
                backgroundColor:
                  lastResult.delta > 0 ? LIME + '1a' : EMBER + '1a',
                borderWidth: 1,
                borderColor:
                  lastResult.delta > 0 ? LIME + '55' : EMBER + '55',
              }}>
              <Text
                style={{
                  color: lastResult.delta > 0 ? LIME : EMBER,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.2,
                }}>
                {lastResult.delta > 0 ? 'WIN' : 'LOSS'} · {lastResult.label}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  color: lastResult.delta > 0 ? LIME : EMBER,
                  fontSize: 24,
                  fontWeight: '900',
                  letterSpacing: -0.4,
                  fontVariant: ['tabular-nums'],
                }}>
                {lastResult.delta > 0
                  ? `+${lastResult.delta}`
                  : lastResult.delta}{' '}
                credits
              </Text>
            </View>
          ) : null}

          {/* Payouts cheat sheet */}
          <View
            style={{
              marginTop: 28,
              padding: 16,
              borderRadius: 14,
              backgroundColor: colors.text + '06',
              borderColor: colors.border,
              borderWidth: 1,
            }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.55,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.3,
              }}>
              PAYOUTS
            </Text>
            <View style={{ marginTop: 10 }}>
              {(Object.keys(TRIPLE_PAYOUTS) as Symbol[]).map((sym) => (
                <View
                  key={sym}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 4,
                  }}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    {sym} {sym} {sym}
                  </Text>
                  <Text
                    style={{
                      color: GOLD,
                      fontWeight: '800',
                      fontVariant: ['tabular-nums'],
                    }}>
                    +{TRIPLE_PAYOUTS[sym]}
                  </Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 4,
                }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  Any two 🍒
                </Text>
                <Text
                  style={{
                    color: GOLD,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}>
                  +{PAIR_CHERRY_PAYOUT}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
