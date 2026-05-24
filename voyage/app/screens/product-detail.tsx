import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, router } from 'expo-router';
import { View, ScrollView, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { findAirport } from '@/lib/airports';
import { api } from '@/lib/apiBase';
import type { FlightOffer, FlightSlice } from '@/lib/flightTypes';
import { INK, PARCHMENT, PARCHMENT_DEEP, PARCHMENT_COOL, SERIF, BRICK } from '@/lib/theme';

async function fetchOffer(id: string): Promise<FlightOffer> {
  const res = await fetch(api('/api/flights/offer'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Could not load offer');
  const data = (await res.json()) as { offer: FlightOffer };
  return data.offer;
}

export default function OfferDetail() {
  const { id, trackedId } = useLocalSearchParams<{ id: string; trackedId?: string }>();
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: ['offer', id],
    queryFn: () => fetchOffer(String(id)),
    enabled: !!id,
  });

  if (q.isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
        <TopBar />
        <View className="mt-6 px-global">
          <View
            style={{
              height: 28,
              width: 180,
              backgroundColor: 'rgba(19,26,42,0.08)',
              borderRadius: 4,
            }}
          />
          <View
            style={{
              marginTop: 18,
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
        <TopBar />
        <View className="flex-1 items-center justify-center p-8">
          <GeoGlyph kind="compass" size={64} color={INK} accent={BRICK} />
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 18,
              marginTop: 12,
              letterSpacing: -0.2,
            }}>
            Couldn't load this offer
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
            {(q.error as Error)?.message ?? 'It may have expired.'}
          </Text>
        </View>
      </View>
    );
  }

  const offer = q.data;
  const first = offer.slices[0];
  const firstDestGlyph = first?.destination;
  const from = findAirport(first?.origin ?? '');
  const to = findAirport(first?.destination ?? '');
  const totalStops = offer.slices.reduce((acc, s) => acc + Math.max(0, s.segments.length - 1), 0);

  return (
    <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
      <TopBar airlineCode={offer.owner.iata_code} airlineName={offer.owner.name} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        <View className="mt-2">
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 13 }}>
            {offer.slices.length > 1 ? 'Round trip' : 'One way'} · {offer.owner.name}
          </Text>
          <Text
            className="mt-1"
            style={{ fontFamily: SERIF, color: INK, fontSize: 30, letterSpacing: -0.4 }}>
            {from?.city ?? first?.origin} <Text style={{ color: INK, opacity: 0.35 }}>→</Text>{' '}
            {to?.city ?? first?.destination}
          </Text>
          <Text
            className="mt-1"
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.65,
              fontSize: 13,
              fontStyle: 'italic',
            }}>
            {totalStops === 0
              ? 'Flying direct the whole way'
              : `${totalStops} stop${totalStops > 1 ? 's' : ''} in total`}
          </Text>
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl" style={{ backgroundColor: INK }}>
          <View className="flex-row items-center px-5 pb-3 pt-5">
            <View className="flex-1">
              <Text
                style={{
                  fontFamily: SERIF,
                  color: PARCHMENT,
                  opacity: 0.6,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>
                Fare summary
              </Text>
              <Text
                className="mt-1"
                style={{
                  fontFamily: SERIF,
                  color: PARCHMENT,
                  fontSize: 34,
                  letterSpacing: -0.5,
                }}>
                {offer.totalCurrency} {Math.round(parseFloat(offer.totalAmount))}
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: PARCHMENT,
                  opacity: 0.65,
                  fontSize: 12,
                  marginTop: 3,
                  fontStyle: 'italic',
                }}>
                Total for all passengers · test-mode payment
              </Text>
            </View>
            <GeoGlyph iata={firstDestGlyph} size={72} color={PARCHMENT} accent={BRICK} />
          </View>

          <View
            className="mx-5 mb-5 flex-row rounded-2xl"
            style={{
              backgroundColor: 'rgba(241,236,228,0.07)',
              borderColor: 'rgba(241,236,228,0.15)',
              borderWidth: 1,
            }}>
            <FareCell label="Slices" value={String(offer.slices.length)} />
            <Sep />
            <FareCell label="Stops" value={String(totalStops)} />
            <Sep />
            <FareCell label="Airline" value={offer.owner.iata_code ?? '—'} />
          </View>
        </View>

        {offer.slices.map((slice, si) => (
          <SliceCard key={si} slice={slice} index={si} total={offer.slices.length} />
        ))}

        <View
          className="mt-4 flex-row items-center rounded-3xl p-4"
          style={{ backgroundColor: PARCHMENT_COOL }}>
          <View
            className="mr-3 h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.08)' }}>
            <Icon name="Info" size={15} color={INK} />
          </View>
          <Text
            className="flex-1"
            style={{ fontFamily: SERIF, color: INK, fontSize: 13, lineHeight: 19 }}>
            Fare rules, baggage and seats are shown on the Duffel receipt once you reserve.
          </Text>
        </View>
      </ScrollView>

      <View
        className="flex-row items-center px-5 pt-4"
        style={{
          paddingBottom: insets.bottom + 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(19,26,42,0.08)',
          backgroundColor: PARCHMENT,
        }}>
        <View className="flex-1">
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.3 }}>
            {offer.totalCurrency} {Math.round(parseFloat(offer.totalAmount))}
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 12,
              fontStyle: 'italic',
            }}>
            {offer.expires_at ? 'hold while you book' : 'test-mode checkout'}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/screens/checkout',
              params: trackedId
                ? { offerId: offer.id, trackedId: String(trackedId) }
                : { offerId: offer.id },
            })
          }
          className="flex-row items-center rounded-full px-6 py-3.5"
          style={{ backgroundColor: INK }}>
          <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 15 }}>Reserve</Text>
          <Icon name="ArrowRight" size={15} color={PARCHMENT} />
        </Pressable>
      </View>
    </View>
  );
}

function TopBar({ airlineCode, airlineName }: { airlineCode?: string; airlineName?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center px-4 pb-2"
      style={{ paddingTop: insets.top + 6, backgroundColor: PARCHMENT }}>
      <Pressable
        onPress={() => router.back()}
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: PARCHMENT_DEEP }}>
        <Icon name="ArrowLeft" size={16} color={INK} />
      </Pressable>
      <View className="flex-1 items-center">
        {airlineCode ? (
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.65,
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
            {airlineCode} · {airlineName}
          </Text>
        ) : (
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13, opacity: 0.55 }}>Offer</Text>
        )}
      </View>
      <View className="h-10 w-10" />
    </View>
  );
}

function FareCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center py-3">
      <Text
        style={{
          fontFamily: SERIF,
          color: PARCHMENT,
          fontSize: 18,
          letterSpacing: -0.2,
        }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          color: PARCHMENT,
          opacity: 0.55,
          fontSize: 10,
          marginTop: 2,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </View>
  );
}

function Sep() {
  return <View style={{ width: 1, backgroundColor: 'rgba(241,236,228,0.12)' }} />;
}

function SliceCard({ slice, index, total }: { slice: FlightSlice; index: number; total: number }) {
  const label =
    total > 1
      ? index === 0
        ? 'Outbound'
        : index === 1
          ? 'Return'
          : `Leg ${index + 1}`
      : 'The flight';
  const from = findAirport(slice.origin);
  const to = findAirport(slice.destination);
  const dur = parseDurationMin(slice.duration);
  const stops = Math.max(0, slice.segments.length - 1);
  return (
    <View className="mt-4">
      <View className="mb-2 flex-row items-baseline">
        <Text style={{ fontFamily: SERIF, color: INK, fontSize: 18, letterSpacing: -0.2 }}>
          {label}
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 12,
            marginLeft: 8,
            fontStyle: 'italic',
          }}>
          {from?.city ?? slice.origin} → {to?.city ?? slice.destination}
          {dur ? ` · ${formatMin(dur)}` : ''}
          {stops > 0 ? ` · ${stops} stop${stops > 1 ? 's' : ''}` : ''}
        </Text>
      </View>

      {slice.segments.map((seg, i) => {
        const nextSeg = slice.segments[i + 1];
        const layover = nextSeg
          ? Math.max(
              0,
              Math.round(
                (new Date(nextSeg.departing_at).getTime() - new Date(seg.arriving_at).getTime()) /
                  60000
              )
            )
          : 0;
        return (
          <View key={i}>
            <View className="rounded-2xl p-4" style={{ backgroundColor: PARCHMENT_DEEP }}>
              <View className="mb-3 flex-row items-center">
                <View
                  className="mr-3 h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: PARCHMENT }}>
                  <Icon name="Plane" size={13} color={INK} />
                </View>
                <View className="flex-1">
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      fontSize: 14,
                      letterSpacing: -0.1,
                    }}
                    numberOfLines={1}>
                    {seg.marketingCarrierName} {seg.flightNumber}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 11,
                      marginTop: 1,
                    }}>
                    {formatMin(parseDurationMin(seg.duration))}
                  </Text>
                </View>
              </View>

              <View className="flex-row">
                <View className="flex-1">
                  <Text
                    style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.4 }}>
                    {seg.origin}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                    numberOfLines={1}>
                    {seg.originName ?? ''}
                  </Text>
                  <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13, marginTop: 6 }}>
                    {formatDateTime(seg.departing_at)}
                  </Text>
                </View>
                <View className="items-center justify-center px-2">
                  <View
                    style={{
                      height: 1,
                      width: 32,
                      backgroundColor: 'rgba(19,26,42,0.2)',
                    }}
                  />
                </View>
                <View className="flex-1 items-end">
                  <Text
                    style={{ fontFamily: SERIF, color: INK, fontSize: 22, letterSpacing: -0.4 }}>
                    {seg.destination}
                  </Text>
                  <Text
                    style={{
                      fontFamily: SERIF,
                      color: INK,
                      opacity: 0.55,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                    numberOfLines={1}>
                    {seg.destinationName ?? ''}
                  </Text>
                  <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13, marginTop: 6 }}>
                    {formatDateTime(seg.arriving_at)}
                  </Text>
                </View>
              </View>
            </View>

            {layover > 0 ? (
              <View className="flex-row items-center py-2 pl-4">
                <View
                  style={{
                    width: 1,
                    height: 14,
                    backgroundColor: 'rgba(19,26,42,0.25)',
                    marginRight: 10,
                  }}
                />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    opacity: 0.6,
                    fontSize: 12,
                    fontStyle: 'italic',
                  }}>
                  Layover in {seg.destination} · {formatMin(layover)}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function parseDurationMin(iso?: string) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return parseInt(m[1] ?? '0', 10) * 60 + parseInt(m[2] ?? '0', 10);
}

function formatMin(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
