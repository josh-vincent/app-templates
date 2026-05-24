import { useCallback, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, RefreshControl, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThemedText from '@/components/ThemedText';
import Icon from '@/components/Icon';
import GeoGlyph from '@/components/GeoGlyph';
import { useThemeColors } from '@/contexts/ThemeColors';
import { INK, PARCHMENT, SERIF } from '@/lib/theme';
import { listOrders, type StoredOrder } from '@/utils/trackedStorage';
import { findAirport } from '@/lib/airports';
import { listTrips } from '@/utils/tripStorage';
import { tripIdForOrder, type Trip } from '@/lib/tripTypes';

// ── Trip-todos persistence ────────────────────────────────────────────────────
// Storage key: @voyage/trip-todos
// Schema: Record<tripId, Record<checklistItemId, boolean>>
const TRIP_TODOS_KEY = '@voyage/trip-todos';

async function loadTripTodos(tripId: string): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(TRIP_TODOS_KEY);
    if (!raw) return {};
    const all: Record<string, Record<string, boolean>> = JSON.parse(raw);
    return all[tripId] ?? {};
  } catch {
    return {};
  }
}

async function toggleTodo(tripId: string, itemId: string, current: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TRIP_TODOS_KEY);
    const all: Record<string, Record<string, boolean>> = raw ? JSON.parse(raw) : {};
    const tripTodos = all[tripId] ?? {};
    tripTodos[itemId] = !current;
    all[tripId] = tripTodos;
    await AsyncStorage.setItem(TRIP_TODOS_KEY, JSON.stringify(all));
    return !current;
  } catch {
    return current;
  }
}

type ChecklistItem = { id: string; label: string; doneByDays: number };

const CHECKLIST: ChecklistItem[] = [
  { id: 'passport', label: 'Passport valid 6+ months', doneByDays: 30 },
  { id: 'seat', label: 'Pick a seat', doneByDays: 14 },
  { id: 'esim', label: 'Add an eSIM', doneByDays: 7 },
  { id: 'checkin', label: 'Online check-in', doneByDays: 1 },
];

export default function TripsTab() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [tripMap, setTripMap] = useState<Record<string, Trip>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [nextUpTodos, setNextUpTodos] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [loadedOrders, loadedTrips] = await Promise.all([listOrders(), listTrips()]);
    setOrders(loadedOrders);
    const map: Record<string, Trip> = {};
    for (const trip of loadedTrips) {
      for (const oid of trip.orderIds) {
        map[oid] = trip;
      }
    }
    setTripMap(map);
    // Load todos for the next-up order
    const sorted = [...loadedOrders].sort((a, b) => {
      const aTs = new Date(a.slices[0]?.departing_at ?? 0).getTime();
      const bTs = new Date(b.slices[0]?.departing_at ?? 0).getTime();
      return aTs - bTs;
    });
    const nextOrder = sorted.find((o) => {
      const ts = new Date(o.slices[0]?.departing_at ?? 0).getTime();
      return ts >= Date.now();
    });
    if (nextOrder) {
      const todos = await loadTripTodos(nextOrder.id);
      setNextUpTodos(todos);
    }
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

  const { nextUp, upcoming, past } = useMemo(() => splitTrips(orders), [orders]);

  const getTripForOrder = useCallback(
    (orderId: string): Trip | null => tripMap[orderId] ?? null,
    [tripMap],
  );

  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary" style={{ paddingTop: insets.top }}>
      <View className="px-global pt-4 pb-2">
        <ThemedText style={{ fontFamily: SERIF, fontSize: 14, opacity: 0.55 }}>
          Your trips
        </ThemedText>
        <ThemedText
          className="mt-1"
          style={{ fontFamily: SERIF, fontSize: 28, letterSpacing: -0.3 }}
        >
          {nextUp ? nextUpSubtitle(nextUp, getTripForOrder(nextUp.id)) : 'Quiet for now.'}
        </ThemedText>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {orders.length === 0 ? (
          <View
            className="items-center py-14 px-6 rounded-3xl mt-2"
            style={{ backgroundColor: isDark ? themeColors.secondary : PARCHMENT }}
          >
            <GeoGlyph
              iata="compass"
              size={72}
              color={isDark ? themeColors.text : INK}
              accent="#c97d4a"
            />
            <ThemedText
              className="mt-4"
              style={{
                fontFamily: SERIF,
                fontSize: 20,
                color: isDark ? themeColors.text : INK,
              }}
            >
              No bookings yet
            </ThemedText>
            <ThemedText
              className="opacity-60 mt-2 text-center"
              style={{ fontStyle: 'italic', lineHeight: 20 }}
            >
              When you book something, it lives here with the boarding-pass view, countdown, and
              the little things left to do before wheels up.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/(tabs)/(home)')}
              className="mt-5 px-5 py-2.5 rounded-full"
              style={{ backgroundColor: isDark ? themeColors.text : INK }}
            >
              <ThemedText
                style={{ color: isDark ? themeColors.bg : PARCHMENT, fontWeight: '600' }}
              >
                Find a flight
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {nextUp ? <BoardingPassCard order={nextUp} /> : null}
        {nextUp ? <ItineraryPreview order={nextUp} isDark={isDark} themeColors={themeColors} /> : null}
        {nextUp ? (
          <StillToDo
            order={nextUp}
            isDark={isDark}
            themeColors={themeColors}
            todos={nextUpTodos}
            onToggle={async (itemId, current) => {
              const next = await toggleTodo(nextUp.id, itemId, current);
              setNextUpTodos((prev) => ({ ...prev, [itemId]: next }));
            }}
          />
        ) : null}

        {upcoming.length > 0 ? (
          <View className="mt-7">
            <SectionLabel>Also on the calendar</SectionLabel>
            {upcoming.map((o) => (
              <TripRow key={o.id} order={o} trip={getTripForOrder(o.id)} isDark={isDark} themeColors={themeColors} />
            ))}
          </View>
        ) : null}

        {past.length > 0 ? (
          <View className="mt-7">
            <SectionLabel>Looking back</SectionLabel>
            {past.map((o) => (
              <TripRow key={o.id} order={o} trip={getTripForOrder(o.id)} muted isDark={isDark} themeColors={themeColors} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText style={{ fontFamily: SERIF, fontSize: 16, marginBottom: 10, opacity: 0.85 }}>
      {children}
    </ThemedText>
  );
}

function BoardingPassCard({ order }: { order: StoredOrder }) {
  const first = order.slices[0];
  const last = order.slices[order.slices.length - 1];
  const from = findAirport(first?.origin);
  const to = findAirport(last?.destination);
  const dep = first ? new Date(first.departing_at) : null;
  const days = dep ? daysUntil(dep) : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/screens/trip-detail', params: { id: order.id } })}
      className="rounded-3xl mt-2 overflow-hidden"
      style={{ backgroundColor: INK }}
    >
      <View style={{ padding: 22 }}>
        <View className="flex-row items-center">
          <Text style={{ fontFamily: SERIF, fontSize: 12, color: PARCHMENT, opacity: 0.65 }}>
            Next departure
          </Text>
          <Text
            style={{
              marginLeft: 'auto',
              color: PARCHMENT,
              opacity: 0.55,
              fontSize: 10,
              letterSpacing: 2,
            }}
          >
            {order.bookingReference}
          </Text>
        </View>

        <View className="flex-row items-end mt-4">
          <View className="flex-1">
            <Text style={{ color: PARCHMENT, opacity: 0.6, fontSize: 11, letterSpacing: 1 }}>
              FROM
            </Text>
            <Text
              style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 34, letterSpacing: -0.5 }}
            >
              {first?.origin}
            </Text>
            <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 11, marginTop: 2 }}>
              {from?.city}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 10, paddingBottom: 8 }}>
            <Icon name="Plane" size={18} color={PARCHMENT} />
          </View>
          <View className="flex-1 items-end">
            <Text style={{ color: PARCHMENT, opacity: 0.6, fontSize: 11, letterSpacing: 1 }}>
              TO
            </Text>
            <Text
              style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 34, letterSpacing: -0.5 }}
            >
              {last?.destination}
            </Text>
            <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 11, marginTop: 2 }}>
              {to?.city}
            </Text>
          </View>
        </View>

        <View className="flex-row items-end justify-between mt-5">
          <View>
            <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 11, letterSpacing: 1 }}>
              DEPARTS IN
            </Text>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 44, letterSpacing: -1 }}>
              {days === null ? '—' : days <= 0 ? 'today' : `${days} days`}
            </Text>
          </View>
          <View style={{ opacity: 0.9 }}>
            <GeoGlyph iata={last?.destination} size={76} color={PARCHMENT} accent="#d49565" />
          </View>
        </View>
      </View>

      <View className="flex-row items-center" style={{ paddingHorizontal: 22, paddingBottom: 16 }}>
        <Text style={{ color: PARCHMENT, opacity: 0.7, fontSize: 11 }}>
          {dep ? formatLongDate(dep) : ''}
        </Text>
        <Text style={{ marginLeft: 'auto', color: PARCHMENT, opacity: 0.7, fontSize: 11 }}>
          {first?.carrierName} {first?.flightNumber}
        </Text>
      </View>

      <View
        className="flex-row"
        style={{
          borderTopWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'rgba(241,236,228,0.35)',
          paddingVertical: 14,
          paddingHorizontal: 22,
        }}
      >
        <Text style={{ color: PARCHMENT, opacity: 0.6, fontSize: 11 }}>Passenger</Text>
        <Text style={{ marginLeft: 'auto', color: PARCHMENT, fontSize: 12, fontWeight: '600' }}>
          {order.passengerName}
        </Text>
      </View>
    </Pressable>
  );
}

type ThemeProps = {
  isDark: boolean;
  themeColors: ReturnType<typeof useThemeColors>;
};

function ItineraryPreview({ order, isDark, themeColors }: { order: StoredOrder } & ThemeProps) {
  const surfaceBg = isDark ? themeColors.secondary : PARCHMENT;
  const textColor = isDark ? themeColors.text : INK;
  const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(19,26,42,0.1)';
  const ruleColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(19,26,42,0.2)';
  return (
    <View className="mt-5">
      <SectionLabel>The flight</SectionLabel>
      <View
        className="rounded-2xl"
        style={{ backgroundColor: surfaceBg, paddingVertical: 14, paddingHorizontal: 16 }}
      >
        {order.slices.map((s, i) => {
          const dep = new Date(s.departing_at);
          const arr = new Date(s.arriving_at);
          return (
            <View
              key={i}
              className={i < order.slices.length - 1 ? 'pb-3 mb-3' : ''}
              style={
                i < order.slices.length - 1
                  ? { borderBottomWidth: 1, borderColor: dividerColor }
                  : undefined
              }
            >
              <View className="flex-row items-center">
                <ThemedText
                  style={{ fontFamily: SERIF, color: textColor, fontSize: 18, letterSpacing: -0.2 }}
                >
                  {s.origin}
                </ThemedText>
                <View
                  style={{
                    flex: 1,
                    height: 1,
                    backgroundColor: ruleColor,
                    marginHorizontal: 10,
                  }}
                />
                <ThemedText
                  style={{ fontFamily: SERIF, color: textColor, fontSize: 18, letterSpacing: -0.2 }}
                >
                  {s.destination}
                </ThemedText>
              </View>
              <View className="flex-row mt-2">
                <ThemedText style={{ color: textColor, opacity: 0.65, fontSize: 12 }}>
                  {formatTime(dep)} · {dep.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </ThemedText>
                <ThemedText
                  className="ml-auto"
                  style={{ color: textColor, opacity: 0.65, fontSize: 12 }}
                >
                  {formatTime(arr)} · {s.carrierName} {s.flightNumber}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StillToDo({
  order,
  isDark,
  themeColors,
  todos,
  onToggle,
}: { order: StoredOrder; todos: Record<string, boolean>; onToggle: (itemId: string, current: boolean) => void } & ThemeProps) {
  const first = order.slices[0];
  const dep = first ? new Date(first.departing_at) : null;
  const days = dep ? daysUntil(dep) : 999;
  const surfaceBg = isDark ? themeColors.secondary : PARCHMENT;
  const textColor = isDark ? themeColors.text : INK;
  const inactiveBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(19,26,42,0.08)';
  const inactiveCircle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(19,26,42,0.3)';

  return (
    <View className="mt-6">
      <SectionLabel>Still to do</SectionLabel>
      <View>
        {CHECKLIST.map((item) => {
          const active = days <= item.doneByDays;
          const done = !!todos[item.id];
          return (
            <Pressable
              key={item.id}
              onPress={() => onToggle(item.id, done)}
              className="flex-row items-center rounded-2xl mb-2"
              style={{
                backgroundColor: active ? surfaceBg : 'transparent',
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderWidth: active ? 0 : 1,
                borderColor: inactiveBorder,
              }}
            >
              <View
                className="w-6 h-6 rounded-full mr-3 items-center justify-center"
                style={
                  done
                    ? { backgroundColor: INK }
                    : {
                        borderWidth: 1.5,
                        borderColor: active ? textColor : inactiveCircle,
                      }
                }
              >
                {done ? <Icon name="Check" size={13} color={PARCHMENT} /> : null}
              </View>
              <ThemedText
                style={{
                  fontFamily: SERIF,
                  color: textColor,
                  fontSize: 15,
                  opacity: done ? 0.45 : active ? 1 : 0.5,
                  flex: 1,
                  textDecorationLine: done ? 'line-through' : 'none',
                }}
              >
                {item.label}
              </ThemedText>
              <ThemedText
                style={{
                  color: textColor,
                  opacity: done ? 0.45 : 0.5,
                  fontSize: 11,
                  fontStyle: 'italic',
                }}
              >
                {item.doneByDays === 1 ? 'day before' : `${item.doneByDays}d out`}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TripRow({
  order,
  trip,
  muted,
  isDark,
  themeColors,
}: { order: StoredOrder; trip: Trip | null; muted?: boolean } & ThemeProps) {
  const first = order.slices[0];
  const last = order.slices[order.slices.length - 1];
  const from = findAirport(first?.origin);
  const dep = first ? new Date(first.departing_at) : null;
  const baseBg = isDark ? themeColors.secondary : PARCHMENT;
  const mutedBg = isDark ? 'rgba(38,38,38,0.55)' : 'rgba(239,236,230,0.55)';
  const textColor = isDark ? themeColors.text : INK;

  // For round-trips (first origin === last destination), the last destination
  // is just the origin city again. Prefer the Trip's primaryDestinationName,
  // then fall back to the first outbound slice's destination.
  const isRoundTrip = first?.origin === last?.destination;
  const toIata = isRoundTrip ? first?.destination : last?.destination;
  const toCity = trip?.primaryDestinationName ?? findAirport(toIata)?.city ?? toIata;
  // GeoGlyph uses the actual destination IATA for the icon
  const glyphIata = isRoundTrip ? first?.destination : last?.destination;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/screens/trip-detail', params: { id: order.id } })}
      className="rounded-2xl p-4 mb-2 flex-row items-center"
      style={{
        backgroundColor: muted ? mutedBg : baseBg,
      }}
    >
      <View style={{ opacity: muted ? 0.5 : 0.9, marginRight: 12 }}>
        <GeoGlyph iata={glyphIata} size={32} color={textColor} accent="#c97d4a" />
      </View>
      <View className="flex-1">
        <ThemedText
          style={{
            fontFamily: SERIF,
            color: textColor,
            fontSize: 16,
            opacity: muted ? 0.7 : 1,
          }}
        >
          {from?.city ?? first?.origin} → {toCity}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ color: textColor, opacity: 0.6, fontSize: 12, marginTop: 2 }}
        >
          {dep ? formatShortDate(dep) : ''} · {dep ? formatTime(dep) : ''} · {order.bookingReference}
        </ThemedText>
      </View>
      <ThemedText style={{ fontFamily: SERIF, color: textColor, opacity: 0.75, fontSize: 15 }}>
        {order.totalCurrency} {Math.round(parseFloat(order.totalAmount))}
      </ThemedText>
    </Pressable>
  );
}

function splitTrips(orders: StoredOrder[]): {
  nextUp: StoredOrder | null;
  upcoming: StoredOrder[];
  past: StoredOrder[];
} {
  const now = Date.now();
  const withDep = orders
    .map((o) => ({ order: o, depTs: new Date(o.slices[0]?.departing_at ?? 0).getTime() }))
    .filter((x) => !Number.isNaN(x.depTs));
  const future = withDep.filter((x) => x.depTs >= now).sort((a, b) => a.depTs - b.depTs);
  const past = withDep.filter((x) => x.depTs < now).sort((a, b) => b.depTs - a.depTs);
  return {
    nextUp: future[0]?.order ?? null,
    upcoming: future.slice(1).map((x) => x.order),
    past: past.map((x) => x.order),
  };
}

function nextUpSubtitle(order: StoredOrder, trip: Trip | null): string {
  const first = order.slices[0];
  const last = order.slices[order.slices.length - 1];
  // For round-trips the last slice's destination is the origin city.
  // Prefer the Trip's primaryDestinationName, then the first outbound destination.
  const isRoundTrip = first?.origin === last?.destination;
  const toIata = isRoundTrip ? first?.destination : last?.destination;
  const to = trip?.primaryDestinationName ?? findAirport(toIata)?.city ?? toIata ?? '';
  const dep = first ? new Date(first.departing_at) : null;
  const days = dep ? daysUntil(dep) : null;
  if (days === null) return `Heading to ${to}`;
  if (days <= 0) return `You're flying today — ${to}`;
  if (days === 1) return `Tomorrow — off to ${to}`;
  if (days <= 7) return `${days} days until ${to}`;
  return `${to} is on the calendar`;
}

function daysUntil(d: Date): number {
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
