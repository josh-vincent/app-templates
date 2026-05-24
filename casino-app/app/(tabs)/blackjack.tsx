import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceHeader } from '@/components/BalanceHeader';
import { useBalance } from '@/contexts/BalanceContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { EMBER, GOLD, IRON, LIME } from '@/lib/theme';

// ---- Card / deck helpers --------------------------------------------------

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';
type Card = { rank: Rank; suit: Suit };

const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

const BET = 50;

function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  // Fisher–Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(c: Card): number {
  if (c.rank === 'A') return 11;
  if (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J' || c.rank === '10')
    return 10;
  return Number(c.rank);
}

function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = cards.reduce((s, c) => s + cardValue(c), 0);
  let aces = cards.filter((c) => c.rank === 'A').length;
  // Demote aces from 11 → 1 while bust.
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const soft = cards.some((c) => c.rank === 'A') && aces > 0 && total <= 21;
  return { total, soft };
}

type Phase = 'idle' | 'player' | 'dealer' | 'done';
type Outcome = 'win' | 'loss' | 'push' | 'blackjack' | null;

// ---- UI helpers -----------------------------------------------------------

function CardView({
  card,
  hidden,
}: {
  card?: Card;
  hidden?: boolean;
}) {
  const isRed = card && (card.suit === '♥' || card.suit === '♦');
  return (
    <View
      style={{
        width: 56,
        height: 80,
        marginRight: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: hidden ? '#2a313d' : '#dfe3da',
        backgroundColor: hidden ? '#1a1f27' : '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {hidden || !card ? (
        <Text style={{ color: GOLD, fontSize: 22, fontWeight: '800' }}>★</Text>
      ) : (
        <>
          <Text
            style={{
              color: isRed ? '#d12626' : '#0d1014',
              fontSize: 18,
              fontWeight: '800',
            }}>
            {card.rank}
          </Text>
          <Text
            style={{
              color: isRed ? '#d12626' : '#0d1014',
              fontSize: 22,
              marginTop: 2,
            }}>
            {card.suit}
          </Text>
        </>
      )}
    </View>
  );
}

// ---- Screen --------------------------------------------------------------

export default function BlackjackScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { balance, recordRound } = useBalance();

  const [deck, setDeck] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<Outcome>(null);

  const playerTotal = useMemo(() => handTotal(player).total, [player]);
  const dealerTotal = useMemo(() => handTotal(dealer).total, [dealer]);
  const canDeal = phase === 'idle' || phase === 'done';
  const canHit = phase === 'player' && playerTotal < 21;
  const canStand = phase === 'player';

  const settle = (
    finalPlayer: Card[],
    finalDealer: Card[]
  ): { outcome: Outcome; delta: number; detail: string } => {
    const p = handTotal(finalPlayer).total;
    const d = handTotal(finalDealer).total;
    const playerHasBlackjack = finalPlayer.length === 2 && p === 21;
    const dealerHasBlackjack = finalDealer.length === 2 && d === 21;

    if (playerHasBlackjack && !dealerHasBlackjack) {
      return {
        outcome: 'blackjack',
        delta: Math.floor(BET * 1.5),
        detail: `Blackjack! Dealer ${d}`,
      };
    }
    if (p > 21) {
      return { outcome: 'loss', delta: -BET, detail: `Bust at ${p}` };
    }
    if (d > 21) {
      return { outcome: 'win', delta: BET, detail: `Dealer bust at ${d}` };
    }
    if (p > d) {
      return { outcome: 'win', delta: BET, detail: `${p} vs ${d}` };
    }
    if (p < d) {
      return { outcome: 'loss', delta: -BET, detail: `${p} vs ${d}` };
    }
    return { outcome: 'push', delta: 0, detail: `Push at ${p}` };
  };

  const finalize = (
    finalPlayer: Card[],
    finalDealer: Card[],
    nextDeck: Card[]
  ) => {
    const res = settle(finalPlayer, finalDealer);
    setPhase('done');
    setOutcome(res.outcome);
    setDeck(nextDeck);
    recordRound({
      game: 'blackjack',
      outcome:
        res.outcome === 'blackjack'
          ? 'win'
          : (res.outcome ?? 'push'),
      delta: res.delta,
      detail: res.detail,
    });
  };

  const onDeal = () => {
    if (balance < BET) return;
    const d = freshDeck();
    const p1 = d.shift()!;
    const dl1 = d.shift()!;
    const p2 = d.shift()!;
    const dl2 = d.shift()!;
    const playerHand = [p1, p2];
    const dealerHand = [dl1, dl2];
    setDeck(d);
    setPlayer(playerHand);
    setDealer(dealerHand);
    setOutcome(null);

    const pTotal = handTotal(playerHand).total;
    const dTotal = handTotal(dealerHand).total;
    if (pTotal === 21 || dTotal === 21) {
      // Resolve naturals immediately.
      finalize(playerHand, dealerHand, d);
    } else {
      setPhase('player');
    }
  };

  const onHit = () => {
    if (!canHit) return;
    const nextDeck = [...deck];
    const card = nextDeck.shift();
    if (!card) return;
    const nextPlayer = [...player, card];
    setPlayer(nextPlayer);
    setDeck(nextDeck);
    const total = handTotal(nextPlayer).total;
    if (total >= 21) {
      // Auto-stand on 21 or bust; let the dealer (or settle) take over.
      if (total > 21) {
        finalize(nextPlayer, dealer, nextDeck);
      } else {
        onStandWith(nextPlayer, nextDeck);
      }
    }
  };

  const onStandWith = (currentPlayer: Card[], currentDeck: Card[]) => {
    let dl = [...dealer];
    const d = [...currentDeck];
    setPhase('dealer');
    while (handTotal(dl).total < 17) {
      const card = d.shift();
      if (!card) break;
      dl = [...dl, card];
    }
    setDealer(dl);
    finalize(currentPlayer, dl, d);
  };

  const onStand = () => {
    if (!canStand) return;
    onStandWith(player, deck);
  };

  const outcomeColor =
    outcome === 'win' || outcome === 'blackjack'
      ? LIME
      : outcome === 'loss'
        ? EMBER
        : colors.text;

  const outcomeLabel =
    outcome === 'blackjack'
      ? 'BLACKJACK!'
      : outcome === 'win'
        ? 'YOU WIN'
        : outcome === 'loss'
          ? 'YOU LOSE'
          : outcome === 'push'
            ? 'PUSH'
            : '';

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
            BLACKJACK · STAKE {BET}
          </Text>

          {/* Dealer area */}
          <View style={{ marginTop: 16 }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.7,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.8,
              }}>
              DEALER {phase === 'player' && dealer.length > 0 ? '· ?' : phase !== 'idle' ? `· ${dealerTotal}` : ''}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                marginTop: 8,
                minHeight: 90,
                alignItems: 'center',
              }}
              testID="dealer-hand">
              {dealer.length === 0 ? (
                <Text
                  style={{ color: colors.text, opacity: 0.4, fontSize: 14 }}>
                  No deal yet.
                </Text>
              ) : (
                dealer.map((c, i) => (
                  <CardView
                    key={`d-${i}`}
                    card={c}
                    hidden={phase === 'player' && i === 1}
                  />
                ))
              )}
            </View>
          </View>

          {/* Player area */}
          <View style={{ marginTop: 20 }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.7,
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.8,
              }}>
              YOU {player.length > 0 ? `· ${playerTotal}` : ''}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                marginTop: 8,
                minHeight: 90,
                alignItems: 'center',
              }}
              testID="player-hand">
              {player.length === 0 ? (
                <Text
                  style={{ color: colors.text, opacity: 0.4, fontSize: 14 }}>
                  Tap Deal to start.
                </Text>
              ) : (
                player.map((c, i) => <CardView key={`p-${i}`} card={c} />)
              )}
            </View>
          </View>

          {/* Outcome strip */}
          {phase === 'done' && outcome ? (
            <View
              testID="blackjack-result"
              style={{
                marginTop: 20,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: outcomeColor + '55',
                backgroundColor: outcomeColor + '14',
              }}>
              <Text
                style={{
                  color: outcomeColor,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.2,
                }}>
                {outcomeLabel}
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  color: outcomeColor,
                  fontSize: 14,
                  fontWeight: '700',
                }}>
                {`Player ${playerTotal} · Dealer ${dealerTotal}`}
              </Text>
            </View>
          ) : null}

          {/* Controls */}
          <View style={{ marginTop: 28, gap: 12 }}>
            {canDeal ? (
              <Pressable
                onPress={onDeal}
                disabled={balance < BET}
                accessibilityRole="button"
                accessibilityLabel="Deal new blackjack hand"
                testID="blackjack-deal"
                style={{
                  backgroundColor: balance >= BET ? GOLD : colors.text + '14',
                  paddingVertical: 16,
                  borderRadius: 16,
                  alignItems: 'center',
                  opacity: balance >= BET ? 1 : 0.6,
                }}>
                <Text
                  style={{
                    color: balance >= BET ? IRON : colors.text,
                    fontWeight: '900',
                    fontSize: 15,
                  }}>
                  {balance < BET
                    ? 'Not enough credits'
                    : `DEAL · −${BET}`}
                </Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={onHit}
                  disabled={!canHit}
                  accessibilityRole="button"
                  accessibilityLabel="Hit"
                  testID="blackjack-hit"
                  style={{
                    flex: 1,
                    backgroundColor: canHit ? GOLD : colors.text + '14',
                    paddingVertical: 16,
                    borderRadius: 16,
                    alignItems: 'center',
                    opacity: canHit ? 1 : 0.6,
                  }}>
                  <Text
                    style={{
                      color: canHit ? IRON : colors.text,
                      fontWeight: '900',
                      fontSize: 15,
                    }}>
                    HIT
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onStand}
                  disabled={!canStand}
                  accessibilityRole="button"
                  accessibilityLabel="Stand"
                  testID="blackjack-stand"
                  style={{
                    flex: 1,
                    backgroundColor: canStand
                      ? colors.text + '18'
                      : colors.text + '0a',
                    paddingVertical: 16,
                    borderRadius: 16,
                    alignItems: 'center',
                    opacity: canStand ? 1 : 0.5,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '900',
                      fontSize: 15,
                    }}>
                    STAND
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
