import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { findAirport } from '@/lib/airports';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { deriveTripStatus, type Trip } from '@/lib/tripTypes';
import { listTrips, saveTrip, tripsByStatus } from '@/utils/tripStorage';

export type TripPickerMode = 'attach-activity' | 'attach-stay';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Called with the chosen trip id, or `null` if the user picked
   * "Save to wishlist". When the user picks "Plan a future <City> trip"
   * the picker creates the Trip itself and calls onSelect with the new id.
   */
  onSelect: (tripId: string | null) => void;
  mode: TripPickerMode;
  /**
   * IATA code (preferred — e.g. "NRT") or city name (e.g. "Tokyo") of
   * the discover city / stay city. Used to filter trips and label the
   * "Plan a future X trip" CTA.
   */
  suggestionCity?: string;
  /**
   * Human-readable name (e.g. "Tokyo"). Optional — if absent the picker
   * resolves it from suggestionCity via findAirport.
   */
  suggestionCityName?: string;
};

function formatDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'Dates TBD';
  const fmt = (iso: string) => {
    if (!iso) return '?';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function tripDays(startDate: string, endDate: string): number {
  const s = Date.parse(startDate);
  const e = Date.parse(endDate);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.round((e - s) / 86_400_000) + 1);
}

function tripCityMatches(trip: Trip, suggestionCity?: string, suggestionCityName?: string): boolean {
  if (!suggestionCity && !suggestionCityName) return false;
  const cityUpper = suggestionCity?.toUpperCase();
  const nameLower = suggestionCityName?.toLowerCase();
  const tripDest = trip.primaryDestination.toUpperCase();
  const tripName = trip.primaryDestinationName.toLowerCase();
  if (cityUpper && tripDest === cityUpper) return true;
  if (nameLower && tripName === nameLower) return true;
  // Tokyo has multiple IATAs (NRT, HND) — match if both resolve to the
  // same city name via airports lookup.
  if (cityUpper) {
    const ap = findAirport(cityUpper);
    if (ap && ap.city.toLowerCase() === tripName) return true;
  }
  return false;
}

function StatusLabel({ status }: { status: Trip['status'] }) {
  const label =
    status === 'active'
      ? 'Active'
      : status === 'booked'
        ? 'Upcoming'
        : 'Planning';
  const color =
    status === 'active'
      ? MOSS
      : status === 'booked'
        ? BRICK
        : 'rgba(19,26,42,0.45)';
  return (
    <Text
      style={{
        fontFamily: SERIF,
        color,
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}>
      {label}
    </Text>
  );
}

function TripRow({
  trip,
  dim,
  onSelect,
}: {
  trip: Trip;
  dim?: boolean;
  onSelect: () => void;
}) {
  const days = tripDays(trip.startDate, trip.endDate);
  return (
    <Pressable
      onPress={onSelect}
      className="flex-row items-center rounded-2xl mb-2 px-4 py-3"
      style={{
        backgroundColor: PARCHMENT_DEEP,
        opacity: dim ? 0.55 : 1,
      }}>
      <View style={{ marginRight: 12 }}>
        <GeoGlyph
          iata={trip.coverGlyphIata ?? trip.primaryDestination}
          size={38}
          color={INK}
          accent={BRICK}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ marginBottom: 2 }}>
          <StatusLabel status={trip.status} />
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 16,
            letterSpacing: -0.2,
          }}>
          {trip.title}
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 11,
            marginTop: 2,
          }}>
          {formatDateRange(trip.startDate, trip.endDate)}
          {days > 0 ? ` · ${days}d` : ''}
          {trip.stayIds.length > 0 ? ` · ${trip.stayIds.length} stay${trip.stayIds.length === 1 ? '' : 's'}` : ''}
          {trip.activityIds.length > 0 ? ` · ${trip.activityIds.length} thing${trip.activityIds.length === 1 ? '' : 's'} to do` : ''}
        </Text>
      </View>
      <Icon name="ChevronRight" size={16} color={INK} />
    </Pressable>
  );
}

function resolveCityLabels(
  suggestionCity?: string,
  suggestionCityName?: string,
): { iata: string | null; cityName: string | null } {
  if (suggestionCityName) {
    // We have a name. Try to find a matching IATA for the glyph.
    const upper = suggestionCity?.toUpperCase() ?? null;
    return { iata: upper, cityName: suggestionCityName };
  }
  if (suggestionCity) {
    const upper = suggestionCity.toUpperCase();
    const ap = findAirport(upper);
    return { iata: upper, cityName: ap?.city ?? upper };
  }
  return { iata: null, cityName: null };
}

export default function TripPickerSheet({
  visible,
  onClose,
  onSelect,
  mode,
  suggestionCity,
  suggestionCityName,
}: Props) {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    if (!visible) return;
    listTrips().then(setTrips);
    setShowOthers(false);
  }, [visible]);

  const { iata: suggestIata, cityName: suggestName } = useMemo(
    () => resolveCityLabels(suggestionCity, suggestionCityName),
    [suggestionCity, suggestionCityName],
  );

  const buckets = tripsByStatus(trips);
  const orderedTrips: Trip[] = [
    ...buckets.active,
    ...buckets.upcoming,
    ...buckets.planning,
  ];
  const matching = orderedTrips.filter((t) => tripCityMatches(t, suggestionCity, suggestionCityName));
  const others = orderedTrips.filter((t) => !tripCityMatches(t, suggestionCity, suggestionCityName));

  const title = mode === 'attach-activity' ? 'Add to a trip' : 'Save to a trip';
  const subtitleBase =
    mode === 'attach-activity'
      ? 'Pick which trip this activity belongs to.'
      : 'Pick which trip this stay belongs to.';
  const subtitle = suggestName ? `${suggestName} ${mode === 'attach-activity' ? 'activity' : 'stay'} · ${subtitleBase}` : subtitleBase;

  const planFutureTrip = async () => {
    if (!suggestName) return;
    const now = Date.now();
    const id = `trip-plan-${(suggestIata ?? suggestName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${now.toString(36)}`;
    const startDate = '';
    const endDate = '';
    await saveTrip({
      id,
      title: `${suggestName} · planning`,
      primaryDestination: (suggestIata ?? suggestName).toUpperCase(),
      primaryDestinationName: suggestName,
      startDate,
      endDate,
      status: deriveTripStatus(startDate, endDate, false),
      orderIds: [],
      stayIds: [],
      activityIds: [],
      itineraryDays: [],
      coverGlyphIata: (suggestIata ?? suggestName.slice(0, 3)).toUpperCase(),
      createdAt: now,
      updatedAt: now,
    });
    onSelect(id);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: PARCHMENT,
          paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12,
        }}>
        <View
          className="px-5 flex-row items-center pb-4"
          style={{
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(19,26,42,0.07)',
          }}>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
            <Icon name="X" size={18} color={INK} />
          </Pressable>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 20, color: INK, letterSpacing: -0.2 }}>
              {title}
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.55,
                fontSize: 12,
                fontStyle: 'italic',
                marginTop: 2,
              }}>
              {subtitle}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled">
          {/* Matching trips first */}
          {matching.length > 0 && suggestName ? (
            <>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.6,
                  fontSize: 11,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                Your {suggestName} trip{matching.length === 1 ? '' : 's'}
              </Text>
              {matching.map((t) => (
                <TripRow key={t.id} trip={t} onSelect={() => onSelect(t.id)} />
              ))}
            </>
          ) : null}

          {/* Plan a future <City> trip — primary CTA when we know the city */}
          {suggestName ? (
            <Pressable
              onPress={planFutureTrip}
              className="rounded-3xl mt-2 mb-3 p-5"
              style={{
                backgroundColor: PARCHMENT_COOL,
                borderLeftWidth: 4,
                borderLeftColor: BRICK,
              }}>
              <View className="flex-row items-start">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: BRICK + '22' }}>
                  <Icon name="CalendarPlus" size={16} color={BRICK} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 18,
                      letterSpacing: -0.2,
                    }}>
                    {matching.length > 0 ? `Start another ${suggestName} trip` : `Plan a future ${suggestName} trip`}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.65,
                      fontSize: 12,
                      marginTop: 4,
                      fontStyle: 'italic',
                      lineHeight: 18,
                    }}>
                    Create a planning trip rooted in {suggestName}. Set dates and add flights later — this saves
                    here.
                  </Text>
                </View>
                <Icon name="ChevronRight" size={16} color={INK} />
              </View>
            </Pressable>
          ) : null}

          {/* Wishlist — always available, secondary visual weight */}
          <Pressable
            onPress={() => onSelect(null)}
            className="rounded-2xl mb-3 px-4 py-3 flex-row items-center"
            style={{
              backgroundColor: PARCHMENT_DEEP,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: 'rgba(19,26,42,0.18)',
            }}>
            <View
              className="w-9 h-9 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
              <Icon name="Bookmark" size={14} color={INK} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15, letterSpacing: -0.1 }}>
                Just save to wishlist
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 11,
                  fontStyle: 'italic',
                  marginTop: 2,
                }}>
                Stays free of any trip — link to one later
              </Text>
            </View>
            <Icon name="ChevronRight" size={16} color={INK} />
          </Pressable>

          {/* Other trips disclosure — collapsed by default; mismatched cities */}
          {others.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Pressable
                onPress={() => setShowOthers((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="flex-row items-center self-start py-2">
                <Icon name={showOthers ? 'ChevronDown' : 'ChevronRight'} size={14} color={INK} />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    fontSize: 12,
                    marginLeft: 6,
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    opacity: 0.6,
                  }}>
                  {suggestName
                    ? `Attach to a non-${suggestName} trip (${others.length})`
                    : `Your trips (${others.length})`}
                </Text>
              </Pressable>
              {showOthers ? (
                <>
                  {suggestName ? (
                    <View
                      className="rounded-2xl p-3 mb-3 flex-row items-start"
                      style={{ backgroundColor: '#f6e1d7' }}>
                      <Icon name="AlertCircle" size={12} color={BRICK} style={{ marginTop: 2 } as any} />
                      <Text
                        style={{
                          fontFamily: SERIF,
                          color: INK,
                          fontSize: 11,
                          marginLeft: 8,
                          flex: 1,
                          lineHeight: 16,
                          fontStyle: 'italic',
                        }}>
                        These trips aren't in {suggestName}. Attaching anyway is fine for general notes — but
                        you'll see this {mode === 'attach-activity' ? 'activity' : 'stay'} listed under a city
                        you aren't visiting.
                      </Text>
                    </View>
                  ) : null}
                  {others.map((t) => (
                    <TripRow key={t.id} trip={t} dim onSelect={() => onSelect(t.id)} />
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          {/* Empty state — no trips at all AND no suggested city */}
          {trips.length === 0 && !suggestName ? (
            <View
              className="rounded-2xl p-5 items-center mt-2"
              style={{ backgroundColor: PARCHMENT_DEEP }}>
              <Icon name="MapPin" size={28} color={INK} />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  fontSize: 15,
                  marginTop: 10,
                  letterSpacing: -0.1,
                }}>
                No trips yet
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 12,
                  marginTop: 4,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  lineHeight: 18,
                }}>
                Save to wishlist now — you can link it to a trip later.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
