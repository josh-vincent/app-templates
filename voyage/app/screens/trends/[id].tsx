import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Line as SvgLine } from 'react-native-svg';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { findAirport } from '@/lib/airports';
import type { PricePoint, TrackedRoute } from '@/lib/flightTypes';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { listTracked, removeTracked, setTrackedFrequency } from '@/utils/trackedStorage';

type Insight = {
  label: string;
  detail: string;
  tone: 'good' | 'neutral' | 'caution' | 'trending';
};

export default function TrendsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [route, setRoute] = useState<TrackedRoute | null>(null);

  const load = useCallback(async () => {
    const all = await listTracked();
    const found = all.find((r) => r.id === String(params.id));
    setRoute(found ?? null);
  }, [params.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!route) {
    return (
      <View style={{ flex: 1, backgroundColor: PARCHMENT }}>
        <TopBar isDark={isDark} />
        <View className="flex-1 items-center justify-center px-6">
          <Icon name="TrendingDown" size={42} color={INK} />
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 20, marginTop: 12 }}>
            No trends recorded yet
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.6,
              fontSize: 13,
              marginTop: 4,
              fontStyle: 'italic',
              textAlign: 'center',
            }}>
            Track a route and I'll start collecting price history.
          </Text>
        </View>
      </View>
    );
  }

  const history = route.history && route.history.length > 0
    ? route.history
    : [{ price: route.lastPrice, at: route.lastCheckedAt || route.createdAt }];
  const lowest = route.lowestPrice ?? Math.min(...history.map((h) => h.price));
  const highest = Math.max(...history.map((h) => h.price));
  const avg = history.reduce((a, h) => a + h.price, 0) / history.length;
  const median = (() => {
    const sorted = [...history.map((h) => h.price)].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  })();
  const current = route.lastPrice;
  const prev = history.length >= 2 ? history[history.length - 2].price : current;
  const delta = current - prev;
  const deltaPct = prev > 0 ? (delta / prev) * 100 : 0;
  const atBest = current <= lowest;
  const daysWatched = Math.max(
    1,
    Math.round((Date.now() - route.createdAt) / 86_400_000),
  );

  const from = findAirport(route.origin);
  const to = findAirport(route.destination);

  const insights = buildInsights(route, history, { current, lowest, avg, median, atBest });

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <TopBar isDark={isDark} />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-5 pt-2">
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 12,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>
            Trend · {route.cabin.replace('_', ' ')}
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 30,
              letterSpacing: -0.4,
              marginTop: 4,
              lineHeight: 34,
            }}>
            {from?.city ?? route.origin} → {to?.city ?? route.destination}
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 13,
              marginTop: 4,
              fontStyle: 'italic',
            }}>
            Watching for {daysWatched} day{daysWatched === 1 ? '' : 's'} ·{' '}
            {route.scanFrequency ?? 'daily'}
          </Text>

          <View
            className="rounded-3xl overflow-hidden mt-5 p-5"
            style={{
              backgroundColor: atBest ? '#e6f2eb' : PARCHMENT_DEEP,
              borderWidth: atBest ? 1 : 0,
              borderColor: atBest ? '#b8dcc6' : 'transparent',
            }}>
            <View className="flex-row items-end justify-between">
              <View>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    opacity: 0.55,
                    fontSize: 12,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                  }}>
                  {atBest ? 'At best price' : 'Right now'}
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 44,
                    letterSpacing: -0.8,
                    marginTop: 2,
                    lineHeight: 48,
                  }}>
                  {route.currency} {Math.round(current)}
                </Text>
              </View>
              {delta === 0 ? (
                <View
                  className="flex-row items-center px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: PARCHMENT_DEEP }}>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.6,
                      fontSize: 12,
                    }}>
                    — No change
                  </Text>
                </View>
              ) : delta < 0 ? (
                <View
                  className="flex-row items-center px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: MOSS }}>
                  <Icon name="TrendingDown" size={12} color={PARCHMENT} />
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: PARCHMENT,
                      fontSize: 12,
                      marginLeft: 6,
                    }}>
                    − {Math.abs(Math.round(delta))} ({Math.abs(deltaPct).toFixed(1)}%)
                  </Text>
                </View>
              ) : (
                <View
                  className="flex-row items-center px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: '#a04848' }}>
                  <Icon name="TrendingUp" size={12} color={PARCHMENT} />
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: PARCHMENT,
                      fontSize: 12,
                      marginLeft: 6,
                    }}>
                    + {Math.abs(Math.round(delta))} ({Math.abs(deltaPct).toFixed(1)}%)
                  </Text>
                </View>
              )}
            </View>

            <Sparkline
              history={history}
              currency={route.currency}
              lowest={lowest}
              highest={highest}
            />

            <View
              style={{
                marginTop: 14,
                height: 1,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: 'rgba(19,26,42,0.12)',
              }}
            />

            {windowWidth < 380 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 }}>
                <View style={{ width: '50%', marginBottom: 12 }}>
                  <Stat label="Best ever" value={`${route.currency} ${Math.round(lowest)}`} highlight />
                </View>
                <View style={{ width: '50%', marginBottom: 12 }}>
                  <Stat label="Average" value={`${route.currency} ${Math.round(avg)}`} />
                </View>
                <View style={{ width: '50%', marginBottom: 12 }}>
                  <Stat label="Median" value={`${route.currency} ${Math.round(median)}`} />
                </View>
                <View style={{ width: '50%', marginBottom: 12 }}>
                  <Stat label="Highest" value={`${route.currency} ${Math.round(highest)}`} />
                </View>
              </View>
            ) : (
              <View className="flex-row mt-4">
                <Stat label="Best ever" value={`${route.currency} ${Math.round(lowest)}`} highlight />
                <Stat label="Average" value={`${route.currency} ${Math.round(avg)}`} />
                <Stat label="Median" value={`${route.currency} ${Math.round(median)}`} />
                <Stat label="Highest" value={`${route.currency} ${Math.round(highest)}`} />
              </View>
            )}
          </View>

          <View className="mt-5">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 18,
                letterSpacing: -0.2,
                marginBottom: 10,
              }}>
              What I'm seeing
            </Text>
            {insights.map((ins, i) => (
              <View
                key={i}
                className="rounded-2xl mb-2 p-4 flex-row items-start"
                style={{
                  backgroundColor:
                    ins.tone === 'good' || ins.tone === 'trending'
                      ? '#e6f2eb'
                      : ins.tone === 'caution'
                        ? '#f6e1d7'
                        : PARCHMENT_DEEP,
                }}>
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                  style={{
                    backgroundColor:
                      ins.tone === 'good'
                        ? '#b8dcc6'
                        : ins.tone === 'trending'
                          ? '#b8dcc6'
                          : ins.tone === 'caution'
                            ? '#f0c8b0'
                            : PARCHMENT_COOL,
                  }}>
                  <Icon
                    name={
                      ins.tone === 'good'
                        ? 'TrendingDown'
                        : ins.tone === 'trending'
                          ? 'Activity'
                          : ins.tone === 'caution'
                            ? 'AlertCircle'
                            : 'Info'
                    }
                    size={14}
                    color={
                      ins.tone === 'good' || ins.tone === 'trending'
                        ? MOSS
                        : ins.tone === 'caution'
                          ? BRICK
                          : INK
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 15,
                      letterSpacing: -0.1,
                    }}>
                    {ins.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.65,
                      fontSize: 13,
                      marginTop: 3,
                      lineHeight: 19,
                    }}>
                    {ins.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View className="mt-5">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 18,
                letterSpacing: -0.2,
                marginBottom: 10,
              }}>
              How often I check
            </Text>
            <View className="flex-row">
              {(['daily', 'weekly', 'manual'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={async () => {
                    await setTrackedFrequency(route.id, f);
                    load();
                  }}
                  className="rounded-full px-4 py-2 mr-2"
                  style={{
                    backgroundColor:
                      (route.scanFrequency ?? 'daily') === f ? INK : PARCHMENT_DEEP,
                  }}>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: (route.scanFrequency ?? 'daily') === f ? PARCHMENT : INK,
                      fontSize: 13,
                      textTransform: 'capitalize',
                    }}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => {
              Alert.alert(
                'Stop watching this route?',
                "I'll stop checking for fare drops on this route. You can always re-add it later.",
                [
                  { text: 'Keep watching', style: 'cancel' },
                  {
                    text: 'Stop watching',
                    style: 'destructive',
                    onPress: async () => {
                      await removeTracked(route.id);
                      router.back();
                    },
                  },
                ],
              );
            }}
            className="mt-5 self-start flex-row items-center px-3 py-2 rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
            <Icon name="BellOff" size={12} color={INK} />
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 12,
                marginLeft: 6,
                opacity: 0.75,
              }}>
              Stop watching this route
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 14,
          paddingTop: 12,
          backgroundColor: PARCHMENT,
          borderTopWidth: 1,
          borderColor: 'rgba(19,26,42,0.08)',
        }}>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/(home)',
              params: {
                origin: route.origin,
                destination: route.destination,
                departureDate: route.departureDate,
                returnDate: route.returnDate ?? '',
                adults: String(route.adults),
                cabin: route.cabin,
              },
            })
          }
          className="rounded-full items-center justify-center flex-row"
          style={{ backgroundColor: INK, height: 50 }}>
          <Icon name="Search" size={14} color={PARCHMENT} />
          <Text
            style={{
              color: PARCHMENT,
              fontFamily: SERIF,
              fontSize: 15,
              marginLeft: 8,
            }}>
            Find current best fare
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TopBar({ isDark }: { isDark: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 20,
        paddingBottom: 8,
        backgroundColor: isDark ? '#0a0a0a' : PARCHMENT,
      }}>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="mr-3 h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
          <Icon name="ArrowLeft" size={18} color={isDark ? PARCHMENT : INK} />
        </Pressable>
        <Text
          style={{
            fontFamily: SERIF,
            color: isDark ? PARCHMENT : INK,
            fontSize: 15,
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: 0.55,
          }}>
          Trend
        </Text>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          opacity: 0.55,
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          color: highlight ? MOSS : INK,
          fontSize: 16,
          letterSpacing: -0.2,
          marginTop: 4,
        }}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Sparkline({
  history,
  currency,
  lowest,
  highest,
}: {
  history: PricePoint[];
  currency: string;
  lowest: number;
  highest: number;
}) {
  const width = 320;
  const height = 110;
  const pad = 10;
  const innerH = height - pad * 2;
  const max = highest;
  const min = lowest;
  const isFlat = min === max;
  const range = Math.max(10, max - min);
  const pts = history.length > 1 ? history : [...history, history[0]];
  const n = pts.length;
  const xAt = (i: number) => pad + (i * (width - pad * 2)) / Math.max(1, n - 1);
  const yAt = (price: number) =>
    height - pad - ((price - min) / range) * innerH;

  // Smooth path using simple bezier midpoints
  let d = '';
  pts.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.price);
    if (i === 0) {
      d += `M ${x} ${y}`;
    } else {
      const prevX = xAt(i - 1);
      const prevY = yAt(pts[i - 1].price);
      const cx = (prevX + x) / 2;
      d += ` C ${cx} ${prevY} ${cx} ${y} ${x} ${y}`;
    }
  });
  const lastX = xAt(n - 1);
  const lastY = yAt(pts[n - 1].price);

  // Lowest line
  const lowY = yAt(min);

  return (
    <View style={{ marginTop: 18, alignItems: 'center' }}>
      <Svg width={width} height={height + 22} viewBox={`0 0 ${width} ${height + 22}`}>
        {!isFlat && (
          <SvgLine
            x1={pad}
            x2={width - pad}
            y1={lowY}
            y2={lowY}
            stroke="rgba(31,107,67,0.35)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <Path
          d={d}
          stroke={isFlat ? 'rgba(19,26,42,0.35)' : INK}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={isFlat ? '5 4' : undefined}
        />
        <Circle cx={lastX} cy={lastY} r={5} fill={INK} />
        <Circle cx={lastX} cy={lastY} r={9} fill={INK} fillOpacity={0.12} />
      </Svg>
      {isFlat ? (
        <View style={{ width: width, paddingHorizontal: pad, marginTop: -10, alignItems: 'center' }}>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.5, fontSize: 10, textAlign: 'center' }}>
            {currency} {Math.round(min)} (steady)
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', width: width, paddingHorizontal: pad, marginTop: -10 }}>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.5, fontSize: 10 }}>
            {currency} {Math.round(min)}
          </Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontFamily: SERIF,
              color: INK,
              opacity: 0.5,
              fontSize: 10,
            }}>
            {currency} {Math.round(max)}
          </Text>
        </View>
      )}
    </View>
  );
}

function buildInsights(
  route: TrackedRoute,
  history: PricePoint[],
  ctx: { current: number; lowest: number; avg: number; median: number; atBest: boolean },
): Insight[] {
  const list: Insight[] = [];
  const cur = ctx.current;
  const pctVsAvg = ((cur - ctx.avg) / Math.max(1, ctx.avg)) * 100;
  if (ctx.atBest) {
    list.push({
      tone: 'good',
      label: 'This is the best price I have seen',
      detail: `Right now matches your tracked low of ${route.currency} ${Math.round(ctx.lowest)}. Worth pulling the trigger if dates are firm.`,
    });
  } else if (pctVsAvg < -5) {
    list.push({
      tone: 'good',
      label: `${Math.abs(pctVsAvg).toFixed(1)}% under your average`,
      detail: `Fare is sitting under what I usually see (${route.currency} ${Math.round(ctx.avg)}). Reasonable entry point.`,
    });
  } else if (pctVsAvg > 8) {
    list.push({
      tone: 'caution',
      label: `${pctVsAvg.toFixed(1)}% over your average`,
      detail: `I usually see this route closer to ${route.currency} ${Math.round(ctx.avg)}. I'll keep watching — you can wait.`,
    });
  } else {
    list.push({
      tone: 'neutral',
      label: 'Price is around the running average',
      detail: `Within a few percent of ${route.currency} ${Math.round(ctx.avg)}. Either way works.`,
    });
  }

  if (history.length >= 3) {
    const drops = history.slice(1).filter((p, i) => p.price < history[i].price).length;
    if (drops >= 2) {
      list.push({
        tone: 'trending',
        label: 'Trend is downward',
        detail: `Price has dipped ${drops} time${drops === 1 ? '' : 's'} since I started watching. Patience may keep paying.`,
      });
    } else if (history[history.length - 1].price > history[0].price * 1.1) {
      list.push({
        tone: 'caution',
        label: 'Fare creeping up',
        detail: `Up ~${(((history[history.length - 1].price - history[0].price) / history[0].price) * 100).toFixed(0)}% since I started watching. Don't let it run away.`,
      });
    }
  }

  const dep = new Date(route.departureDate);
  if (!Number.isNaN(dep.getTime())) {
    const daysOut = Math.round((dep.getTime() - Date.now()) / 86_400_000);
    if (daysOut > 0 && daysOut < 14) {
      list.push({
        tone: 'caution',
        label: `Only ${daysOut} day${daysOut === 1 ? '' : 's'} until departure`,
        detail: 'Fares this close to travel rarely fall. If the timing is right, book the next dip.',
      });
    } else if (daysOut >= 60) {
      list.push({
        tone: 'neutral',
        label: `${daysOut} days out — wide watch window`,
        detail: 'Plenty of time for the route to move. I will only alert when something meaningfully changes.',
      });
    }
  }

  return list.slice(0, 3);
}
