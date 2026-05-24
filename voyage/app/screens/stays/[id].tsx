import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import ImageCarousel from '@/components/ImageCarousel';
import BundlePickerSheet from '@/components/BundlePickerSheet';
import TripPickerSheet from '@/components/TripPickerSheet';
import { useThemeColors } from '@/contexts/ThemeColors';
import { findAirport } from '@/lib/airports';
import { formatDay, formatWeekday } from '@/lib/formatDate';
import { getStayById } from '@/lib/stays';
import type { StayAmenity } from '@/lib/stayTypes';
import type { BundleItemRef } from '@/lib/bundleTypes';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { isStaySaved, removeSavedStay, saveStay, stayKey } from '@/utils/staysStorage';
import { linkStayToTrip, listTrips } from '@/utils/tripStorage';

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
  pet_friendly: 'Pets welcome',
  kitchen: 'Kitchen',
  workspace: 'Workspace',
  view: 'View',
  spa: 'Spa',
  beach: 'Beach',
  ac: 'Air conditioning',
};

export default function StayDetail() {
  const params = useLocalSearchParams<{
    id: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    rooms?: string;
    tripId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const [saved, setSaved] = useState(false);
  const [photosFailed, setPhotosFailed] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [bundlePickerVisible, setBundlePickerVisible] = useState(false);
  const [bundleItem, setBundleItem] = useState<BundleItemRef | null>(null);

  const q = useQuery({
    queryKey: ['stay', params.id],
    queryFn: () => getStayById(String(params.id)),
    enabled: !!params.id,
  });

  const checkIn = params.checkIn || '';
  const checkOut = params.checkOut || '';
  const guests = params.guests ? Number(params.guests) : 2;
  const rooms = params.rooms ? Number(params.rooms) : 1;
  const tripIdParam = params.tripId ? String(params.tripId) : undefined;

  const refreshSavedFlag = useCallback(async () => {
    if (!q.data) return;
    const id = stayKey({
      city: q.data.city,
      checkIn,
      checkOut,
      guests,
      rooms,
      offerId: q.data.id,
    });
    setSaved(await isStaySaved(id));
  }, [q.data, checkIn, checkOut, guests, rooms]);

  useEffect(() => {
    refreshSavedFlag();
  }, [refreshSavedFlag]);

  const doSave = async (selectedTripId?: string) => {
    if (!q.data) return;
    await saveStay(q.data, { checkIn, checkOut, guests, rooms, tripId: selectedTripId });
    const id = stayKey({
      city: q.data.city,
      checkIn,
      checkOut,
      guests,
      rooms,
      offerId: q.data.id,
    });
    if (selectedTripId) {
      await linkStayToTrip(selectedTripId, id);
    }
    setSaved(true);
  };

  const onSave = async () => {
    if (!q.data) return;
    if (saved) {
      const id = stayKey({
        city: q.data.city,
        checkIn,
        checkOut,
        guests,
        rooms,
        offerId: q.data.id,
      });
      await removeSavedStay(id);
      setSaved(false);
    } else {
      // Open picker so user can link to a trip
      setPickerVisible(true);
    }
  };

  const onPickerSelect = async (selectedTripId: string | null) => {
    setPickerVisible(false);
    await doSave(selectedTripId ?? undefined);
  };

  const onAddToBundle = async () => {
    if (!q.data) return;
    const record = await saveStay(q.data, { checkIn, checkOut, guests, rooms });
    setSaved(true);
    setBundleItem({ kind: 'stay', savedStayId: record.id });
    setBundlePickerVisible(true);
  };

  const onReserve = async () => {
    const stayData = q.data;
    const baseParams: Record<string, string> = {
      kind: 'stay',
      stayId: stayData?.id ?? '',
      checkIn,
      checkOut,
      guests: String(guests),
      rooms: String(rooms),
    };
    if (tripIdParam) {
      router.push({ pathname: '/screens/checkout', params: { ...baseParams, tripId: tripIdParam } });
      return;
    }
    // Compute best-match trip from saved trips
    const allTrips = await listTrips();
    const city = stayData?.city?.toUpperCase() ?? '';
    const best = allTrips.find(
      (t) =>
        t.status !== 'past' &&
        (t.primaryDestination.toUpperCase() === city ||
          t.primaryDestinationName.toUpperCase() === city),
    );
    router.push({
      pathname: '/screens/checkout',
      params: best ? { ...baseParams, tripId: best.id } : baseParams,
    });
  };

  if (q.isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
        <TopBar isDark={isDark} />
        <View className="px-5 mt-6">
          <View
            style={{
              height: 28,
              width: 220,
              backgroundColor: 'rgba(19,26,42,0.08)',
              borderRadius: 4,
            }}
          />
          <View
            style={{
              marginTop: 14,
              height: 180,
              backgroundColor: PARCHMENT_DEEP,
              borderRadius: 28,
            }}
          />
          <View
            style={{
              marginTop: 14,
              height: 140,
              backgroundColor: PARCHMENT_DEEP,
              borderRadius: 28,
              opacity: 0.7,
            }}
          />
        </View>
      </View>
    );
  }

  if (q.error || !q.data) {
    return (
      <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
        <TopBar isDark={isDark} />
        <View className="flex-1 items-center justify-center p-8">
          <Icon name="BedDouble" size={42} color={INK} />
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 18,
              marginTop: 12,
            }}>
            Couldn't load this stay
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.6,
              marginTop: 4,
              fontSize: 13,
              fontStyle: 'italic',
            }}>
            The link may have expired — try a fresh search.
          </Text>
        </View>
      </View>
    );
  }

  const stay = q.data;
  const cityRecord = findAirport(stay.city.toUpperCase());
  const cityName = cityRecord?.city ?? stay.cityName;

  return (
    <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
      <TopBar isDark={isDark} />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="px-5 pt-3">
          {stay.photos && stay.photos.length > 0 && !photosFailed ? (
            /* Photo carousel hero with gradient overlay */
            <View
              className="rounded-3xl overflow-hidden mb-4"
              style={{ height: 260 }}>
              <ImageCarousel
                images={stay.photos}
                height={260}
                rounded="2xl"
                showPagination
                autoPlay={false}
                onAllFailed={() => setPhotosFailed(true)}
              />
              <LinearGradient
                colors={['transparent', 'rgba(19,26,42,0.65)']}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: 20,
                  paddingTop: 60,
                  borderBottomLeftRadius: 24,
                  borderBottomRightRadius: 24,
                }}>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: PARCHMENT,
                    fontSize: 13,
                    opacity: 0.85,
                    textTransform: 'capitalize',
                  }}>
                  {stay.propertyType} · {cityName}
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: PARCHMENT,
                    fontSize: 28,
                    marginTop: 4,
                    lineHeight: 32,
                  }}>
                  {stay.name}
                </Text>
                <View className="flex-row items-center mt-2">
                  <Icon name="Star" size={13} color={BRICK} />
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: PARCHMENT,
                      fontSize: 13,
                      marginLeft: 4,
                    }}>
                    {stay.rating.toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: PARCHMENT,
                      opacity: 0.7,
                      fontSize: 12,
                      marginLeft: 8,
                    }}>
                    {stay.reviewCount} reviews · {stay.distanceFromCenterKm} km from centre
                  </Text>
                </View>
                <View className="flex-row items-center mt-3">
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: PARCHMENT,
                      opacity: 0.7,
                      fontSize: 11,
                      marginRight: 6,
                    }}>
                    From
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: PARCHMENT,
                      fontSize: 20,
                    }}>
                    {stay.currency} {Math.round(stay.pricePerNight)} / night
                  </Text>
                </View>
              </LinearGradient>
            </View>
          ) : (
            /* Fallback: original dark hero with GeoGlyph */
            <View
              className="rounded-3xl overflow-hidden mb-4 p-6"
              style={{
                backgroundColor: PARCHMENT_COOL,
                borderLeftWidth: 4,
                borderLeftColor: BRICK,
                minHeight: 200,
                justifyContent: 'space-between',
              }}>
              <View>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 13,
                    opacity: 0.6,
                    textTransform: 'capitalize',
                  }}>
                  {stay.propertyType} · {cityName}
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 30,
                    marginTop: 6,
                    lineHeight: 34,
                  }}>
                  {stay.name}
                </Text>
                <View className="flex-row items-center mt-3">
                  <Icon name="Star" size={14} color={BRICK} />
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 13,
                      marginLeft: 4,
                    }}>
                    {stay.rating.toFixed(1)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 12,
                      marginLeft: 8,
                    }}>
                    {stay.reviewCount} reviews · {stay.distanceFromCenterKm} km from centre
                  </Text>
                </View>
              </View>
              <View className="flex-row items-end justify-between">
                <View>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 11,
                    }}>
                    From
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 24,
                    }}>
                    {stay.currency} {Math.round(stay.pricePerNight)} / night
                  </Text>
                </View>
                <View style={{ opacity: 0.85 }}>
                  <GeoGlyph iata={stay.city} size={72} color={INK} accent={BRICK} />
                </View>
              </View>
            </View>
          )}

          <Section title="The stay">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 15,
                lineHeight: 22,
                opacity: 0.85,
              }}>
              {stay.description}
            </Text>
            {stay.hostName ? (
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 12,
                  marginTop: 8,
                  fontStyle: 'italic',
                }}>
                Hosted by {stay.hostName}
              </Text>
            ) : null}
          </Section>

          <Section title="What's included">
            <View className="flex-row flex-wrap" style={{ marginTop: -4 }}>
              {stay.amenities.map((a) => (
                <View
                  key={a}
                  className="flex-row items-center mr-2 mb-2 px-3 py-2 rounded-full"
                  style={{ backgroundColor: PARCHMENT }}>
                  <Icon name={AMENITY_ICON[a]} size={12} color={INK} />
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 12,
                      marginLeft: 6,
                    }}>
                    {AMENITY_LABEL[a]}
                  </Text>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Your stay">
            <View
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: PARCHMENT_COOL }}>
              <View className="flex-row" style={{ padding: 16 }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 11,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                    Check-in
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 24,
                      letterSpacing: -0.3,
                      marginTop: 4,
                    }}>
                    {formatDay(checkIn)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 12,
                      marginTop: 2,
                    }}>
                    {formatWeekday(checkIn)} · from 3pm
                  </Text>
                </View>
                <View
                  style={{
                    width: 1,
                    borderLeftWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(19,26,42,0.2)',
                  }}
                />
                <View style={{ flex: 1, paddingLeft: 12 }}>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 11,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}>
                    Check-out
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 24,
                      letterSpacing: -0.3,
                      marginTop: 4,
                    }}>
                    {formatDay(checkOut)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 12,
                      marginTop: 2,
                    }}>
                    {formatWeekday(checkOut)} · by 11am
                  </Text>
                </View>
              </View>
              <View
                style={{
                  height: 1,
                  borderTopWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: 'rgba(19,26,42,0.18)',
                  marginHorizontal: 16,
                }}
              />
              <View className="flex-row items-center" style={{ padding: 16 }}>
                <Icon name="Users" size={14} color={INK} />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 13,
                    marginLeft: 8,
                  }}>
                  {guests} guest{guests === 1 ? '' : 's'}
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    opacity: 0.35,
                    fontSize: 13,
                    marginHorizontal: 8,
                  }}>
                  ·
                </Text>
                <Icon name="DoorOpen" size={14} color={INK} />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 13,
                    marginLeft: 8,
                  }}>
                  {rooms} room{rooms === 1 ? '' : 's'}
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    opacity: 0.35,
                    fontSize: 13,
                    marginHorizontal: 8,
                  }}>
                  ·
                </Text>
                <Icon name="Moon" size={14} color={INK} />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 13,
                    marginLeft: 8,
                  }}>
                  {stay.nights} night{stay.nights === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            {(() => {
              const subtotal = Math.round(stay.pricePerNight * stay.nights);
              const total = Math.round(stay.totalAmount);
              const collapsed = subtotal === total;
              const nightLabel = `${stay.nights} night${stay.nights === 1 ? '' : 's'}`;
              if (collapsed) {
                return (
                  <View
                    className="rounded-2xl px-4 py-3 mt-2"
                    style={{ backgroundColor: PARCHMENT_DEEP }}>
                    <View
                      className="flex-row items-center justify-between"
                      style={{ paddingVertical: 4 }}>
                      <Text
                        style={{
                          fontFamily: SERIF,
                          color: INK,
                          opacity: 0.55,
                          fontSize: 12,
                          fontStyle: 'italic',
                        }}>
                        Total · {stay.currency} {Math.round(stay.pricePerNight)}/night × {nightLabel}
                      </Text>
                      <Text
                        style={{
                          fontFamily: SERIF,
                          color: INK,
                          fontSize: 18,
                          letterSpacing: -0.3,
                        }}>
                        {stay.currency} {total}
                      </Text>
                    </View>
                  </View>
                );
              }
              return (
                <View
                  className="rounded-2xl px-4 py-3 mt-2"
                  style={{ backgroundColor: PARCHMENT_DEEP }}>
                  <View className="flex-row items-center justify-between" style={{ paddingVertical: 4 }}>
                    <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.6, fontSize: 13 }}>
                      {stay.currency} {Math.round(stay.pricePerNight)} × {nightLabel}
                    </Text>
                    <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>
                      {stay.currency} {subtotal}
                    </Text>
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
                  <View className="flex-row items-center justify-between" style={{ paddingVertical: 4 }}>
                    <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>Total</Text>
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        fontSize: 18,
                        letterSpacing: -0.3,
                      }}>
                      {stay.currency} {total}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </Section>

          <Section title="Cancellation">
            <View
              className="rounded-2xl px-4 py-4 flex-row items-start"
              style={{
                backgroundColor:
                  stay.cancellation === 'non_refundable' ? '#f6e1d7' : '#e6f2eb',
              }}>
              <Icon
                name={stay.cancellation === 'non_refundable' ? 'Lock' : 'ShieldCheck'}
                size={16}
                color={stay.cancellation === 'non_refundable' ? BRICK : MOSS}
              />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  fontSize: 13,
                  marginLeft: 10,
                  flex: 1,
                  lineHeight: 20,
                }}>
                {stay.cancellation === 'free'
                  ? 'Free cancellation until 24 hours before check-in. The host gets a heads-up if plans change.'
                  : stay.cancellation === 'flexible'
                    ? 'Flexible — full refund if cancelled at least 5 days ahead.'
                    : 'Non-refundable. Confirm only when you are sure.'}
              </Text>
            </View>
          </Section>

          <View className="items-center my-4" style={{ opacity: 0.5 }}>
            <Text style={{ fontFamily: SERIF, color: INK, fontSize: 11, fontStyle: 'italic' }}>
              local-first · prices reflect what I have right now
            </Text>
          </View>
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
        <View className="flex-row items-end justify-between mb-2">
          <View>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 22,
                letterSpacing: -0.3,
              }}>
              {stay.currency} {Math.round(stay.totalAmount)}
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.55,
                fontSize: 11,
              }}>
              total for {stay.nights} night{stay.nights === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable
            onPress={onAddToBundle}
            hitSlop={6}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(201,125,74,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}>
            <Icon name="Heart" size={16} color={BRICK} />
          </Pressable>
          <Pressable
            onPress={onSave}
            className="flex-row items-center px-3 py-2 rounded-full"
            style={{
              backgroundColor: saved ? MOSS : 'rgba(19,26,42,0.08)',
            }}>
            <Icon name={saved ? 'Check' : 'Bookmark'} size={14} color={saved ? PARCHMENT : INK} />
            <Text
              style={{
                fontFamily: SERIF,
                color: saved ? PARCHMENT : INK,
                fontSize: 12,
                marginLeft: 6,
              }}>
              {saved ? 'Saved' : 'Save for later'}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={onReserve}
          className="rounded-full items-center justify-center"
          style={{ backgroundColor: INK, height: 50 }}>
          <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 16 }}>
            Reserve →
          </Text>
        </Pressable>
      </View>

      <TripPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={onPickerSelect}
        mode="attach-stay"
        suggestionCity={stay.city}
        suggestionCityName={cityName}
      />
      <BundlePickerSheet
        visible={bundlePickerVisible}
        onClose={() => setBundlePickerVisible(false)}
        item={bundleItem}
        suggestionCoverPhoto={stay.photos?.[0]}
        suggestionName={stay.cityName ?? cityName}
      />
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
          The stay
        </Text>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text
        style={{
          fontFamily: SERIF,
          color: INK,
          fontSize: 18,
          marginBottom: 8,
          letterSpacing: -0.2,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

