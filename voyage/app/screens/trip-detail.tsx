import { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable, Text, Linking, ScrollView } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import ThemedText from '@/components/ThemedText';
import Icon from '@/components/Icon';
import GeoGlyph from '@/components/GeoGlyph';
import TripMap, { pinsFromTrip } from '@/components/TripMap';
import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import { findAirport } from '@/lib/airports';
import { getOrder, getTracked, type StoredOrder } from '@/utils/trackedStorage';
import type { TrackedRoute } from '@/lib/flightTypes';
import type { Trip } from '@/lib/tripTypes';
import { tripIdForOrder } from '@/lib/tripTypes';
import { getTripById, ensureItineraryDays } from '@/utils/tripStorage';
import { listSavedStays } from '@/utils/staysStorage';
import { listSavedActivities, type SavedActivity } from '@/utils/discoverStorage';
import type { SavedStay } from '@/lib/stayTypes';
import { checkInUrl, flightStatusUrl, shareTrip, linkToTrip } from '@/lib/links';
import { saveToDeviceCalendar, openAllInGoogleCalendar, type CalendarEvent } from '@/lib/calendarActions';
import { activityDistanceFromStay, formatDistance } from '@/lib/distanceUtils';

const INK = '#131a2a';
const PARCHMENT = '#f1ece4';
const PARCHMENT_DEEP = '#e9e3d7';
const SERIF = 'YoungSerif_400Regular';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [tracked, setTracked] = useState<TrackedRoute | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [linkedStays, setLinkedStays] = useState<SavedStay[]>([]);
  const [linkedActivities, setLinkedActivities] = useState<SavedActivity[]>([]);
  const [sheetActivity, setSheetActivity] = useState<SavedActivity | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const o = await getOrder(String(id));
    setOrder(o ?? null);
    if (o?.trackedId) {
      const t = await getTracked(o.trackedId);
      setTracked(t ?? null);
    }
    if (o) {
      const tripId = tripIdForOrder(o.id);
      const t = (await getTripById(tripId)) ?? null;
      const ensured = t && t.itineraryDays.length === 0 ? await ensureItineraryDays(tripId) : t;
      setTrip(ensured ?? t);
      const [stays, acts] = await Promise.all([listSavedStays(), listSavedActivities()]);
      setLinkedStays(stays.filter((s) => (ensured ?? t)?.stayIds.includes(s.id)));
      setLinkedActivities(acts.filter((a) => (ensured ?? t)?.activityIds.includes(a.id)));
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!order) {
    return (
      <View className="flex-1 items-center justify-center bg-light-primary dark:bg-dark-primary">
        <ActivityIndicator color={INK} />
      </View>
    );
  }

  const first = order.slices[0];
  const last = order.slices[order.slices.length - 1];
  const from = findAirport(first?.origin);
  const to = findAirport(first?.destination);
  const dep = first ? new Date(first.departing_at) : null;
  const days = dep ? daysUntil(dep) : null;
  // Prefer the Trip umbrella's resolved destination name when available;
  // for round-trips the last slice's "destination" is the origin city so
  // fall back to the first slice's destination instead.
  const headlineCity = trip?.primaryDestinationName || to?.city || first?.destination || '';

  const calendarEvents: CalendarEvent[] = order.slices.map((s) => ({
    title: `Flight: ${s.origin} → ${s.destination} (${s.carrierName} ${s.flightNumber})`,
    start: s.departing_at,
    end: s.arriving_at,
    location: `${findAirport(s.origin)?.name ?? s.origin} → ${findAirport(s.destination)?.name ?? s.destination}`,
    notes: `Booking ${order.bookingReference} · ${order.passengerName}`,
  }));

  const summary = `${from?.city ?? first?.origin} → ${to?.city ?? last?.destination} · ${
    dep ? formatShortDate(dep) : ''
  } · ${order.bookingReference}`;

  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary">
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          paddingBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/trips'))}
          className="w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}
        >
          <Icon name="ChevronLeft" size={18} color={INK} />
        </Pressable>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => shareTrip(order.id, summary)}
            className="w-10 h-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}
          >
            <Icon name="Share2" size={16} color={INK} />
          </Pressable>
        </View>
      </View>

      <ActivityDetailSheet
        activity={sheetActivity}
        visible={!!sheetActivity}
        onClose={() => setSheetActivity(null)}
        tripContext={trip ? { tripId: trip.id, stay: linkedStays[0] ?? null } : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ThemedText style={{ fontFamily: SERIF, fontSize: 14, opacity: 0.55 }}>
          Trip to
        </ThemedText>
        <ThemedText
          className="mt-1"
          style={{ fontFamily: SERIF, fontSize: 32, letterSpacing: -0.4 }}
        >
          {headlineCity}
        </ThemedText>
        <ThemedText
          className="opacity-65 mt-1"
          style={{ fontFamily: SERIF, fontSize: 14, fontStyle: 'italic' }}
        >
          {dep ? formatLongDate(dep) : 'Date pending'}
          {days !== null && days > 0 ? ` · ${days} day${days === 1 ? '' : 's'} away` : ''}
          {days !== null && days <= 0 ? ' · today' : ''}
        </ThemedText>

        {tracked ? <TrackedBadge tracked={tracked} /> : null}

        <BoardingPass order={order} />

        <SectionLabel>Flights</SectionLabel>
        {order.slices.map((s, i) => (
          <SegmentCard key={i} slice={s} bookingReference={order.bookingReference} />
        ))}

        <SectionLabel>Trip map</SectionLabel>
        <TripMap
          {...pinsFromTrip({ order, stays: linkedStays, activities: linkedActivities })}
          height={220}
          caption={
            linkedActivities.length > 0
              ? `${linkedActivities.length} ${linkedActivities.length === 1 ? 'activity' : 'activities'} · ${linkedStays.length} ${linkedStays.length === 1 ? 'stay' : 'stays'} pinned`
              : 'Flight origin and destination · add stays and activities to enrich'
          }
        />

        {linkedStays.length > 0 ? (
          <>
            <SectionLabel>Where you'll stay</SectionLabel>
            {linkedStays.map((s) => (
              <StayRow key={s.id} stay={s} />
            ))}
          </>
        ) : null}

        {linkedActivities.length > 0 ? (
          <>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/screens/discover/[city]',
                  params: {
                    city: trip?.primaryDestinationName ?? '',
                    tripId: trip?.id ?? '',
                  },
                })
              }
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 10 }}
            >
              <ThemedText style={{ fontFamily: SERIF, fontSize: 16, opacity: 0.85, flex: 1 }}>
                Things to do
              </ThemedText>
              <View
                className="px-2 py-0.5 rounded-full mr-2"
                style={{ backgroundColor: 'rgba(19,26,42,0.08)' }}
              >
                <Text style={{ fontFamily: SERIF, color: INK, fontSize: 11 }}>
                  {linkedActivities.length}
                </Text>
              </View>
              <Icon name="ChevronRight" size={14} color={INK} />
            </Pressable>
            {linkedActivities.slice(0, 4).map((a) => (
              <ActivityRow key={a.id} activity={a} stay={linkedStays[0]} onPress={() => setSheetActivity(a)} />
            ))}
            {linkedActivities.length > 4 ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/screens/discover/[city]',
                    params: { city: trip?.primaryDestinationName ?? '' },
                  })
                }
                className="self-start mt-1 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
                <Text style={{ fontFamily: SERIF, color: INK, fontSize: 12 }}>
                  +{linkedActivities.length - 4} more — open Discover
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {trip ? (
          <>
            <SectionLabel>Itinerary</SectionLabel>
            <Pressable
              onPress={() => router.push({ pathname: '/screens/itinerary/[tripId]', params: { tripId: trip.id } })}
              className="rounded-2xl"
              style={{ backgroundColor: PARCHMENT_DEEP, padding: 16 }}>
              {trip.itineraryDays.slice(0, 3).map((d, idx) => (
                <View
                  key={d.date}
                  className="flex-row items-start"
                  style={{
                    paddingVertical: 8,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderColor: 'rgba(19,26,42,0.08)',
                  }}>
                  <View
                    className="w-9 h-9 items-center justify-center rounded-full mr-3"
                    style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
                    <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13 }}>
                      {new Date(d.date).getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>
                      {new Date(d.date).toLocaleDateString(undefined, { weekday: 'long' })}
                    </Text>
                    {d.theme ? (
                      <Text
                        style={{
                          fontFamily: SERIF,
                          color: INK,
                          opacity: 0.55,
                          fontSize: 12,
                          marginTop: 1,
                          fontStyle: 'italic',
                        }}>
                        {d.theme} · {d.slots.length} {d.slots.length === 1 ? 'item' : 'items'}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              {trip.itineraryDays.length > 3 ? (
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    opacity: 0.55,
                    fontSize: 12,
                    marginTop: 8,
                    fontStyle: 'italic',
                  }}>
                  +{trip.itineraryDays.length - 3} more day{trip.itineraryDays.length - 3 === 1 ? '' : 's'}
                </Text>
              ) : null}
              <View className="flex-row items-center mt-3">
                <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13 }}>Open itinerary editor</Text>
                <Icon name="ChevronRight" size={14} color={INK} />
              </View>
            </Pressable>
          </>
        ) : null}

        <SectionLabel>Actions</SectionLabel>
        <View style={{ gap: 8 }}>
          <ActionRow
            icon="Calendar"
            label="Add all flights to calendar"
            sub="Apple Calendar (local device)"
            onPress={() => saveToDeviceCalendar(calendarEvents)}
          />
          <ActionRow
            icon="ExternalLink"
            label="Add to Google Calendar"
            sub="Opens google.com/calendar"
            onPress={() => openAllInGoogleCalendar(calendarEvents)}
          />
          {first?.carrierCode ? (
            <ActionRow
              icon="UserCheck"
              label={`Check in with ${first.carrierName}`}
              sub={`${order.bookingReference} · opens ${first.carrierCode.toUpperCase()} site`}
              onPress={() => Linking.openURL(checkInUrl(first.carrierCode!, order.bookingReference))}
            />
          ) : null}
          <ActionRow
            icon="Share2"
            label="Share this trip"
            sub={linkToTrip(order.id)}
            onPress={() => shareTrip(order.id, summary)}
          />
        </View>

        <SectionLabel>Ledger</SectionLabel>
        <View
          className="rounded-2xl"
          style={{ backgroundColor: PARCHMENT_DEEP, padding: 16 }}
        >
          <Row label="Passenger" value={order.passengerName || '—'} />
          <Row label="Booking reference" value={order.bookingReference} mono />
          <Row label="Booked on" value={new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} />
          <Row
            label="Total"
            value={`${order.totalCurrency} ${Math.round(parseFloat(order.totalAmount))}`}
            strong
          />
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText
      style={{ fontFamily: SERIF, fontSize: 16, marginTop: 22, marginBottom: 10, opacity: 0.85 }}
    >
      {children}
    </ThemedText>
  );
}

function BoardingPass({ order }: { order: StoredOrder }) {
  const first = order.slices[0];
  // For round-trips the last slice's destination is the origin city. Use
  // the first outbound slice for both endpoints so the boarding pass
  // matches the trip's actual destination.
  const destinationSlice = first;
  const from = findAirport(first?.origin);
  const to = findAirport(destinationSlice?.destination);
  const dep = first ? new Date(first.departing_at) : null;

  return (
    <View
      className="rounded-3xl mt-5 overflow-hidden"
      style={{ backgroundColor: INK }}
    >
      <View style={{ padding: 22 }}>
        <View className="flex-row items-center">
          <Text style={{ fontFamily: SERIF, fontSize: 12, color: PARCHMENT, opacity: 0.65 }}>
            Boarding pass
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
              {destinationSlice?.destination}
            </Text>
            <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 11, marginTop: 2 }}>
              {to?.city}
            </Text>
          </View>
        </View>

        <View className="flex-row mt-5" style={{ gap: 16 }}>
          <BPDatum label="DEPART" value={dep ? formatTime(dep) : '—'} />
          <BPDatum label="DATE" value={dep ? formatShortDate(dep) : '—'} />
          <BPDatum label="FLIGHT" value={formatFlightLabel(first?.carrierCode, first?.flightNumber)} />
          <View style={{ marginLeft: 'auto' }}>
            <GeoGlyph iata={destinationSlice?.destination} size={54} color={PARCHMENT} accent="#d49565" />
          </View>
        </View>
      </View>

      <View
        className="flex-row"
        style={{
          borderTopWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'rgba(241,236,228,0.25)',
          paddingVertical: 14,
          paddingHorizontal: 22,
        }}
      >
        <Text style={{ color: PARCHMENT, opacity: 0.6, fontSize: 11 }}>Passenger</Text>
        <Text style={{ marginLeft: 'auto', color: PARCHMENT, fontSize: 12, fontWeight: '600' }}>
          {order.passengerName}
        </Text>
      </View>
    </View>
  );
}

function BPDatum({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ color: PARCHMENT, opacity: 0.5, fontSize: 10, letterSpacing: 1 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 16, marginTop: 2 }}>
        {value || '—'}
      </Text>
    </View>
  );
}

function SegmentCard({
  slice,
  bookingReference,
}: {
  slice: StoredOrder['slices'][number];
  bookingReference: string;
}) {
  const dep = new Date(slice.departing_at);
  const arr = new Date(slice.arriving_at);
  const from = findAirport(slice.origin);
  const to = findAirport(slice.destination);

  return (
    <View className="rounded-2xl mb-2" style={{ backgroundColor: PARCHMENT_DEEP, padding: 16 }}>
      <View className="flex-row items-center">
        <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15 }}>
          {slice.carrierName} {slice.flightNumber}
        </Text>
        <Pressable
          onPress={() =>
            slice.carrierCode
              ? Linking.openURL(flightStatusUrl(slice.carrierCode, slice.flightNumber))
              : undefined
          }
          style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ color: INK, opacity: 0.55, fontSize: 11, marginRight: 4 }}>Status</Text>
          <Icon name="ExternalLink" size={12} color={INK} />
        </Pressable>
      </View>

      <View className="flex-row items-end mt-3">
        <View>
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.3 }}>
            {slice.origin}
          </Text>
          <Text style={{ color: INK, opacity: 0.6, fontSize: 11, marginTop: 2 }}>
            {from?.city ?? ''}
          </Text>
          <Text style={{ color: INK, opacity: 0.75, fontSize: 12, marginTop: 4 }}>
            {formatTime(dep)} · {formatShortDate(dep)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: 'rgba(19,26,42,0.18)',
            marginHorizontal: 12,
            marginBottom: 16,
          }}
        />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.3 }}>
            {slice.destination}
          </Text>
          <Text style={{ color: INK, opacity: 0.6, fontSize: 11, marginTop: 2 }}>
            {to?.city ?? ''}
          </Text>
          <Text style={{ color: INK, opacity: 0.75, fontSize: 12, marginTop: 4 }}>
            {formatTime(arr)} · {formatShortDate(arr)}
          </Text>
        </View>
      </View>

      {slice.carrierCode ? (
        <Pressable
          onPress={() => Linking.openURL(checkInUrl(slice.carrierCode!, bookingReference))}
          className="mt-3 rounded-xl py-2.5 flex-row items-center justify-center"
          style={{ borderWidth: 1, borderColor: 'rgba(19,26,42,0.2)' }}
        >
          <Icon name="UserCheck" size={13} color={INK} />
          <Text style={{ color: INK, fontFamily: SERIF, fontSize: 13, marginLeft: 6 }}>
            Check in with {slice.carrierName}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl flex-row items-center"
      style={{
        backgroundColor: PARCHMENT_DEEP,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <View
        className="w-9 h-9 items-center justify-center rounded-full mr-3"
        style={{ backgroundColor: INK }}
      >
        <Icon name={icon as any} size={14} color={PARCHMENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15 }}>{label}</Text>
        {sub ? (
          <Text style={{ color: INK, opacity: 0.55, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Icon name="ChevronRight" size={16} color={INK} />
    </Pressable>
  );
}

function StayRow({ stay }: { stay: SavedStay }) {
  const nights = (() => {
    const a = Date.parse(stay.checkIn);
    const b = Date.parse(stay.checkOut);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.max(0, Math.round((b - a) / 86_400_000));
  })();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/screens/stays/[id]',
          params: {
            id: stay.offerId,
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            guests: String(stay.guests),
            rooms: String(stay.rooms),
          },
        })
      }
      className="rounded-2xl mb-2"
      style={{ backgroundColor: PARCHMENT_DEEP, padding: 16 }}>
      <View className="flex-row items-start">
        <Image
          source={{ uri: stay.coverPhoto ?? `https://picsum.photos/seed/${stay.offerId}/120/120` }}
          contentFit="cover"
          style={{ width: 56, height: 56, borderRadius: 14, marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15 }}>{stay.name}</Text>
          <Text
            style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 12, marginTop: 2 }}>
            {stay.neighborhood ? `${stay.neighborhood} · ` : ''}
            {stay.checkIn} → {stay.checkOut} · {nights} night{nights === 1 ? '' : 's'}
          </Text>
        </View>
        <View className="items-end">
          {stay.status === 'booked' ? (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#1f6b43' }}>
              <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 10 }}>Booked</Text>
            </View>
          ) : (
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(201,125,74,0.14)' }}>
              <Text style={{ fontFamily: SERIF, color: '#c97d4a', fontSize: 10 }}>Saved</Text>
            </View>
          )}
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14, marginTop: 4 }}>
            {stay.currency} {Math.round(stay.totalAmount)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ActivityRow({ activity, stay, onPress }: { activity: SavedActivity; stay?: SavedStay; onPress?: () => void }) {
  const dist = stay ? activityDistanceFromStay(activity, stay) : null;
  const distLabel = dist ? formatDistance(dist) : null;
  const isCarDistance = dist ? dist.km > 5 : false;
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl mb-2"
      style={{ backgroundColor: PARCHMENT_DEEP, padding: 14 }}>
      <View className="flex-row items-start">
        {(activity as any).photo ? (
          <Image
            source={{ uri: (activity as any).photo }}
            contentFit="cover"
            style={{ width: 56, height: 56, borderRadius: 14, marginRight: 12 }}
          />
        ) : (
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: 'rgba(201,125,74,0.16)' }}>
            <Icon name="MapPin" size={14} color="#c97d4a" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 11,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>
            {activity.kind} · {activity.when}
          </Text>
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15, marginTop: 1 }}>
            {activity.title}
          </Text>
          <Text
            style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 12, marginTop: 2 }}>
            {activity.area} · {activity.city}
          </Text>
          {distLabel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Icon name={isCarDistance ? 'Car' : 'Footprints'} size={11} color={INK} />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.5,
                  fontSize: 11,
                  fontStyle: 'italic',
                  marginLeft: 4,
                }}>
                {distLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Icon name="ChevronRight" size={14} color={INK} style={{ opacity: 0.4 }} />
      </View>
    </Pressable>
  );
}

function TrackedBadge({ tracked }: { tracked: TrackedRoute }) {
  const lowest = tracked.lowestPrice ?? tracked.lastPrice;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/screens/trends/[id]', params: { id: tracked.id } })}
      className="rounded-2xl mt-4 flex-row items-center"
      style={{
        backgroundColor: 'rgba(31,107,67,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(31,107,67,0.25)',
        padding: 12,
      }}
    >
      <View
        className="w-8 h-8 items-center justify-center rounded-full mr-3"
        style={{ backgroundColor: '#1f6b43' }}
      >
        <Icon name="Bell" size={14} color={PARCHMENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13 }}>
          You were watching this route
        </Text>
        <Text style={{ color: INK, opacity: 0.65, fontSize: 11, marginTop: 1 }}>
          Lowest seen: {tracked.currency} {Math.round(lowest)}
          {tracked.lastPrice < lowest + 1 ? ' · booked at best' : ''}
        </Text>
      </View>
      <Icon name="ChevronRight" size={14} color={INK} />
    </Pressable>
  );
}

function Row({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center" style={{ paddingVertical: 6 }}>
      <Text style={{ color: INK, opacity: 0.6, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          marginLeft: 'auto',
          color: INK,
          fontFamily: mono ? 'Courier' : SERIF,
          fontSize: strong ? 16 : 14,
          fontWeight: strong ? '700' : '400',
        }}
      >
        {value}
      </Text>
    </View>
  );
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

/**
 * Builds a flight label like "AT288" without duplicating the carrier prefix.
 * Some providers already embed the carrier code in the flight number (e.g. "AT288"),
 * while others keep them separate (carrierCode="AT", flightNumber="288").
 * Concatenating both blindly produces "ATAT288"; this helper dedupes the prefix.
 */
function formatFlightLabel(code?: string, number?: string): string {
  if (!number) return code ?? '';
  if (!code) return number;
  return number.toUpperCase().startsWith(code.toUpperCase()) ? number : `${code}${number}`;
}
