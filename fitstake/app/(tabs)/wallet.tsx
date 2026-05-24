import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import type { PurchasesPackage, PurchasesStoreProduct } from 'react-native-purchases';

type PurchasesProductLike = PurchasesStoreProduct;
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useRevenueCat } from '@/components/RevenueCatProvider';
import { SkeletonBar, SkeletonCard } from '@jv/ui';
import { useDevPersona } from '@/contexts/DevPersonaContext';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { SKU_ORDER, SKU_TO_CREDIT } from '@/convex/iapSkus';
import { SCENARIO_MASCOTS, WALLET_LEVEL_MASCOTS } from '@/lib/fitstakeImages';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { EMBER, GOLD, LIME, SKY } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const MOCK_TOP_UP_AMOUNTS = [10, 25, 50, 100];

// After a real IAP succeeds, wait this long for the webhook to credit the
// wallet before falling back to a "still processing" hint.
const CREDIT_TIMEOUT_MS = 30_000;

const TX_META: Record<string, { icon: string; color: string; label: string }> = {
  stake: { icon: 'Target', color: EMBER, label: 'Staked' },
  refund: { icon: 'CornerUpLeft', color: SKY, label: 'Refund' },
  jackpotWin: { icon: 'Trophy', color: GOLD, label: 'Jackpot win' },
  forfeit: { icon: 'TrendingDown', color: EMBER, label: 'Forfeit' },
  topup: { icon: 'Plus', color: LIME, label: 'Top up' },
};

const WALLET_LEVELS = [
  { eyebrow: 'LEVEL 1 · RESET', tone: EMBER },
  { eyebrow: 'LEVEL 2 · COMEBACK', tone: EMBER },
  { eyebrow: 'LEVEL 3 · STABILIZE', tone: EMBER },
  { eyebrow: 'LEVEL 4 · IN RANGE', tone: GOLD },
  { eyebrow: 'LEVEL 5 · EVEN', tone: GOLD },
  { eyebrow: 'LEVEL 6 · EDGE', tone: LIME },
  { eyebrow: 'LEVEL 7 · HEAT', tone: LIME },
  { eyebrow: 'LEVEL 8 · DOMINATING', tone: LIME },
  { eyebrow: 'LEVEL 9 · CHAMPIONSHIP', tone: GOLD },
  { eyebrow: 'LEVEL 10 · TOP BOARD', tone: GOLD },
] as const;

function walletLevelFor(won: number, lost: number) {
  const net = won - lost;
  const total = won + lost;
  if (total <= 0) return 4;
  if (net < 0) {
    const lossShare = lost / total;
    if (lossShare >= 0.85) return 0;
    if (lossShare >= 0.72) return 1;
    if (lossShare >= 0.6) return 2;
    return 3;
  }
  if (net === 0) return 4;
  const winShare = won / total;
  if (winShare < 0.6) return 5;
  if (winShare < 0.72) return 6;
  if (winShare < 0.82) return 7;
  if (winShare < 0.9) return 8;
  return 9;
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const me = useQuery(api.users.me);
  const txs = useQuery(api.wallet.transactions);
  const topup = useMutation(api.wallet.topUp);
  const { persona } = useDevPersona();
  const rc = useRevenueCat();

  // `busy` holds either a mock amount (number) or a RC product id (string)
  // while a purchase is in flight. Null when idle.
  const [busy, setBusy] = useState<number | string | null>(null);
  // After a RC purchase, the client just waits for the webhook to credit
  // the wallet. Show a "Crediting…" hint until balance changes or we time
  // out. Null when idle.
  const [crediting, setCrediting] = useState<{
    productId: string;
    startedBalance: number;
  } | null>(null);

  const currentBalance = me?.walletBalance ?? 0;
  const creditingRef = useRef(crediting);
  creditingRef.current = crediting;

  // Clear the "Crediting…" hint as soon as the reactive balance moves OR
  // we hit the timeout.
  useEffect(() => {
    if (!crediting) return;
    if (currentBalance > crediting.startedBalance) {
      setCrediting(null);
      return;
    }
    const timer = setTimeout(() => {
      if (creditingRef.current) setCrediting(null);
    }, CREDIT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [crediting, currentBalance]);

  async function onMockTopUp(amount: number) {
    try {
      setBusy(amount);
      await topup({ amount });
    } catch (e) {
      console.warn('[topup] failed', e);
    } finally {
      setBusy(null);
    }
  }

  async function onPurchase(pkg: PurchasesPackage) {
    const productId = pkg.product.identifier;
    try {
      setBusy(productId);
      const result = await rc.purchasePackage(pkg);
      if (result.cancelled) return;
      // Webhook will credit. Show "Crediting…" until balance ticks up.
      setCrediting({ productId, startedBalance: currentBalance });
    } catch (e) {
      console.warn('[iap] purchase failed', e);
    } finally {
      setBusy(null);
    }
  }

  async function onPurchaseRawProduct(product: PurchasesProductLike) {
    const productId = product.identifier;
    try {
      setBusy(productId);
      const result = await rc.purchaseStoreProduct(product as any);
      if (result.cancelled) return;
      setCrediting({ productId, startedBalance: currentBalance });
    } catch (e) {
      console.warn('[iap] purchaseStoreProduct failed', e);
    } finally {
      setBusy(null);
    }
  }

  const useMockTiles = persona !== null;
  const orderedPackages = useMockTiles
    ? []
    : (SKU_ORDER.map((sku) => rc.packages.find((p) => p.product.identifier === sku)).filter(
        Boolean
      ) as PurchasesPackage[]);
  // Fallback: when no RC offering is configured, surface the raw StoreKit
  // products fetched via Purchases.getProducts in the provider. Same display
  // shape (priceString + identifier) so the tiles render identically.
  const orderedProducts = useMockTiles || orderedPackages.length > 0 ? [] : rc.storeProducts;

  const balance = me?.walletBalance ?? 0;
  const won = me?.totalWon ?? 0;
  const lost = me?.totalForfeited ?? 0;
  const levelIndex = walletLevelFor(won, lost);
  const walletLevel = WALLET_LEVELS[levelIndex];
  const net = won - lost;
  const factSub =
    won + lost === 0
      ? 'No settled bets yet. Place one to start the run.'
      : net > 0
        ? `+$${net} net across ${won > lost ? 'mostly wins' : 'a mixed run'} so far.`
        : net < 0
          ? `−$${Math.abs(net)} net so far. Next finish flips it.`
          : 'Even money. Wins and forfeits are dollar-balanced.';

  // First-paint skeleton — Convex queries return undefined before they
  // resolve. Showing real numbers as 0 looks like a real $0 wallet, which
  // is misleading when the user actually has $80.
  if (me === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: PAGE_X, paddingTop: 4 }}>
          <SkeletonBar width={80} height={11} />
          <SkeletonCard height={148} style={{ marginTop: 14 }} />
          <SkeletonBar width={140} height={60} style={{ marginTop: 18 }} />
          <SkeletonBar width={'70%'} height={14} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: 'row', marginTop: 24, gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} height={48} style={{ flex: 1 }} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <FlatList
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <View>
            <Text
              style={{
                ...EYEBROW,
                color: colors.text,
                opacity: 0.5,
                paddingTop: 4,
              }}>
              WALLET
            </Text>

            {/* Balance hero — paired numbers, no card chrome. Mascot kept
                as a smaller chip so the baked-in level ring doesn't
                compete with the tinted LEVEL eyebrow below the balance. */}
            <View style={{ marginTop: 14 }}>
              <Image
                source={WALLET_LEVEL_MASCOTS[levelIndex]}
                resizeMode="cover"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 14,
                  marginBottom: 16,
                  backgroundColor: colors.text + '10',
                }}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: colors.text,
                  fontSize: 64,
                  fontWeight: '800',
                  letterSpacing: -2.4,
                  fontVariant: ['tabular-nums'],
                }}>
                ${balance.toFixed(0)}
              </Text>
              <Text style={{ ...EYEBROW, color: walletLevel.tone, marginTop: 6 }}>
                {walletLevel.eyebrow}
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  color: colors.text,
                  opacity: 0.58,
                  fontSize: 13,
                  lineHeight: 18,
                }}>
                {factSub}
              </Text>
            </View>

            {/* Won / forfeit lifetime split */}
            <View
              style={{
                marginTop: 22,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: colors.text + '14',
                flexDirection: 'row',
              }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...EYEBROW, color: LIME, opacity: 0.85 }}>WON</Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: LIME,
                    fontSize: 24,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}>
                  +${won}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ ...EYEBROW, color: EMBER, opacity: 0.85 }}>FORFEIT</Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: EMBER,
                    fontSize: 24,
                    fontWeight: '800',
                    fontVariant: ['tabular-nums'],
                  }}>
                  −${lost}
                </Text>
              </View>
            </View>
            <View
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.text + '14',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}>
              <Text style={{ color: colors.text, opacity: 0.55, fontSize: 13 }}>Net outcome</Text>
              <Text
                style={{
                  color: net >= 0 ? LIME : EMBER,
                  fontSize: 18,
                  fontWeight: '800',
                  fontVariant: ['tabular-nums'],
                }}>
                {net >= 0 ? '+' : '−'}${Math.abs(net)}
              </Text>
            </View>

            {/* Top up */}
            <View style={{ marginTop: SECTION_GAP }}>
              <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>TOP UP</Text>
              {useMockTiles ? (
                <>
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                    {MOCK_TOP_UP_AMOUNTS.map((amount) => {
                      const isLoading = busy === amount;
                      const isDisabled = busy !== null && busy !== amount;
                      return (
                        <Pressable
                          key={amount}
                          onPress={() => onMockTopUp(amount)}
                          disabled={busy !== null}
                          style={{
                            flex: 1,
                            backgroundColor: colors.text + '0d',
                            borderWidth: 1,
                            borderColor: colors.text + '14',
                            borderRadius: 12,
                            paddingVertical: 14,
                            alignItems: 'center',
                            opacity: isDisabled ? 0.4 : 1,
                          }}>
                          {isLoading ? (
                            <ActivityIndicator color={colors.text} />
                          ) : (
                            <Text
                              style={{
                                color: colors.text,
                                fontWeight: '700',
                                fontSize: 16,
                                fontVariant: ['tabular-nums'],
                              }}>
                              DEV ${amount}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ marginTop: 8, color: colors.text, opacity: 0.4, fontSize: 11 }}>
                    Dev persona — mock credit, no payment.
                  </Text>
                </>
              ) : orderedPackages.length > 0 ? (
                <>
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                    {orderedPackages.map((pkg) => {
                      const productId = pkg.product.identifier;
                      const credit = SKU_TO_CREDIT[productId] ?? 0;
                      const isLoading = busy === productId;
                      const isDisabled = busy !== null && busy !== productId;
                      return (
                        <Pressable
                          key={productId}
                          onPress={() => onPurchase(pkg)}
                          disabled={busy !== null}
                          style={{
                            flex: 1,
                            backgroundColor: colors.text + '0d',
                            borderWidth: 1,
                            borderColor: colors.text + '14',
                            borderRadius: 12,
                            paddingVertical: 12,
                            alignItems: 'center',
                            opacity: isDisabled ? 0.4 : 1,
                          }}>
                          {isLoading ? (
                            <ActivityIndicator color={colors.text} />
                          ) : (
                            <>
                              <Text
                                style={{
                                  color: colors.text,
                                  fontWeight: '700',
                                  fontSize: 15,
                                  fontVariant: ['tabular-nums'],
                                }}>
                                {pkg.product.priceString}
                              </Text>
                              <Text
                                style={{
                                  marginTop: 2,
                                  color: LIME,
                                  fontWeight: '700',
                                  fontSize: 11,
                                  fontVariant: ['tabular-nums'],
                                }}>
                                +${credit}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ marginTop: 8, color: colors.text, opacity: 0.4, fontSize: 11 }}>
                    {crediting
                      ? 'Crediting your wallet… this can take a few seconds.'
                      : 'Purchases are non-refundable virtual credit.'}
                  </Text>
                </>
              ) : orderedProducts.length > 0 ? (
                <>
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                    {orderedProducts.map((product) => {
                      const productId = product.identifier;
                      const credit = SKU_TO_CREDIT[productId] ?? 0;
                      const isLoading = busy === productId;
                      const isDisabled = busy !== null && busy !== productId;
                      return (
                        <Pressable
                          key={productId}
                          onPress={() => onPurchaseRawProduct(product)}
                          disabled={busy !== null}
                          style={{
                            flex: 1,
                            backgroundColor: colors.text + '0d',
                            borderWidth: 1,
                            borderColor: colors.text + '14',
                            borderRadius: 12,
                            paddingVertical: 12,
                            alignItems: 'center',
                            opacity: isDisabled ? 0.4 : 1,
                          }}>
                          {isLoading ? (
                            <ActivityIndicator color={colors.text} />
                          ) : (
                            <>
                              <Text
                                style={{
                                  color: colors.text,
                                  fontWeight: '700',
                                  fontSize: 15,
                                  fontVariant: ['tabular-nums'],
                                }}>
                                {product.priceString}
                              </Text>
                              <Text
                                style={{
                                  marginTop: 2,
                                  color: LIME,
                                  fontWeight: '700',
                                  fontSize: 11,
                                  fontVariant: ['tabular-nums'],
                                }}>
                                +${credit}
                              </Text>
                            </>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={{ marginTop: 8, color: colors.text, opacity: 0.4, fontSize: 11 }}>
                    {crediting
                      ? 'Crediting your wallet… this can take a few seconds.'
                      : 'Dev mode · StoreKit local config (sandbox sim).'}
                  </Text>
                </>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {rc.ready ? (
                    <Text style={{ color: colors.text, opacity: 0.55, fontSize: 13 }}>
                      Top-ups are temporarily unavailable. Try again later.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <SkeletonCard key={i} height={56} style={{ flex: 1 }} />
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Transactions */}
            <Text
              style={{
                ...EYEBROW,
                color: colors.text,
                opacity: 0.5,
                marginTop: SECTION_GAP,
                marginBottom: 4,
              }}>
              TRANSACTIONS
            </Text>
          </View>
        }
        data={txs ?? []}
        keyExtractor={(t) => t._id}
        renderItem={({ item, index }) => {
          const meta = TX_META[item.type] ?? {
            icon: 'Circle',
            color: colors.text,
            label: item.type,
          };
          const positive = item.amount > 0;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.text + '14',
              }}>
              <View style={{ width: 28, alignItems: 'center', marginRight: 12 }}>
                <Icon name={meta.icon as any} size={16} color={meta.color} />
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                  {meta.label}
                </Text>
                <Text style={{ color: colors.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>
                  {formatDate(item.at ?? item._creationTime)}
                </Text>
              </View>
              <Text
                style={{
                  color: positive ? LIME : EMBER,
                  fontWeight: '800',
                  fontSize: 16,
                  fontVariant: ['tabular-nums'],
                }}>
                {positive ? '+' : '−'}${Math.abs(item.amount)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ paddingVertical: 14 }}>
            <Image
              source={SCENARIO_MASCOTS.friendMatch}
              resizeMode="cover"
              style={{
                width: '100%',
                height: 130,
                borderRadius: 16,
                marginBottom: 12,
                backgroundColor: colors.text + '10',
              }}
            />
            <Text
              style={{
                color: colors.text,
                opacity: 0.4,
                fontSize: 13,
              }}>
              No transactions yet. Top up to stake your first challenge.
            </Text>
          </View>
        }
      />
    </View>
  );
}

function formatDate(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
