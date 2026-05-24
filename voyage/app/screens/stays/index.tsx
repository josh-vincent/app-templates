import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AnimatedView from '@/components/AnimatedView';
import Counter from '@/components/forms/Counter';
import DateRangeCalendar from '@/components/DateRangeCalendar';
import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import StayCompareSheet from '@/components/StayCompareSheet';
import ThemeScroller from '@/components/ThemeScroller';
import ThemedText from '@/components/ThemedText';
import { useThemeColors } from '@/contexts/ThemeColors';
import { findAirport, searchAirports } from '@/lib/airports';
import { formatRange } from '@/lib/formatDate';
import { searchStays } from '@/lib/stays';
import type { StayAmenity, StayOffer } from '@/lib/stayTypes';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import {
  addRecentStaySearch,
  listRecentStaySearches,
  listSavedStays,
} from '@/utils/staysStorage';
import type { RecentStaySearch, SavedStay } from '@/lib/stayTypes';

type StayQuery = {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  rooms?: string;
};

const AMENITY_ICON: Record<StayAmenity, string> = {
  wifi: 'Wifi',
  pool: 'Waves',
  gym: 'Dumbbell',
  breakfast: 'Coffee',
  parking: 'CircleParking',
  pet_friendly: 'PawPrint',
  kitchen: 'Utensils',
  workspace: 'Laptop',
  view: 'Mountain',
  spa: 'Sparkles',
  beach: 'Umbrella',
  ac: 'Snowflake',
};

const AMENITY_LABEL: Record<StayAmenity, string> = {
  wifi: 'Wi-Fi',
  pool: 'Pool',
  gym: 'Gym',
  breakfast: 'Breakfast',
  parking: 'Parking',
  pet_friendly: 'Pets ok',
  kitchen: 'Kitchen',
  workspace: 'Workspace',
  view: 'View',
  spa: 'Spa',
  beach: 'Beach',
  ac: 'A/C',
};

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(a: string, b: string) {
  const start = Date.parse(a);
  const end = Date.parse(b);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export default function StaysScreen() {
  const url = useLocalSearchParams<StayQuery>();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const insets = useSafeAreaInsets();

  const [city, setCity] = useState<string>((url.city as string) ?? '');
  const [checkIn, setCheckIn] = useState<string>((url.checkIn as string) ?? '');
  const [checkOut, setCheckOut] = useState<string>((url.checkOut as string) ?? '');
  const [guests, setGuests] = useState<number>(url.guests ? Number(url.guests) : 2);
  const [rooms, setRooms] = useState<number>(url.rooms ? Number(url.rooms) : 1);
  const [showSearch, setShowSearch] = useState(false);

  // Bulk-select + compare state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareVisible, setCompareVisible] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 3) {
          // Cap at 3 — no-op for a 4th tap
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const ready = Boolean(city && checkIn && checkOut);
  const cityName = findAirport(city.toUpperCase())?.city ?? city;

  const q = useQuery({
    queryKey: ['stays', city, checkIn, checkOut, guests, rooms],
    queryFn: () => searchStays({ city, checkIn, checkOut, guests, rooms }),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });

  const applySearch = useCallback(
    (next: { city: string; checkIn: string; checkOut: string; guests: number; rooms: number }) => {
      setCity(next.city);
      setCheckIn(next.checkIn);
      setCheckOut(next.checkOut);
      setGuests(next.guests);
      setRooms(next.rooms);
      const resolved = findAirport(next.city.toUpperCase())?.city ?? next.city;
      addRecentStaySearch({ city: next.city, cityName: resolved, guests: next.guests });
      setShowSearch(false);
    },
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <StayTopBar
        ready={ready}
        city={city}
        cityName={cityName}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        rooms={rooms}
        onEdit={() => setShowSearch(true)}
        isDark={isDark}
      />

      {ready ? (
        <ThemeScroller>
          <AnimatedView animation="scaleIn" className="flex-1">
            {q.isLoading ? (
              <StaySkeletons />
            ) : q.error ? (
              <StayError onRetry={() => q.refetch()} />
            ) : !q.data?.length ? (
              <StayEmpty />
            ) : (
              <>
                <ResultsSummary
                  offers={q.data}
                  cityName={cityName}
                  nights={nightsBetween(checkIn, checkOut)}
                />
                <FlatList
                  scrollEnabled={false}
                  data={q.data}
                  keyExtractor={(o) => o.id}
                  renderItem={({ item, index }) => (
                    <StayCard
                      offer={item}
                      checkIn={checkIn}
                      checkOut={checkOut}
                      guests={guests}
                      rooms={rooms}
                      isCheapest={index === 0}
                      totalCount={q.data!.length}
                      isDark={isDark}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelection(item.id)}
                      onLongPress={() => {
                        setSelectMode(true);
                        toggleSelection(item.id);
                      }}
                    />
                  )}
                  ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                  contentContainerStyle={{ paddingBottom: 80 }}
                />
              </>
            )}
          </AnimatedView>
        </ThemeScroller>
      ) : (
        <StaysHome
          onSearch={() => setShowSearch(true)}
          onPickStock={(pickedCity) => {
            applySearch({
              city: pickedCity,
              checkIn: todayPlus(14),
              checkOut: todayPlus(17),
              guests: 2,
              rooms: 1,
            });
          }}
          isDark={isDark}
          themeColors={themeColors}
        />
      )}

      <StaySearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onApply={applySearch}
        initial={{ city, checkIn, checkOut, guests, rooms }}
      />

      {/* Bulk-select bottom action bar */}
      {selectMode ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: INK,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          <Pressable
            onPress={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(241,236,228,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 14 }}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={selectedIds.size < 2 || selectedIds.size > 3}
            onPress={() => setCompareVisible(true)}
            style={{
              flex: 2,
              height: 46,
              borderRadius: 999,
              backgroundColor: selectedIds.size >= 2 && selectedIds.size <= 3 ? MOSS : 'rgba(31,107,67,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 14 }}>
              {selectedIds.size < 2
                ? 'Select 2–3 stays'
                : `Compare ${selectedIds.size} stay${selectedIds.size === 1 ? '' : 's'}`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Compare sheet */}
      <StayCompareSheet
        visible={compareVisible}
        onClose={() => setCompareVisible(false)}
        stays={(q.data ?? []).filter((o) => selectedIds.has(o.id))}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        rooms={rooms}
      />
    </View>
  );
}

function StayTopBar({
  ready,
  city,
  cityName,
  checkIn,
  checkOut,
  guests,
  rooms,
  onEdit,
  isDark,
}: {
  ready: boolean;
  city: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  onEdit: () => void;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const nights = nightsBetween(checkIn, checkOut);
  const summary = ready
    ? `${cityName || city} · ${nights} night${nights === 1 ? '' : 's'} · ${guests} guest${guests === 1 ? '' : 's'}`
    : 'Where to stay?';
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
        <Pressable onPress={onEdit} style={{ flex: 1 }}>
          <View
            className="flex-row items-center rounded-full px-5"
            style={{
              height: 50,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : PARCHMENT,
              borderWidth: isDark ? 0 : 1,
              borderColor: 'rgba(19,26,42,0.06)',
            }}>
            <Icon name="BedDouble" size={16} color={isDark ? PARCHMENT : INK} strokeWidth={2.4} />
            <Text
              numberOfLines={1}
              style={{
                marginLeft: 10,
                fontFamily: SERIF,
                color: isDark ? PARCHMENT : INK,
                fontSize: 14,
                flex: 1,
              }}>
              {summary}
            </Text>
            <Icon name="SlidersHorizontal" size={14} color={isDark ? PARCHMENT : INK} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const STOCK_DESTINATIONS: Array<{ city: string; label: string; hint: string }> = [
  { city: 'MIA', label: 'Miami', hint: 'Sand, late dinners, art deco' },
  { city: 'CDG', label: 'Paris', hint: 'Le Marais walks, quiet rooms' },
  { city: 'LHR', label: 'London', hint: 'Townhouse stays, museum days' },
  { city: 'NRT', label: 'Tokyo', hint: 'Boutique ryokan or business floor' },
  { city: 'BCN', label: 'Barcelona', hint: 'Gòtic apartments, sea air' },
  { city: 'FCO', label: 'Rome', hint: 'Trastevere flats, espresso routine' },
];

function StaysHome({
  onSearch,
  onPickStock,
  isDark,
  themeColors,
}: {
  onSearch: () => void;
  onPickStock: (city: string) => void;
  isDark: boolean;
  themeColors: ReturnType<typeof useThemeColors>;
}) {
  const [recents, setRecents] = useState<RecentStaySearch[]>([]);
  const [saved, setSaved] = useState<SavedStay[]>([]);

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([listRecentStaySearches(), listSavedStays()]);
    setRecents(r);
    setSaved(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const hasRecents = recents.length > 0;
  const ideas = hasRecents ? [] : STOCK_DESTINATIONS;

  return (
    <ThemeScroller>
      <AnimatedView animation="scaleIn" className="flex-1 pt-2">
        <View className="mb-6">
          <ThemedText style={{ fontFamily: SERIF, fontSize: 16, opacity: 0.6 }}>Stays</ThemedText>
          <ThemedText className="text-4xl font-bold mt-1" style={{ letterSpacing: -0.5 }}>
            Where will you stay?
          </ThemedText>
          <ThemedText
            className="mt-2 opacity-70"
            style={{ fontFamily: SERIF, fontSize: 15, fontStyle: 'italic' }}>
            Hotels, apartments, hosts — I'll surface what fits the trip.
          </ThemedText>
        </View>

        <Pressable onPress={onSearch} className="mb-3">
          <View
            className="rounded-3xl overflow-hidden"
            style={{
              backgroundColor: isDark ? themeColors.secondary : '#f1ece4',
              minHeight: 180,
              padding: 22,
              justifyContent: 'space-between',
            }}>
            <View>
              <ThemedText
                style={{
                  fontFamily: SERIF,
                  color: isDark ? themeColors.text : INK,
                  opacity: 0.55,
                  fontSize: 13,
                }}>
                Start the hunt
              </ThemedText>
              <ThemedText
                style={{
                  fontFamily: SERIF,
                  color: isDark ? themeColors.text : INK,
                  fontSize: 30,
                  marginTop: 6,
                  lineHeight: 34,
                }}>
                Find a stay
              </ThemedText>
              <ThemedText
                style={{
                  color: isDark ? themeColors.text : INK,
                  opacity: 0.65,
                  marginTop: 4,
                  fontSize: 13,
                }}>
                City, dates, who's coming. I'll do the rest.
              </ThemedText>
            </View>
            <View className="flex-row items-end justify-between">
              <View
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: isDark ? '#0a0a0a' : INK }}>
                <ThemedText style={{ color: PARCHMENT, fontSize: 12, fontWeight: '600' }}>
                  Plan a stay
                </ThemedText>
              </View>
              <Icon name="BedDouble" size={56} color={isDark ? themeColors.text : INK} />
            </View>
          </View>
        </Pressable>

        {hasRecents ? (
          <View className="mb-6 mt-2">
            <SectionHeader>Searched recently</SectionHeader>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-5 px-5"
              style={{ marginTop: 4 }}>
              {recents.map((r) => (
                <Pressable
                  key={r.city + r.at}
                  onPress={() => onPickStock(r.city)}
                  className="mr-2 rounded-2xl"
                  style={{
                    width: 150,
                    padding: 14,
                    backgroundColor: isDark ? themeColors.secondary : '#eceae4',
                  }}>
                  <GeoGlyph
                    iata={r.city}
                    size={42}
                    color={isDark ? themeColors.text : INK}
                    accent={BRICK}
                  />
                  <ThemedText
                    style={{
                      fontFamily: SERIF,
                      color: isDark ? themeColors.text : INK,
                      fontSize: 16,
                      marginTop: 10,
                    }}
                    numberOfLines={1}>
                    {r.cityName}
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: isDark ? themeColors.text : INK,
                      opacity: 0.6,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                    numberOfLines={1}>
                    {r.guests} guest{r.guests === 1 ? '' : 's'}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {ideas.length > 0 ? (
          <View className="mb-7 mt-2">
            <SectionHeader>Cities I know well</SectionHeader>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-5 px-5"
              style={{ marginTop: 4 }}>
              {ideas.map((p, i) => (
                <Pressable
                  key={p.city}
                  onPress={() => onPickStock(p.city)}
                  className="mr-2 rounded-2xl"
                  style={{
                    width: 160,
                    padding: 14,
                    backgroundColor: isDark
                      ? i % 2 === 0
                        ? themeColors.secondary
                        : '#1f2937'
                      : i % 2 === 0
                        ? '#eceae4'
                        : '#e3e7e1',
                  }}>
                  <GeoGlyph
                    iata={p.city}
                    size={42}
                    color={isDark ? themeColors.text : INK}
                    accent={BRICK}
                  />
                  <ThemedText
                    style={{
                      fontFamily: SERIF,
                      color: isDark ? themeColors.text : INK,
                      fontSize: 16,
                      marginTop: 10,
                    }}
                    numberOfLines={1}>
                    {p.label}
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: isDark ? themeColors.text : INK,
                      opacity: 0.6,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                    numberOfLines={1}>
                    {p.hint}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {saved.length > 0 ? (
          <View className="mb-7">
            <SectionHeader>Saved stays</SectionHeader>
            {saved.slice(0, 6).map((s) => (
              <Pressable
                key={s.id}
                onPress={() =>
                  router.push({
                    pathname: '/screens/stays/[id]',
                    params: {
                      id: s.offerId,
                      checkIn: s.checkIn,
                      checkOut: s.checkOut,
                      guests: String(s.guests),
                      rooms: String(s.rooms),
                    },
                  })
                }
                className="rounded-2xl p-4 mb-2 flex-row items-center"
                style={{ backgroundColor: isDark ? themeColors.secondary : PARCHMENT_DEEP }}>
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: isDark ? '#1f2937' : PARCHMENT_COOL }}>
                  <Icon name="BedDouble" size={18} color={isDark ? PARCHMENT : INK} />
                </View>
                <View className="flex-1">
                  <ThemedText
                    style={{
                      color: isDark ? themeColors.text : INK,
                      fontFamily: SERIF,
                      fontSize: 15,
                    }}
                    numberOfLines={1}>
                    {s.name}
                  </ThemedText>
                  <ThemedText
                    style={{
                      color: isDark ? themeColors.text : INK,
                      opacity: 0.6,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                    numberOfLines={1}>
                    {formatRange(s.checkIn, s.checkOut, { sameMonthCompact: true })} · {s.currency} {s.totalAmount}
                  </ThemedText>
                </View>
                <Icon name="ChevronRight" size={18} color={isDark ? themeColors.text : INK} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View className="items-center mb-8" style={{ opacity: 0.5 }}>
          <ThemedText style={{ fontFamily: SERIF, fontSize: 12, fontStyle: 'italic' }}>
            local-first · prices land in the watchlist when you save
          </ThemedText>
        </View>
      </AnimatedView>
    </ThemeScroller>
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
      }}>
      {children}
    </ThemedText>
  );
}

function ResultsSummary({
  offers,
  cityName,
  nights,
}: {
  offers: StayOffer[];
  cityName: string;
  nights: number;
}) {
  const prices = offers.map((o) => o.pricePerNight);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = offers[0]?.currency ?? 'USD';
  return (
    <View
      className="flex-row items-center rounded-2xl mb-3 px-4 py-3 mt-3"
      style={{ backgroundColor: PARCHMENT_COOL }}>
      <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>
        {offers.length} stay{offers.length === 1 ? '' : 's'} in {cityName}
      </Text>
      <Text style={{ color: INK, opacity: 0.4, fontSize: 13, marginHorizontal: 8 }}>·</Text>
      <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.7, fontSize: 13 }}>
        {currency} {Math.round(min)}–{Math.round(max)}/night
      </Text>
      <View className="ml-auto">
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.6,
            fontSize: 12,
            fontStyle: 'italic',
          }}>
          {nights} night{nights === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );
}

function StayCard({
  offer,
  checkIn,
  checkOut,
  guests,
  rooms,
  isCheapest,
  totalCount,
  isDark,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onLongPress,
}: {
  offer: StayOffer;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  isCheapest: boolean;
  totalCount: number;
  isDark: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onLongPress?: () => void;
}) {
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const AMENITY_LIMIT = 5;
  const visibleAmenities = amenitiesExpanded
    ? offer.amenities
    : offer.amenities.slice(0, AMENITY_LIMIT);
  const overflow = amenitiesExpanded ? 0 : Math.max(0, offer.amenities.length - AMENITY_LIMIT);
  const propertyTypeLabel: Record<string, string> = {
    hotel: 'Hotel',
    apartment: 'Apartment',
    guesthouse: 'Guesthouse',
    resort: 'Resort',
    hostel: 'Hostel',
    bnb: 'B&B',
  };
  return (
    <Pressable
      onPress={() => {
        if (selectMode) {
          onToggleSelect?.();
        } else {
          router.push({
            pathname: '/screens/stays/[id]',
            params: {
              id: offer.id,
              checkIn,
              checkOut,
              guests: String(guests),
              rooms: String(rooms),
            },
          });
        }
      }}
      onLongPress={onLongPress}
      className="rounded-3xl overflow-hidden"
      style={{ backgroundColor: PARCHMENT_DEEP }}>
      {isCheapest ? (
        <View
          className="flex-row items-center px-4 py-1.5"
          style={{ backgroundColor: MOSS }}>
          <Text
            style={{
              fontFamily: SERIF,
              color: PARCHMENT,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
            Best value
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: PARCHMENT,
              opacity: 0.75,
              fontSize: 11,
              marginLeft: 8,
              fontStyle: 'italic',
            }}>
            among {totalCount}
          </Text>
        </View>
      ) : null}

      <View className="p-4 flex-row">
        {/* Thumbnail */}
        {offer.photos?.[0] ? (
          <Image
            source={{ uri: offer.photos[0] }}
            style={{ width: 96, height: 96, borderRadius: 16, marginRight: 14 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 16,
              marginRight: 14,
              backgroundColor: PARCHMENT_COOL,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="BedDouble" size={28} color={INK} />
          </View>
        )}

        {/* Text block */}
        <View style={{ flex: 1 }}>
          <View className="mb-2">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.55,
                fontSize: 11,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
              {propertyTypeLabel[offer.propertyType] ?? offer.propertyType}
              {offer.neighborhood ? ` · ${offer.neighborhood}` : ''}
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 22,
                letterSpacing: -0.3,
                lineHeight: 26,
                marginTop: 2,
              }}
              numberOfLines={1}>
              {offer.name}
            </Text>
          </View>

          <View className="flex-row items-center mb-3">
            <Icon name="Star" size={12} color={BRICK} fill={BRICK} />
            <Text
              style={{ fontFamily: SERIF, color: INK, fontSize: 12, marginLeft: 4 }}>
              {offer.rating.toFixed(1)}
            </Text>
            <Text style={{ color: INK, opacity: 0.45, fontSize: 12, marginLeft: 4 }}>
              · {offer.reviewCount} reviews · {offer.distanceFromCenterKm} km from centre
            </Text>
          </View>

          <View
            style={{
              height: 1,
              marginBottom: 12,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: 'rgba(19,26,42,0.12)',
            }}
          />

          <View className="flex-row items-end justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center flex-wrap">
                {visibleAmenities.map((a) => (
                  <View
                    key={a}
                    className="flex-row items-center mr-3 mb-1"
                    style={{ paddingVertical: 2 }}>
                    <Icon name={AMENITY_ICON[a]} size={11} color={INK} />
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        opacity: 0.7,
                        fontSize: 11,
                        marginLeft: 4,
                      }}>
                      {AMENITY_LABEL[a]}
                    </Text>
                  </View>
                ))}
                {overflow > 0 ? (
                  <Pressable
                    onPress={() => setAmenitiesExpanded(true)}
                    style={{
                      backgroundColor: 'rgba(19,26,42,0.06)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 999,
                      marginBottom: 1,
                    }}>
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        opacity: 0.7,
                        fontSize: 11,
                      }}>
                      +{overflow} more
                    </Text>
                  </Pressable>
                ) : amenitiesExpanded ? (
                  <Pressable
                    onPress={() => setAmenitiesExpanded(false)}
                    style={{
                      backgroundColor: 'rgba(19,26,42,0.06)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 999,
                      marginBottom: 1,
                    }}>
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        opacity: 0.7,
                        fontSize: 11,
                      }}>
                      less
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: offer.cancellation === 'non_refundable' ? BRICK : MOSS,
                  opacity: 0.85,
                  fontSize: 11,
                  fontStyle: 'italic',
                  marginTop: 4,
                }}>
                {offer.cancellation === 'free'
                  ? 'Free cancellation'
                  : offer.cancellation === 'flexible'
                    ? 'Flexible'
                    : 'Non-refundable'}
              </Text>
            </View>
            <View className="items-end">
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  fontSize: 24,
                  letterSpacing: -0.4,
                  lineHeight: 26,
                }}>
                {offer.currency} {Math.round(offer.pricePerNight)}
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 11,
                  marginTop: 2,
                }}>
                /night · {Math.round(offer.totalAmount)} total
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Select-mode checkmark overlay */}
      {selectMode ? (
        <View
          style={{
            position: 'absolute',
            top: isCheapest ? 38 : 10,
            right: 10,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: selected ? MOSS : 'transparent',
            borderWidth: selected ? 0 : 1,
            borderColor: 'rgba(19,26,42,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {selected ? (
            <Icon name="Check" size={14} color={PARCHMENT} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function StaySkeletons() {
  return (
    <View className="mt-3">
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          className="rounded-2xl mb-3 p-4"
          style={{ backgroundColor: PARCHMENT_DEEP, opacity: 1 - i * 0.2 }}>
          <View className="flex-row justify-between mb-3">
            <View
              style={{
                height: 18,
                width: 160,
                backgroundColor: 'rgba(19,26,42,0.08)',
                borderRadius: 4,
              }}
            />
            <View
              style={{
                height: 22,
                width: 80,
                backgroundColor: 'rgba(19,26,42,0.1)',
                borderRadius: 4,
              }}
            />
          </View>
          <View
            style={{
              height: 12,
              width: '60%',
              backgroundColor: 'rgba(19,26,42,0.06)',
              borderRadius: 4,
              marginBottom: 10,
            }}
          />
          <View
            style={{
              height: 12,
              width: '30%',
              backgroundColor: 'rgba(19,26,42,0.06)',
              borderRadius: 4,
            }}
          />
        </View>
      ))}
    </View>
  );
}

function StayEmpty() {
  return (
    <View
      className="mt-4 rounded-3xl p-6 items-center"
      style={{ backgroundColor: PARCHMENT_DEEP }}>
      <Icon name="BedDouble" size={42} color={INK} />
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          fontSize: 18,
          marginTop: 10,
          letterSpacing: -0.2,
        }}>
        No stays for these dates
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
        Try a different city or shift the dates by a few days.
      </Text>
    </View>
  );
}

function StayError({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="mt-4 rounded-3xl p-5" style={{ backgroundColor: '#f6e1d7' }}>
      <Text style={{ fontFamily: SERIF, color: BRICK, fontSize: 22, letterSpacing: -0.2 }}>
        Couldn't reach the stays index.
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
        }}>
        The search is saved — try again, or ask the concierge for suggestions.
      </Text>
      <Pressable
        onPress={onRetry}
        className="px-4 py-2 rounded-full mt-4 self-start"
        style={{ backgroundColor: INK }}>
        <Text style={{ color: PARCHMENT, fontWeight: '600', fontSize: 12 }}>Try again</Text>
      </Pressable>
    </View>
  );
}

function StaySearchModal({
  visible,
  onClose,
  onApply,
  initial,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (next: {
    city: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    rooms: number;
  }) => void;
  initial: { city: string; checkIn: string; checkOut: string; guests: number; rooms: number };
}) {
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState(initial.city);
  const [cityQuery, setCityQuery] = useState(initial.city);
  const [checkIn, setCheckIn] = useState(initial.checkIn || todayPlus(14));
  const [checkOut, setCheckOut] = useState(initial.checkOut || todayPlus(17));
  const [guests, setGuests] = useState(initial.guests);
  const [rooms, setRooms] = useState(initial.rooms);
  const [section, setSection] = useState<'where' | 'when' | 'who'>('where');

  const matches = useMemo(() => {
    if (!cityQuery || cityQuery.length < 2) return [];
    return searchAirports(cityQuery).slice(0, 6);
  }, [cityQuery]);

  const ready = city && checkIn && checkOut && nightsBetween(checkIn, checkOut) > 0;

  const summary = (() => {
    if (!city) return 'Where to?';
    const resolved = findAirport(city.toUpperCase())?.city ?? city;
    if (!checkIn || !checkOut) return resolved;
    return `${resolved} · ${formatRange(checkIn, checkOut, { sameMonthCompact: true })}`;
  })();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PARCHMENT, paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12 }}>
        <View className="px-5 flex-row items-center pb-4">
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
            <Icon name="X" size={18} color={INK} />
          </Pressable>
          <Text
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              color: INK,
              marginLeft: 12,
            }}>
            Plan a stay
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
          <View className="px-5">
            <SectionToggle
              label="Where"
              value={section === 'where' ? '' : findAirport(city.toUpperCase())?.city ?? city ?? 'Anywhere'}
              active={section === 'where'}
              onPress={() => setSection('where')}
            />
            {section === 'where' ? (
              <View
                className="rounded-2xl p-4 mb-3"
                style={{ backgroundColor: PARCHMENT_DEEP }}>
                <TextInput
                  value={cityQuery}
                  onChangeText={setCityQuery}
                  placeholder="Search cities or airports"
                  placeholderTextColor="rgba(19,26,42,0.4)"
                  autoCapitalize="characters"
                  style={{
                    fontFamily: SERIF,
                    fontSize: 18,
                    color: INK,
                    paddingVertical: 8,
                  }}
                />
                {matches.length > 0 ? (
                  <View style={{ marginTop: 8 }}>
                    {matches.map((m) => (
                      <Pressable
                        key={m.iata}
                        onPress={() => {
                          setCity(m.iata);
                          setCityQuery(m.iata);
                          setSection('when');
                          Keyboard.dismiss();
                        }}
                        className="flex-row items-center py-2">
                        <View
                          className="h-8 w-8 items-center justify-center rounded-full mr-3"
                          style={{ backgroundColor: PARCHMENT }}>
                          <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK }}>{m.iata}</Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            style={{
                              fontFamily: SERIF,
                              color: INK,
                              fontSize: 15,
                            }}>
                            {m.city}
                          </Text>
                          <Text
                            style={{
                              fontFamily: SERIF,
                              color: INK,
                              opacity: 0.55,
                              fontSize: 12,
                            }}>
                            {m.name}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <SectionToggle
              label="When"
              value={section === 'when' ? '' : formatRange(checkIn, checkOut, { sameMonthCompact: true })}
              active={section === 'when'}
              onPress={() => setSection('when')}
            />
            {section === 'when' ? (
              <View
                className="rounded-2xl p-3 mb-3"
                style={{ backgroundColor: PARCHMENT_DEEP }}>
                <DateRangeCalendar
                  initialRange={{ startDate: checkIn, endDate: checkOut }}
                  minDate={todayPlus(0)}
                  onDateRangeChange={({ startDate, endDate }) => {
                    setCheckIn(startDate ?? '');
                    setCheckOut(endDate ?? '');
                  }}
                />
              </View>
            ) : null}

            <SectionToggle
              label="Who"
              value={
                section === 'who'
                  ? ''
                  : `${guests} guest${guests === 1 ? '' : 's'} · ${rooms} room${rooms === 1 ? '' : 's'}`
              }
              active={section === 'who'}
              onPress={() => setSection('who')}
            />
            {section === 'who' ? (
              <View
                className="rounded-2xl p-4 mb-3"
                style={{ backgroundColor: PARCHMENT_DEEP }}>
                <View className="flex-row items-center justify-between py-3">
                  <View>
                    <Text style={{ fontFamily: SERIF, color: INK, fontSize: 16 }}>Guests</Text>
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        opacity: 0.55,
                        fontSize: 12,
                      }}>
                      Adults and children
                    </Text>
                  </View>
                  <Counter
                    value={guests}
                    onChange={(n) => setGuests(Math.max(1, n ?? 1))}
                    min={1}
                    max={12}
                  />
                </View>
                <View
                  style={{
                    height: 1,
                    borderTopWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(19,26,42,0.12)',
                    marginVertical: 4,
                  }}
                />
                <View className="flex-row items-center justify-between py-3">
                  <View>
                    <Text style={{ fontFamily: SERIF, color: INK, fontSize: 16 }}>Rooms</Text>
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        opacity: 0.55,
                        fontSize: 12,
                      }}>
                      Bookable as separate keys
                    </Text>
                  </View>
                  <Counter
                    value={rooms}
                    onChange={(n) => setRooms(Math.max(1, n ?? 1))}
                    min={1}
                    max={5}
                  />
                </View>
              </View>
            ) : null}
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
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.6,
              fontSize: 12,
              marginBottom: 6,
              fontStyle: 'italic',
            }}>
            {summary}
          </Text>
          <Pressable
            disabled={!ready}
            onPress={() =>
              onApply({
                city,
                checkIn,
                checkOut,
                guests,
                rooms,
              })
            }
            className="rounded-full items-center justify-center"
            style={{
              backgroundColor: ready ? INK : 'rgba(19,26,42,0.3)',
              height: 50,
            }}>
            <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 16 }}>
              {ready ? 'Show me stays' : 'Pick city + dates'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SectionToggle({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl flex-row items-center mb-3 px-4 py-4"
      style={{
        backgroundColor: active ? PARCHMENT_COOL : PARCHMENT_DEEP,
        borderWidth: active ? 1 : 0,
        borderColor: 'rgba(19,26,42,0.08)',
      }}>
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          fontSize: 14,
          opacity: active ? 1 : 0.55,
          width: 60,
        }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          fontSize: 15,
          marginLeft: 10,
          flex: 1,
        }}
        numberOfLines={1}>
        {value || (active ? 'Tap below to pick' : '')}
      </Text>
      <Icon name="ChevronRight" size={14} color={INK} />
    </Pressable>
  );
}
