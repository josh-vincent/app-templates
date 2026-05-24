import { useCallback, useMemo, useState } from 'react';
import { Text, View, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import Svg, { Path, Circle, Line as SvgLine } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from '@/components/ThemedText';
import Icon from '@/components/Icon';
import GeoGlyph from '@/components/GeoGlyph';
import { useThemeColors } from '@/contexts/ThemeColors';
import { INK, MOSS, MOSS_SOFT, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, BRICK, SERIF } from '@/lib/theme';
import {
  listTracked,
  removeTracked,
  updateTrackedPrice,
  setTrackedFrequency,
  type TrackedRoute,
} from '@/utils/trackedStorage';
import type { FlightOffer, ScanFrequency } from '@/lib/flightTypes';
import { api } from '@/lib/apiBase';
import { findAirport } from '@/lib/airports';

const FREQUENCIES: ScanFrequency[] = ['daily', 'weekly', 'manual'];

export default function TrackedTab() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const [routes, setRoutes] = useState<TrackedRoute[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRoutes(await listTracked());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const recheck = async (r: TrackedRoute) => {
    setChecking(r.id);
    try {
      const res = await fetch(api('/api/flights/search'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          origin: r.origin,
          destination: r.destination,
          departureDate: r.departureDate,
          returnDate: r.returnDate,
          adults: r.adults,
          cabin: r.cabin,
        }),
      });
      if (!res.ok) throw new Error('Check failed');
      const { offers } = (await res.json()) as { offers: FlightOffer[] };
      const lowest = offers[0] ? parseFloat(offers[0].totalAmount) : 0;
      if (lowest <= 0) {
        Alert.alert('No offers', 'No prices available right now.');
        return;
      }
      await updateTrackedPrice(r.id, lowest, offers[0].totalCurrency);
      await load();
    } catch (e: any) {
      Alert.alert('Check failed', e?.message ?? 'Unknown error');
    } finally {
      setChecking(null);
    }
  };

  const cycleFrequency = async (r: TrackedRoute) => {
    const current = r.scanFrequency ?? 'daily';
    const next = FREQUENCIES[(FREQUENCIES.indexOf(current) + 1) % FREQUENCIES.length];
    await setTrackedFrequency(r.id, next);
    await load();
  };

  const remove = async (id: string) => {
    await removeTracked(id);
    await load();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: isDark ? themeColors.bg : PARCHMENT, paddingTop: insets.top }}>
      {/* Editorial header — eyebrow + serif headline + italic blurb */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.5,
            fontSize: 11,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}>
          WATCHING
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 32,
            marginTop: 4,
            lineHeight: 36,
            letterSpacing: -0.4,
          }}>
          Price watch
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.6,
            fontSize: 13,
            marginTop: 4,
            fontStyle: 'italic',
          }}>
          I'll keep an eye and ping you when a fare gets interesting.
        </Text>

        <Pressable
          onPress={() => router.push('/screens/bundles')}
          style={{
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: 18,
            backgroundColor: INK,
          }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(241,236,228,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Heart" size={16} color={PARCHMENT} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, opacity: 0.6, fontSize: 10, letterSpacing: 1.2 }}>
              BUNDLES
            </Text>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 15, marginTop: 1 }}>
              Group favourites &amp; find the best combo
            </Text>
          </View>
          <Icon name="ChevronRight" size={16} color={PARCHMENT} />
        </Pressable>
      </View>

      <FlatList
        data={routes}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INK} />}
        ListEmptyComponent={
          <View
            style={{
              backgroundColor: PARCHMENT_DEEP,
              borderRadius: 24,
              marginTop: 12,
              paddingVertical: 56,
              paddingHorizontal: 28,
              alignItems: 'center',
            }}>
            <GeoGlyph
              kind="skyline-generic"
              size={80}
              color={INK}
              accent={BRICK}
            />
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 22,
                marginTop: 20,
                textAlign: 'center',
                lineHeight: 28,
              }}>
              Nothing on the watchlist yet
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.6,
                fontSize: 13,
                marginTop: 8,
                fontStyle: 'italic',
                textAlign: 'center',
                lineHeight: 19,
              }}>
              Save a route and I'll keep watch for soft mornings, sudden drops, and the moment a fare gets interesting.
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/(home)')}
              style={{
                marginTop: 24,
                paddingHorizontal: 22,
                paddingVertical: 11,
                borderRadius: 100,
                backgroundColor: INK,
              }}>
              <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 14 }}>
                Find me a deal
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackedRow
            route={item}
            index={index}
            checking={checking === item.id}
            onCheck={() => recheck(item)}
            onCycleFrequency={() => cycleFrequency(item)}
            onRemove={() => remove(item.id)}
          />
        )}
      />
    </View>
  );
}

function TrackedRow({
  route,
  index,
  checking,
  onCheck,
  onCycleFrequency,
  onRemove,
}: {
  route: TrackedRoute;
  index: number;
  checking: boolean;
  onCheck: () => void;
  onCycleFrequency: () => void;
  onRemove: () => void;
}) {
  const from = findAirport(route.origin);
  const to = findAirport(route.destination);
  const history = route.history ?? [];
  const previous = history.length > 1 ? history[history.length - 2].price : undefined;
  const delta = previous !== undefined ? route.lastPrice - previous : 0;
  const lowest = route.lowestPrice ?? route.lastPrice;
  const isAtLowest = route.lastPrice <= lowest;

  const freq = route.scanFrequency ?? 'daily';
  const freqLabel = freq === 'daily' ? 'Scan daily' : freq === 'weekly' ? 'Scan weekly' : 'Manual';

  const deltaDown = delta < 0;
  const deltaUp = delta > 0;
  const deltaAmt = Math.abs(Math.round(delta));

  return (
    <View
      style={{
        backgroundColor: PARCHMENT_DEEP,
        borderRadius: 24,
        padding: 20,
        marginBottom: 14,
        shadowColor: INK,
        shadowOpacity: 0.07,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}>
      {/* Eyebrow */}
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          opacity: 0.45,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
        Tracked route #{index + 1}
      </Text>

      {/* Route name + price row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 22,
              lineHeight: 26,
              letterSpacing: -0.2,
            }}>
            {from?.city ?? route.origin} → {to?.city ?? route.destination}
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.5,
              fontSize: 11,
              marginTop: 4,
              fontStyle: 'italic',
            }}>
            {route.departureDate}
            {route.returnDate ? ` – ${route.returnDate}` : ''} · {route.adults} adult
            {route.adults > 1 ? 's' : ''} · {route.cabin.replace('_', ' ')}
          </Text>
        </View>

        {/* Price + delta tap area */}
        <Pressable
          onPress={() => router.push({ pathname: '/screens/trends/[id]', params: { id: route.id } })}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{ alignItems: 'flex-end', marginLeft: 12 }}>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 24,
              letterSpacing: -0.4,
            }}>
            {route.currency} {Math.round(route.lastPrice)}
          </Text>
          {/* Delta pill */}
          {delta === 0 ? (
            <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.35, fontSize: 12, marginTop: 3 }}>·</Text>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 100,
                backgroundColor: deltaDown ? MOSS_SOFT : '#fde8dd',
              }}>
              <Icon
                name={deltaDown ? 'TrendingDown' : 'TrendingUp'}
                size={11}
                color={deltaDown ? MOSS : BRICK}
              />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: deltaDown ? MOSS : BRICK,
                  fontSize: 11,
                  marginLeft: 4,
                }}>
                {route.currency} {deltaAmt}
              </Text>
            </View>
          )}
          <Icon name="ChevronRight" size={11} color={INK} style={{ opacity: 0.3, marginTop: 2 }} />
        </Pressable>
      </View>

      {/* Sparkline or first-data-point note */}
      {history.length > 1 ? (
        <Sparkline history={history} currency={route.currency} lowest={lowest} />
      ) : (
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.4,
            fontSize: 11,
            fontStyle: 'italic',
            marginTop: 12,
          }}>
          Watching for first data point…
        </Text>
      )}

      {/* Dashed divider */}
      <View
        style={{
          marginTop: 14,
          borderBottomWidth: 1,
          borderStyle: 'dashed',
          borderColor: `rgba(19,26,42,0.15)`,
        }}
      />

      {/* Lowest price chip + time-ago */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        {/* Lowest chip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 100,
            backgroundColor: PARCHMENT_COOL,
          }}>
          <Icon name="TrendingDown" size={11} color={INK} />
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.75,
              fontSize: 11,
              marginLeft: 5,
            }}>
            Lowest {route.currency} {Math.round(lowest)}
          </Text>
          {isAtLowest && history.length > 1 ? (
            <Text
              style={{
                fontFamily: SERIF,
                color: MOSS,
                fontSize: 11,
                marginLeft: 5,
              }}>
              · best so far
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.35,
            fontSize: 11,
            marginLeft: 'auto',
            fontStyle: 'italic',
          }}>
          {timeAgo(route.lastCheckedAt)}
        </Text>
      </View>

      {/* Action row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
        {route.bookedOrderId ? (
          /* Booked editorial tag */
          <Pressable
            onPress={() => router.push({ pathname: '/screens/trip-detail', params: { id: route.bookedOrderId! } })}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: MOSS,
              backgroundColor: MOSS_SOFT,
            }}>
            <Icon name="Luggage" size={14} color={MOSS} />
            <Text
              style={{
                fontFamily: SERIF,
                color: MOSS,
                fontSize: 13,
                fontStyle: 'italic',
                marginLeft: 8,
                flex: 1,
              }}>
              Booked — view your trip ↗
            </Text>
          </Pressable>
        ) : (
          <>
            {/* Scan frequency pill */}
            <Pressable
              onPress={onCycleFrequency}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 100,
                backgroundColor: PARCHMENT_COOL,
              }}>
              <Icon name="Clock" size={12} color={INK} />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  fontSize: 12,
                  marginLeft: 5,
                  opacity: 0.8,
                }}>
                {freqLabel}
              </Text>
            </Pressable>

            {/* Check now pill */}
            <Pressable
              onPress={onCheck}
              disabled={checking}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 100,
                backgroundColor: INK,
                opacity: checking ? 0.55 : 1,
              }}>
              <Icon name="RefreshCw" size={12} color={PARCHMENT} />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: PARCHMENT,
                  fontSize: 12,
                  marginLeft: 5,
                }}>
                {checking ? 'Checking…' : 'Check now'}
              </Text>
            </Pressable>
          </>
        )}

        {/* Ghost remove button */}
        <Pressable
          onPress={onRemove}
          accessibilityLabel="Stop watching this route"
          accessibilityRole="button"
          hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          style={{
            marginLeft: 'auto',
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor: PARCHMENT_COOL,
          }}>
          <Icon name="Trash2" size={14} color={INK} />
        </Pressable>
      </View>
    </View>
  );
}

function Sparkline({
  history,
  currency,
  lowest,
  width = 300,
}: {
  history: { price: number; at: number }[];
  currency: string;
  lowest: number;
  width?: number;
}) {
  const HEIGHT = 52;
  const PAD = 6;
  const innerH = HEIGHT - PAD * 2;

  const pts = useMemo(() => history.slice(-8), [history]);
  const prices = pts.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);
  const n = pts.length;

  const xAt = (i: number) => PAD + (i * (width - PAD * 2)) / Math.max(1, n - 1);
  const yAt = (price: number) => HEIGHT - PAD - ((price - min) / range) * innerH;

  // Smooth cubic bezier using midpoint control points
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
  const firstPrice = pts[0].price;
  const lastPrice = pts[n - 1].price;

  // Dashed line at lowest price level
  const lowY = yAt(Math.max(min, lowest));

  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: PARCHMENT_COOL,
        borderRadius: 12,
        paddingTop: 10,
        paddingBottom: 6,
        paddingHorizontal: 6,
      }}>
      {/* "best so far" label above the dashed line — only if lowest is visible in range */}
      {lowest >= min && lowest <= max ? (
        <View style={{ paddingHorizontal: PAD, marginBottom: 2 }}>
          <Text
            style={{
              fontFamily: SERIF,
              color: MOSS,
              opacity: 0.85,
              fontSize: 9,
              letterSpacing: 0.3,
              fontStyle: 'italic',
            }}>
            best so far — {currency} {Math.round(lowest)}
          </Text>
        </View>
      ) : null}

      <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
        {/* Horizontal axis tick line */}
        <SvgLine
          x1={PAD}
          x2={width - PAD}
          y1={HEIGHT - PAD}
          y2={HEIGHT - PAD}
          stroke={INK}
          strokeOpacity={0.12}
          strokeWidth={1}
        />
        {/* Dashed line at lowest recorded price */}
        <SvgLine
          x1={PAD}
          x2={width - PAD}
          y1={lowY}
          y2={lowY}
          stroke={MOSS}
          strokeOpacity={0.55}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* Main smooth line */}
        <Path d={d} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Soft halo on final point */}
        <Circle cx={lastX} cy={lastY} r={8} fill={INK} fillOpacity={0.1} />
        {/* Filled dot on final point */}
        <Circle cx={lastX} cy={lastY} r={3.5} fill={INK} />
      </Svg>

      {/* Price labels: "first seen" → "now" */}
      <View style={{ flexDirection: 'row', paddingHorizontal: PAD, marginTop: 2 }}>
        <View>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.38, fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            first seen
          </Text>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.6, fontSize: 10, marginTop: 1 }}>
            {currency} {Math.round(firstPrice)}
          </Text>
        </View>
        <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.38, fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            now
          </Text>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.6, fontSize: 10, marginTop: 1 }}>
            {currency} {Math.round(lastPrice)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function timeAgo(ts: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
