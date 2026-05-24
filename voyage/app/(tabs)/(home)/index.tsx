import { View, Pressable, FlatList, ScrollView, Text } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listFilters,
  saveFilters,
  applyFilters,
  filtersAreEmpty,
  defaultFilters,
  type StoredFlightFilters,
} from '@/lib/flightFilters';
import ThemeScroller from '@/components/ThemeScroller';
import ThemedText from '@/components/ThemedText';
import AnimatedView from '@/components/AnimatedView';
import Icon from '@/components/Icon';
import SearchBar from '@/components/SearchBar';
import GeoGlyph from '@/components/GeoGlyph';
import { useFlightSearch } from '@/contexts/FlightSearchContext';
import { findAirport } from '@/lib/airports';
import type { FlightOffer, CabinClass } from '@/lib/flightTypes';
import {
  routeKey,
  saveTracked,
  listTracked,
  removeTracked,
  addRecent,
  listRecents,
  type RecentSearch,
  type TrackedRoute,
} from '@/utils/trackedStorage';
import { listTrips, tripsByStatus } from '@/utils/tripStorage';
import type { Trip } from '@/lib/tripTypes';
import { api } from '@/lib/apiBase';
import { INK, PARCHMENT, PARCHMENT_DEEP, PARCHMENT_COOL, SERIF, MOSS, BRICK } from '@/lib/theme';
import { useThemeColors } from '@/contexts/ThemeColors';

type Query = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: string;
  cabin?: string;
};

type Pill = {
  label: string;
  hint: string;
  destination: string;
  daysOut?: number;
  nights?: number;
  cabin?: CabinClass;
};

const PILLS: Pill[] = [
  { label: 'Weekend escape', hint: 'Two nights, somewhere warm', destination: 'MIA', daysOut: 10, nights: 2 },
  { label: 'City break', hint: 'Culture + late dinners', destination: 'CDG', daysOut: 30, nights: 4 },
  { label: 'Beach reset', hint: 'Toes in sand by Sunday', destination: 'LAX', daysOut: 21, nights: 5 },
  { label: 'Mountain air', hint: 'Cool, quiet, pine', destination: 'DEN', daysOut: 14, nights: 3 },
  { label: 'Sunshine break', hint: 'Chase the sun', destination: 'LAS', daysOut: 18, nights: 3 },
  { label: 'Europe this month', hint: 'Fly cheap, wander far', destination: 'LHR', daysOut: 25, nights: 5 },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Late-night planning?';
}

async function fetchOffers(body: Record<string, unknown>): Promise<FlightOffer[]> {
  const res = await fetch(api('/api/flights/search'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(msg.error || `Search failed (${res.status})`);
  }
  const data = (await res.json().catch(() => ({}))) as { offers?: FlightOffer[] };
  return Array.isArray(data.offers) ? data.offers : [];
}

export default function HomeScreen() {
  const url = useLocalSearchParams<Query>();
  const { params, setParams } = useFlightSearch();
  const [currentFilters, setCurrentFilters] = useState<StoredFlightFilters>(defaultFilters());

  // Reload filters whenever the screen comes into focus (e.g. after returning from /screens/filters)
  useFocusEffect(
    useCallback(() => {
      listFilters().then(setCurrentFilters);
    }, []),
  );

  useEffect(() => {
    if (url.origin && url.origin !== params.origin) {
      setParams({
        origin: String(url.origin),
        destination: String(url.destination ?? ''),
        departureDate: String(url.departureDate ?? ''),
        returnDate: url.returnDate ? String(url.returnDate) : undefined,
        adults: url.adults ? Number(url.adults) : 1,
        cabin: (url.cabin as any) ?? 'economy',
      });
    }
  }, [url.origin, url.destination, url.departureDate, url.returnDate, url.adults, url.cabin]);

  const ready = Boolean(params.origin && params.destination && params.departureDate);

  useEffect(() => {
    if (ready) addRecent(params.origin, params.destination);
  }, [ready, params.origin, params.destination]);

  const q = useQuery({
    queryKey: ['flights', params],
    queryFn: () =>
      fetchOffers({
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate || undefined,
        adults: params.adults,
        cabin: params.cabin,
      }),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });

  if (!ready) return <AssistantHome />;

  return (
    <>
      <SearchBar />
      <ThemeScroller>
        <AnimatedView animation="scaleIn" className="flex-1 mt-2">
          <RouteHeader />
          {q.isLoading ? (
            <OfferSkeletons />
          ) : q.error ? (
            <View className="mt-4 rounded-3xl p-5" style={{ backgroundColor: '#f6e1d7' }}>
              <Text style={{ fontFamily: SERIF, color: BRICK, fontSize: 22, letterSpacing: -0.2 }}>
                No live fares just yet.
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.75,
                  fontSize: 14,
                  marginTop: 8,
                  fontStyle: 'italic',
                  lineHeight: 20,
                }}
              >
                The route is saved, but I couldn't bring back prices for this search. Try again in a
                moment, tweak the dates, or ask the concierge to hunt for alternatives.
              </Text>
              <View className="flex-row mt-4">
                <Pressable
                  onPress={() => q.refetch()}
                  className="px-4 py-2 rounded-full mr-2"
                  style={{ backgroundColor: INK }}
                >
                  <ThemedText style={{ color: PARCHMENT, fontWeight: '600', fontSize: 12 }}>
                    Try again
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(tabs)/chat')}
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: 'rgba(19,26,42,0.08)' }}
                >
                  <ThemedText style={{ color: INK, fontWeight: '600', fontSize: 12 }}>
                    Ask assistant
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : !q.data?.length ? (
            <EmptyOffers />
          ) : (
            <>
              {!filtersAreEmpty(currentFilters) && (
                <ActiveFilterStrip
                  filters={currentFilters}
                  onClear={() => {
                    const cleared = defaultFilters();
                    setCurrentFilters(cleared);
                    saveFilters(cleared);
                  }}
                />
              )}
              <OfferList offers={applyFilters(q.data, currentFilters)} />
            </>
          )}
        </AnimatedView>
      </ThemeScroller>
    </>
  );
}

function AssistantHome() {
  const { setParams } = useFlightSearch();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const [tracked, setTracked] = useState<TrackedRoute[]>([]);
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  const load = useCallback(async () => {
    const [t, r, ts] = await Promise.all([listTracked(), listRecents(), listTrips()]);
    setTracked(t);
    setRecents(r);
    setTrips(ts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const homeAirport = recents[0]?.origin ?? tracked[0]?.origin ?? 'JFK';
  const homeCity = findAirport(homeAirport)?.city ?? homeAirport;

  const pills = useMemo<Pill[]>(() => {
    if (recents.length === 0) return PILLS;
    const seen = new Set(recents.map((r) => r.destination));
    const learned: Pill[] = recents.slice(0, 2).map((r) => {
      const ap = findAirport(r.destination);
      return {
        label: `Back to ${ap?.city ?? r.destination}`,
        hint: 'You looked recently',
        destination: r.destination,
        daysOut: 21,
        nights: 3,
      };
    });
    const rest = PILLS.filter((p) => !seen.has(p.destination)).slice(0, 4);
    return [...learned, ...rest];
  }, [recents]);

  const hero = pills[0];
  const remaining = pills.slice(1);

  const drops = useMemo(
    () =>
      tracked
        .filter(
          (r) =>
            (r.history?.length ?? 0) > 1 &&
            r.lastPrice < r.history![r.history!.length - 2].price,
        )
        .slice(0, 3),
    [tracked],
  );

  const pickDate = (daysOut: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOut);
    return d.toISOString().slice(0, 10);
  };

  const runPill = (p: Pill) => {
    const daysOut = p.daysOut ?? 21;
    const nights = p.nights;
    const departureDate = pickDate(daysOut);
    const returnDate = nights ? pickDate(daysOut + nights) : undefined;
    setParams({
      origin: homeAirport,
      destination: p.destination,
      departureDate,
      returnDate,
      adults: 1,
      cabin: p.cabin ?? 'economy',
    });
    router.setParams({
      origin: homeAirport,
      destination: p.destination,
      departureDate,
      returnDate: returnDate ?? '',
      adults: '1',
      cabin: p.cabin ?? 'economy',
    });
  };

  return (
    <ThemeScroller contentContainerStyle={{ paddingBottom: 96 }}>
      <AnimatedView animation="scaleIn" className="flex-1 pt-4">
        <View className="mb-7">
          <ThemedText style={{ fontFamily: SERIF, fontSize: 16, opacity: 0.6 }}>
            {greeting()},
          </ThemedText>
          <ThemedText className="text-4xl font-bold mt-1" style={{ letterSpacing: -0.5 }}>
            Where's next?
          </ThemedText>
          <ThemedText
            className="mt-2 opacity-70"
            style={{ fontFamily: SERIF, fontSize: 15, fontStyle: 'italic' }}
          >
            I'll watch prices and bring deals back to you.
          </ThemedText>
        </View>

        {hero ? (
          <Pressable onPress={() => runPill(hero)} className="mb-3">
            <View
              className="rounded-3xl overflow-hidden"
              style={{
                backgroundColor: isDark ? themeColors.secondary : '#f1ece4',
                minHeight: 180,
                padding: 22,
                justifyContent: 'space-between',
              }}
            >
              <View>
                <ThemedText
                  style={{ fontFamily: SERIF, color: isDark ? themeColors.text : INK, opacity: 0.55, fontSize: 13 }}
                >
                  For you today
                </ThemedText>
                <ThemedText
                  style={{
                    fontFamily: SERIF,
                    color: isDark ? themeColors.text : INK,
                    fontSize: 30,
                    marginTop: 6,
                    lineHeight: 34,
                  }}
                >
                  {hero.label}
                </ThemedText>
                <ThemedText style={{ color: isDark ? themeColors.text : INK, opacity: 0.65, marginTop: 4, fontSize: 13 }}>
                  {hero.hint} · from {homeCity}
                </ThemedText>
              </View>
              <View className="flex-row items-end justify-between">
                <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: isDark ? '#0a0a0a' : INK }}>
                  <ThemedText style={{ color: '#f1ece4', fontSize: 12, fontWeight: '600' }}>
                    Show me flights
                  </ThemedText>
                </View>
                <View style={{ opacity: 0.9 }}>
                  <GeoGlyph iata={hero.destination} size={88} color={isDark ? themeColors.text : INK} accent="#c97d4a" />
                </View>
              </View>
            </View>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 px-5 mb-7"
          style={{ marginTop: 4 }}
        >
          {remaining.map((p, i) => (
            <Pressable
              key={p.label}
              onPress={() => runPill(p)}
              className="mr-2 rounded-2xl"
              style={{
                width: 150,
                minHeight: 148,
                padding: 14,
                backgroundColor: isDark
                  ? i % 2 === 0
                    ? themeColors.secondary
                    : '#1f2937'
                  : i % 2 === 0
                    ? PARCHMENT_DEEP
                    : PARCHMENT_COOL,
              }}
            >
              <GeoGlyph iata={p.destination} size={42} color={isDark ? themeColors.text : INK} accent="#b86b3d" />
              <ThemedText
                style={{ fontFamily: SERIF, color: isDark ? themeColors.text : INK, fontSize: 16, lineHeight: 20, marginTop: 10 }}
                numberOfLines={2}
              >
                {p.label}
              </ThemedText>
              <ThemedText
                style={{ fontFamily: SERIF, fontStyle: 'italic', color: isDark ? themeColors.text : INK, opacity: 0.55, fontSize: 11, lineHeight: 15, marginTop: 3 }}
                numberOfLines={2}
              >
                {p.hint}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {drops.length > 0 ? (
          <View className="mb-6">
            <SectionHeader>A price just dropped</SectionHeader>
            {drops.map((r) => {
              const prev = r.history![r.history!.length - 2].price;
              const saved = Math.round(prev - r.lastPrice);
              const from = findAirport(r.origin);
              const to = findAirport(r.destination);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => router.push('/(tabs)/favorites')}
                  className="rounded-2xl p-4 mb-2 flex-row items-center"
                  style={{ backgroundColor: isDark ? themeColors.secondary : '#e6f2eb' }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: isDark ? '#1f3a2a' : '#b8dcc6' }}
                  >
                    <Icon name="TrendingDown" size={18} color={isDark ? '#7fcc99' : '#1f6b43'} />
                  </View>
                  <View className="flex-1">
                    <ThemedText style={{ color: isDark ? themeColors.text : INK, fontWeight: '600' }}>
                      {from?.city ?? r.origin} → {to?.city ?? r.destination}
                    </ThemedText>
                    <ThemedText style={{ color: isDark ? themeColors.text : INK, opacity: 0.7, fontSize: 12, marginTop: 2 }}>
                      saved {r.currency} {saved} · now {r.currency} {Math.round(r.lastPrice)}
                    </ThemedText>
                  </View>
                  <Icon name="ChevronRight" size={18} color={isDark ? themeColors.text : INK} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {(() => {
          const buckets = tripsByStatus(trips);
          const visible = [...buckets.active, ...buckets.upcoming, ...buckets.planning].slice(0, 6);
          if (visible.length === 0) return null;
          return (
            <View className="mb-7">
              <SectionHeader>Your trips</SectionHeader>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
                {visible.map((t) => {
                  const isActive = t.status === 'active';
                  const startMs = Date.parse(t.startDate);
                  const daysOut = Number.isFinite(startMs)
                    ? Math.max(0, Math.round((startMs - Date.now()) / 86_400_000))
                    : null;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        const oid = t.orderIds[0];
                        if (oid) router.push({ pathname: '/screens/trip-detail', params: { id: oid } });
                        else router.push({ pathname: '/screens/itinerary/[tripId]', params: { tripId: t.id } });
                      }}
                      className="mr-2 rounded-2xl"
                      style={{
                        width: 200,
                        padding: 14,
                        backgroundColor: isActive
                          ? (isDark ? '#0a2516' : '#e0eee5')
                          : (isDark ? themeColors.secondary : '#f1ece4'),
                        borderWidth: isActive ? 1 : 0,
                        borderColor: 'rgba(31,107,67,0.35)',
                      }}>
                      <View className="flex-row items-center mb-2">
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isActive
                              ? MOSS
                              : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(19,26,42,0.08)'),
                          }}>
                          <ThemedText
                            style={{
                              color: isActive ? PARCHMENT : (isDark ? themeColors.text : INK),
                              fontSize: 10,
                              fontWeight: '600',
                              letterSpacing: 0.4,
                              textTransform: 'uppercase',
                            }}>
                            {isActive ? 'Active' : t.status}
                          </ThemedText>
                        </View>
                        <ThemedText
                          style={{
                            marginLeft: 'auto',
                            color: isDark ? themeColors.text : INK,
                            opacity: 0.55,
                            fontSize: 10,
                            fontStyle: 'italic',
                          }}>
                          {isActive ? 'now' : daysOut !== null ? `in ${daysOut}d` : ''}
                        </ThemedText>
                      </View>
                      <GeoGlyph
                        iata={t.primaryDestination || t.coverGlyphIata || ''}
                        size={42}
                        color={isDark ? themeColors.text : INK}
                        accent={BRICK}
                      />
                      <ThemedText
                        style={{
                          fontFamily: SERIF,
                          color: isDark ? themeColors.text : INK,
                          fontSize: 17,
                          marginTop: 10,
                          letterSpacing: -0.2,
                        }}
                        numberOfLines={1}>
                        {t.primaryDestinationName}
                      </ThemedText>
                      <ThemedText
                        style={{
                          color: isDark ? themeColors.text : INK,
                          opacity: 0.55,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                        numberOfLines={1}>
                        {t.startDate}
                        {t.endDate ? ` → ${t.endDate}` : ''}
                      </ThemedText>
                      <View className="flex-row items-center mt-2">
                        <Icon name="BedDouble" size={11} color={isDark ? themeColors.text : INK} />
                        <ThemedText
                          style={{
                            color: isDark ? themeColors.text : INK,
                            opacity: 0.6,
                            fontSize: 11,
                            marginLeft: 4,
                          }}>
                          {t.stayIds.length}
                        </ThemedText>
                        <Icon name="MapPin" size={11} color={isDark ? themeColors.text : INK} style={{ marginLeft: 8 } as any} />
                        <ThemedText
                          style={{
                            color: isDark ? themeColors.text : INK,
                            opacity: 0.6,
                            fontSize: 11,
                            marginLeft: 4,
                          }}>
                          {t.activityIds.length}
                        </ThemedText>
                        <Icon name="Calendar" size={11} color={isDark ? themeColors.text : INK} style={{ marginLeft: 8 } as any} />
                        <ThemedText
                          style={{
                            color: isDark ? themeColors.text : INK,
                            opacity: 0.6,
                            fontSize: 11,
                            marginLeft: 4,
                          }}>
                          {t.itineraryDays.length}d
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          );
        })()}

        {tracked.length > 0 ? (
          <View className="mb-7">
            <SectionHeader>What I'm watching</SectionHeader>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
              {tracked.slice(0, 6).map((r) => {
                const from = findAirport(r.origin);
                const to = findAirport(r.destination);
                const lowest = r.lowestPrice ?? r.lastPrice;
                const atBest = r.lastPrice <= lowest;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => router.push('/(tabs)/favorites')}
                    className="mr-2 p-3 rounded-2xl"
                    style={{ width: 170, backgroundColor: isDark ? themeColors.secondary : '#f1ece4' }}
                  >
                    <GeoGlyph iata={r.destination} size={36} color={isDark ? themeColors.text : INK} accent="#c97d4a" />
                    <ThemedText
                      style={{ color: isDark ? themeColors.text : INK, fontWeight: '600', fontSize: 14, marginTop: 8 }}
                      numberOfLines={1}
                    >
                      {from?.city ?? r.origin} → {to?.city ?? r.destination}
                    </ThemedText>
                    <ThemedText
                      style={{ fontFamily: SERIF, color: isDark ? themeColors.text : INK, fontSize: 22, marginTop: 2 }}
                    >
                      {r.currency} {Math.round(r.lastPrice)}
                    </ThemedText>
                    <ThemedText
                      style={{
                        color: atBest ? (isDark ? '#7fcc99' : '#1f6b43') : (isDark ? themeColors.text : INK),
                        opacity: atBest ? 1 : 0.6,
                        fontSize: 11,
                        marginTop: 2,
                        fontStyle: atBest ? 'italic' : 'normal',
                      }}
                    >
                      {atBest ? 'at best price' : `low ${r.currency} ${Math.round(lowest)}`}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View className="mb-8">
          <SectionHeader>Want me to…</SectionHeader>
          <Pressable
            onPress={() => router.push('/(tabs)/chat')}
            className="flex-row items-center rounded-2xl p-4 mb-2"
            style={{ backgroundColor: isDark ? themeColors.secondary : '#f1ece4' }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: isDark ? '#0a0a0a' : INK }}
            >
              <Icon name="Sparkles" size={18} color="#f1ece4" />
            </View>
            <View className="flex-1">
              <ThemedText style={{ color: isDark ? themeColors.text : INK, fontWeight: '600' }}>Find you something</ThemedText>
              <ThemedText
                style={{ color: isDark ? themeColors.text : INK, opacity: 0.6, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}
              >
                "Cheapest to Tokyo in June under $800"
              </ThemedText>
            </View>
            <Icon name="ChevronRight" size={18} color={isDark ? themeColors.text : INK} />
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/screens/stays',
                params:
                  recents[0]?.destination
                    ? { city: recents[0].destination }
                    : tracked[0]?.destination
                      ? { city: tracked[0].destination }
                      : {},
              })
            }
            className="flex-row items-center rounded-2xl p-4 mb-2"
            style={{ backgroundColor: isDark ? themeColors.secondary : '#f1ece4' }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{
                backgroundColor: isDark ? '#1f2937' : PARCHMENT_COOL,
              }}
            >
              <Icon name="BedDouble" size={18} color={isDark ? themeColors.text : INK} />
            </View>
            <View className="flex-1">
              <ThemedText style={{ color: isDark ? themeColors.text : INK, fontWeight: '600' }}>
                Plan a stay
              </ThemedText>
              <ThemedText
                style={{
                  color: isDark ? themeColors.text : INK,
                  opacity: 0.6,
                  fontSize: 12,
                  marginTop: 2,
                  fontStyle: 'italic',
                }}
              >
                {recents[0]?.destination
                  ? `Hotels & hosts in ${findAirport(recents[0].destination)?.city ?? recents[0].destination}`
                  : 'Hotels, apartments, hosts'}
              </ThemedText>
            </View>
            <Icon name="ChevronRight" size={18} color={isDark ? themeColors.text : INK} />
          </Pressable>
          <Pressable
            onPress={() => {
              const discoverCity =
                findAirport(recents[0]?.destination ?? tracked[0]?.destination ?? '')?.city ?? 'Tokyo';
              router.push({ pathname: '/screens/discover/[city]', params: { city: discoverCity } });
            }}
            className="flex-row items-center rounded-2xl p-4 mb-2"
            style={{ backgroundColor: isDark ? themeColors.secondary : '#f1ece4' }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{
                backgroundColor: isDark ? '#1f3a2a' : '#e6f2eb',
              }}
            >
              <Icon name="Compass" size={18} color={isDark ? '#7fcc99' : MOSS} />
            </View>
            <View className="flex-1">
              <ThemedText style={{ color: isDark ? themeColors.text : INK, fontWeight: '600' }}>
                {recents[0]?.destination || tracked[0]?.destination
                  ? `Discover ${findAirport(recents[0]?.destination ?? tracked[0]?.destination ?? '')?.city ?? recents[0]?.destination ?? tracked[0]?.destination}`
                  : 'Discover somewhere new'}
              </ThemedText>
              <ThemedText
                style={{
                  color: isDark ? themeColors.text : INK,
                  opacity: 0.6,
                  fontSize: 12,
                  marginTop: 2,
                  fontStyle: 'italic',
                }}
              >
                Hand-picked things to do, saveable to a trip
              </ThemedText>
            </View>
            <Icon name="ChevronRight" size={18} color={isDark ? themeColors.text : INK} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/favorites')}
            className="flex-row items-center rounded-2xl p-4"
            style={{ backgroundColor: isDark ? themeColors.secondary : '#f1ece4' }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{
                backgroundColor: isDark ? themeColors.secondary : '#f1ece4',
                borderWidth: 1,
                borderColor: isDark ? themeColors.border : '#d8d2c4',
              }}
            >
              <Icon name="Bell" size={18} color={isDark ? themeColors.text : INK} />
            </View>
            <View className="flex-1">
              <ThemedText style={{ color: isDark ? themeColors.text : INK, fontWeight: '600' }}>
                Keep watch over {tracked.length} {tracked.length === 1 ? 'route' : 'routes'}
              </ThemedText>
              <ThemedText
                style={{ color: isDark ? themeColors.text : INK, opacity: 0.6, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}
              >
                Daily, weekly, or on demand
              </ThemedText>
            </View>
            <Icon name="ChevronRight" size={18} color={isDark ? themeColors.text : INK} />
          </Pressable>
        </View>

        <View className="items-center mb-8" style={{ opacity: 0.5 }}>
          <ThemedText style={{ fontFamily: SERIF, fontSize: 12, fontStyle: 'italic' }}>
            flying from {homeCity}
          </ThemedText>
        </View>
      </AnimatedView>
    </ThemeScroller>
  );
}

// ---- Active filter chip strip ----

function buildFilterLabels(f: StoredFlightFilters): string[] {
  const labels: string[] = [];
  if (f.maxPrice !== undefined) labels.push(`≤$${f.maxPrice}`);
  if (f.maxStops === 0) labels.push('Nonstop only');
  else if (f.maxStops === 1) labels.push('≤1 stop');
  else if (f.maxStops === 2) labels.push('≤2 stops');
  if (f.cabins && f.cabins.length > 0) labels.push(f.cabins.map((c) => c.replace('_', ' ')).join(', '));
  if (f.earliestDepart && f.latestDepart) labels.push(`${f.earliestDepart}–${f.latestDepart}`);
  else if (f.earliestDepart) labels.push(`After ${f.earliestDepart}`);
  else if (f.latestDepart) labels.push(`Before ${f.latestDepart}`);
  if (f.maxDurationMinutes !== undefined) labels.push(`≤${Math.round(f.maxDurationMinutes / 60)}h`);
  return labels;
}

function ActiveFilterStrip({
  filters,
  onClear,
}: {
  filters: StoredFlightFilters;
  onClear: () => void;
}) {
  const labels = buildFilterLabels(filters);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-5 px-5 mb-3"
      contentContainerStyle={{ alignItems: 'center', gap: 6 }}
    >
      {labels.map((lbl) => (
        <View
          key={lbl}
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: PARCHMENT_COOL }}
        >
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 12 }}>{lbl}</Text>
        </View>
      ))}
      <Pressable
        onPress={onClear}
        className="flex-row items-center px-3 py-1 rounded-full"
        style={{ backgroundColor: 'rgba(19,26,42,0.08)' }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Icon name="X" size={11} color={INK} />
        <Text style={{ fontFamily: SERIF, color: INK, fontSize: 12, marginLeft: 4 }}>
          Clear filters
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <ThemedText
      style={{
        fontFamily: SERIF,
        fontSize: 18,
        marginBottom: 10,
        letterSpacing: -0.2,
      }}
    >
      {children}
    </ThemedText>
  );
}

function RouteHeader() {
  const { params } = useFlightSearch();
  const from = findAirport(params.origin);
  const to = findAirport(params.destination);
  return (
    <View className="mb-3">
      <ThemedText style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: -0.3 }}>
        {from?.city ?? params.origin} → {to?.city ?? params.destination}
      </ThemedText>
      <ThemedText className="opacity-60 text-sm mt-1">
        {params.departureDate}
        {params.returnDate ? ` – ${params.returnDate}` : ''} · {params.adults} adult
        {params.adults > 1 ? 's' : ''} · {params.cabin.replace('_', ' ')}
      </ThemedText>
    </View>
  );
}

function ResultsSummary({ offers }: { offers: FlightOffer[] }) {
  const prices = offers.map((o) => parseFloat(o.totalAmount)).filter((n) => !Number.isNaN(n));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = offers[0]?.totalCurrency ?? 'USD';
  const nonstopCount = offers.filter((o) =>
    o.slices.every((s) => s.segments.length === 1),
  ).length;
  return (
    <View
      className="flex-row items-center rounded-2xl mb-3 px-4 py-3"
      style={{ backgroundColor: PARCHMENT_COOL }}
    >
      <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>
        {offers.length} offer{offers.length === 1 ? '' : 's'}
      </Text>
      <Text style={{ color: INK, opacity: 0.4, fontSize: 13, marginHorizontal: 8 }}>·</Text>
      <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.7, fontSize: 13 }}>
        from {currency} {Math.round(min)}
        {max > min ? ` · to ${Math.round(max)}` : ''}
      </Text>
      <View className="ml-auto flex-row items-center">
        <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.6, fontSize: 12, fontStyle: 'italic' }}>
          {nonstopCount > 0 ? `${nonstopCount} nonstop` : 'all with stops'}
        </Text>
        <Pressable
          onPress={() => router.push('/screens/filters')}
          accessibilityLabel="Open filters"
          accessibilityRole="button"
          hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          className="ml-3 h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: INK }}
        >
          <Icon name="SlidersHorizontal" size={12} color={PARCHMENT} />
        </Pressable>
      </View>
    </View>
  );
}

function EmptyOffers() {
  return (
    <View
      className="mt-4 rounded-3xl p-6 items-center"
      style={{ backgroundColor: PARCHMENT_DEEP }}
    >
      <GeoGlyph kind="compass" size={54} color={INK} accent="#c97d4a" />
      <Text
        style={{ fontFamily: SERIF, color: INK, fontSize: 18, marginTop: 10, letterSpacing: -0.2 }}
      >
        Nothing on this route today
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
        }}
      >
        Try different dates, or loosen the cabin. I'll keep looking.
      </Text>
    </View>
  );
}

function OfferSkeletons() {
  return (
    <View className="mt-1">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className="rounded-2xl mb-3 p-4"
          style={{ backgroundColor: PARCHMENT_DEEP, opacity: 1 - i * 0.2 }}
        >
          <View className="flex-row justify-between mb-4">
            <View style={{ height: 16, width: 110, backgroundColor: 'rgba(19,26,42,0.08)', borderRadius: 4 }} />
            <View style={{ height: 20, width: 80, backgroundColor: 'rgba(19,26,42,0.1)', borderRadius: 4 }} />
          </View>
          <View className="flex-row items-center">
            <View style={{ height: 28, width: 48, backgroundColor: 'rgba(19,26,42,0.08)', borderRadius: 4 }} />
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(19,26,42,0.1)', marginHorizontal: 10 }} />
            <View style={{ height: 28, width: 48, backgroundColor: 'rgba(19,26,42,0.08)', borderRadius: 4 }} />
          </View>
          <View style={{ height: 12, width: '40%', backgroundColor: 'rgba(19,26,42,0.06)', borderRadius: 4, marginTop: 10 }} />
        </View>
      ))}
    </View>
  );
}

// --- Superlative helpers ---

/** Returns the total duration in minutes for the first outbound slice. */
function offerDurationMin(offer: FlightOffer): number {
  return parseDurationMin(offer.slices[0]?.duration);
}

/** Returns true when every slice of the offer has exactly 1 segment (nonstop). */
function isNonstop(offer: FlightOffer): boolean {
  return offer.slices.length > 0 && offer.slices.every((s) => s.segments.length === 1);
}

/** Returns the arrival timestamp (ms) of the last segment on the first outbound slice. */
function arrivalMs(offer: FlightOffer): number {
  const first = offer.slices[0];
  if (!first) return Infinity;
  const last = first.segments[first.segments.length - 1];
  if (!last?.arriving_at) return Infinity;
  const t = Date.parse(last.arriving_at);
  return Number.isFinite(t) ? t : Infinity;
}

type SuperlativeBadge = {
  label: string; // e.g. "FASTEST · 7h 20m"
  color: string; // background colour of the strip
};

/**
 * Compute at most one superlative badge per offer index.
 * The cheapest offer (index 0) always gets the green "LOWEST FARE" strip and
 * never receives a superlative badge here.
 * Priority: MOST DIRECT > FASTEST > ARRIVES FIRST.
 */
function computeSuperlatives(offers: FlightOffer[]): Map<string, SuperlativeBadge> {
  const badges = new Map<string, SuperlativeBadge>();
  if (offers.length < 2) return badges;

  // Only consider non-cheapest offers (skip index 0).
  const candidates = offers.slice(1);

  // MOST DIRECT: sole nonstop offer among ALL offers (not just candidates).
  const nonstopCount = offers.filter(isNonstop).length;
  if (nonstopCount === 1) {
    const sole = candidates.find(isNonstop);
    if (sole) {
      badges.set(sole.id, { label: 'MOST DIRECT · 1 nonstop', color: PARCHMENT_COOL });
    }
  }

  // FASTEST: shortest duration among candidates that haven't already been badged.
  const unbadgedCandidates = candidates.filter((o) => !badges.has(o.id));
  if (unbadgedCandidates.length > 0) {
    const minDur = Math.min(...unbadgedCandidates.map(offerDurationMin).filter((d) => d > 0));
    if (minDur > 0) {
      const fastest = unbadgedCandidates.find((o) => offerDurationMin(o) === minDur);
      if (fastest) {
        badges.set(fastest.id, {
          label: `FASTEST · ${formatMin(minDur)}`,
          color: PARCHMENT_COOL,
        });
      }
    }
  }

  // ARRIVES FIRST: earliest arrival among remaining unbadged candidates.
  const stillUnbadged = candidates.filter((o) => !badges.has(o.id));
  if (stillUnbadged.length > 0) {
    const minArr = Math.min(...stillUnbadged.map(arrivalMs));
    if (Number.isFinite(minArr)) {
      const earliest = stillUnbadged.find((o) => arrivalMs(o) === minArr);
      if (earliest) {
        const first = earliest.slices[0];
        const lastSeg = first?.segments[first.segments.length - 1];
        const timeLabel = formatTime(lastSeg?.arriving_at);
        badges.set(earliest.id, {
          label: timeLabel ? `ARRIVES FIRST · ${timeLabel}` : 'ARRIVES FIRST',
          color: PARCHMENT_COOL,
        });
      }
    }
  }

  return badges;
}

function OfferList({ offers }: { offers: FlightOffer[] }) {
  const superlatives = useMemo(() => computeSuperlatives(offers), [offers]);
  return (
    <>
      <ResultsSummary offers={offers} />
      <FlatList
        scrollEnabled={false}
        data={offers}
        keyExtractor={(o) => o.id}
        renderItem={({ item, index }) => (
          <OfferRow
            offer={item}
            rank={index}
            cheapest={offers[0].totalAmount}
            badge={superlatives.get(item.id)}
            alternateBackground={index % 2 === 0 ? PARCHMENT_DEEP : PARCHMENT_COOL}
          />
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </>
  );
}

function OfferRow({
  offer,
  rank,
  cheapest,
  badge,
  alternateBackground,
}: {
  offer: FlightOffer;
  rank: number;
  cheapest: string;
  badge?: SuperlativeBadge;
  alternateBackground?: string;
}) {
  const price = parseFloat(offer.totalAmount);
  const cheapestNum = parseFloat(cheapest);
  const isCheapest = rank === 0;
  const premium = price - cheapestNum;
  const first = offer.slices[0];
  const firstSeg = first?.segments[0];
  const lastSeg = first?.segments[first.segments.length - 1];
  const stops = Math.max(0, (first?.segments.length ?? 1) - 1);
  const dur = parseDurationMin(first?.duration);

  // Card background: cheapest stays PARCHMENT_DEEP; badged rows use badge colour as
  // their strip but keep card body in PARCHMENT_DEEP; unbadged non-cheapest rows
  // alternate between PARCHMENT_DEEP and PARCHMENT_COOL to break the visual monotony.
  const cardBg = isCheapest || badge ? PARCHMENT_DEEP : (alternateBackground ?? PARCHMENT_DEEP);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/screens/product-detail', params: { id: offer.id } })}
      className="rounded-3xl overflow-hidden"
      style={{ backgroundColor: cardBg }}
    >
      {isCheapest ? (
        <View
          className="flex-row items-center px-4 py-1.5"
          style={{ backgroundColor: MOSS }}
        >
          <Text
            style={{
              fontFamily: SERIF,
              color: PARCHMENT,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Lowest fare
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: PARCHMENT,
              opacity: 0.75,
              fontSize: 11,
              marginLeft: 8,
              fontStyle: 'italic',
            }}
          >
            among {rank + 1}+
          </Text>
        </View>
      ) : badge ? (
        <View
          className="flex-row items-center px-4 py-1.5"
          style={{ backgroundColor: badge.color }}
        >
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            {badge.label}
          </Text>
        </View>
      ) : null}

      <View className="p-4">
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1 pr-3">
            <View
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: PARCHMENT }}
            >
              <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13 }}>
                {offer.owner.iata_code ?? offer.owner.name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text
                style={{ fontFamily: SERIF, color: INK, fontSize: 15, letterSpacing: -0.1 }}
                numberOfLines={1}
              >
                {offer.owner.name}
              </Text>
              <Text
                style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 12, marginTop: 1 }}
              >
                {stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`}
                {dur ? ` · ${formatMin(dur)}` : ''}
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 22,
                letterSpacing: -0.3,
              }}
            >
              {offer.totalCurrency} {Math.round(price)}
            </Text>
            {!isCheapest && premium > 0 ? (
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 11,
                  marginTop: 2,
                  fontStyle: 'italic',
                }}
              >
                + {offer.totalCurrency} {Math.round(premium)}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center">
          <View>
            <Text style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.5 }}>
              {first?.origin}
            </Text>
            <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 11, marginTop: 1 }}>
              {formatTime(firstSeg?.departing_at)}
            </Text>
          </View>
          <View className="flex-1 items-center mx-3">
            <View
              style={{
                height: 1,
                width: '100%',
                backgroundColor: 'rgba(19,26,42,0.15)',
                position: 'absolute',
                top: 11,
              }}
            />
            <View
              className="px-2 items-center"
              style={{ backgroundColor: PARCHMENT_DEEP, zIndex: 1 }}
            >
              <Icon name="Plane" size={14} color={INK} />
            </View>
          </View>
          <View className="items-end">
            <Text style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.5 }}>
              {first?.destination}
            </Text>
            <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 11, marginTop: 1 }}>
              {formatTime(lastSeg?.arriving_at)}
            </Text>
          </View>
        </View>

        <View
          style={{
            height: 1,
            marginTop: 14,
            marginBottom: 12,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(19,26,42,0.12)',
          }}
        />

        <View className="flex-row items-center">
          <TrackButton offer={offer} />
          <View className="ml-auto flex-row items-center">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.55,
                fontSize: 11,
                fontStyle: 'italic',
                marginRight: 6,
              }}
            >
              {offer.expires_at ? 'expires soon' : 'see details'}
            </Text>
            <Icon name="ChevronRight" size={14} color={INK} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function parseDurationMin(iso?: string) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? '0', 10);
  const mm = parseInt(m[2] ?? '0', 10);
  return h * 60 + mm;
}

function formatMin(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TrackButton({ offer }: { offer: FlightOffer }) {
  const { params } = useFlightSearch();
  const id = routeKey({ ...params });
  const onTrack = async () => {
    const existing = await listTracked();
    if (existing.find((t) => t.id === id)) {
      await removeTracked(id);
      return;
    }
    await saveTracked({
      id,
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: params.adults,
      cabin: params.cabin,
      lastPrice: parseFloat(offer.totalAmount),
      currency: offer.totalCurrency,
      lastCheckedAt: Date.now(),
      createdAt: Date.now(),
      scanFrequency: 'daily',
      lowestPrice: parseFloat(offer.totalAmount),
      history: [{ price: parseFloat(offer.totalAmount), at: Date.now() }],
    });
  };
  return (
    <Pressable
      onPress={onTrack}
      className="flex-row items-center px-3 py-1.5 rounded-full"
      style={{ backgroundColor: 'rgba(19,26,42,0.08)' }}
    >
      <Icon name="Bell" size={12} color={INK} />
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          fontSize: 12,
          marginLeft: 6,
        }}
      >
        Watch price
      </Text>
    </Pressable>
  );
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
