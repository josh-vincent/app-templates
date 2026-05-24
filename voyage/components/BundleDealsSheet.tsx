import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { findAirport } from '@/lib/airports';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import type { Deal, DealLine, DealStrategy } from '@/lib/bundleTypes';
import { evaluateBundle } from '@/utils/bundleStorage';

type Props = {
  bundleId: string;
  visible: boolean;
  onClose: () => void;
};

const STRATEGIES: { key: DealStrategy; label: string; tagline: string; tint: string }[] = [
  { key: 'cheapest', label: 'Cheapest', tagline: 'Lowest total cost', tint: MOSS },
  { key: 'best_rated', label: 'Highest rated', tagline: 'Top guest scores', tint: BRICK },
  { key: 'most_reviewed', label: 'Most reviewed', tagline: 'Most-loved', tint: INK },
  { key: 'balanced', label: 'Balanced', tagline: 'Price meets quality', tint: '#8a6b3f' },
];

export default function BundleDealsSheet({ bundleId, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [strategy, setStrategy] = useState<DealStrategy>('cheapest');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!bundleId) return;
    setLoading(true);
    const { deals: d } = await evaluateBundle(bundleId);
    setDeals(d);
    setLoading(false);
  }, [bundleId]);

  useEffect(() => {
    if (visible) {
      setStrategy('cheapest');
      load();
    }
  }, [visible, load]);

  const active = deals.find((d) => d.strategy === strategy);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PARCHMENT, paddingTop: insets.top }}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="X" size={16} color={INK} />
          </Pressable>
          <View style={{ marginLeft: 14 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.2 }}>
              DEAL FINDER
            </Text>
            <Text style={{ fontFamily: SERIF, fontSize: 22, color: INK, marginTop: 2 }}>
              Best of your bundle
            </Text>
          </View>
        </View>

        {/* strategy chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
          {STRATEGIES.map((s) => {
            const isActive = s.key === strategy;
            return (
              <Pressable
                key={s.key}
                onPress={() => setStrategy(s.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: isActive ? INK : PARCHMENT_DEEP,
                  borderWidth: isActive ? 0 : 1,
                  borderColor: isActive ? undefined : 'rgba(19,26,42,0.18)',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: s.tint,
                    marginRight: 7,
                  }}
                />
                <Text style={{ fontFamily: SERIF, fontSize: 13, color: isActive ? PARCHMENT : INK }}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 80, paddingTop: 8 }}>
          {loading ? (
            <Text style={{ fontFamily: SERIF, fontSize: 13, color: INK, opacity: 0.6, fontStyle: 'italic', marginTop: 20 }}>
              Weighing your options…
            </Text>
          ) : null}

          {!loading && active ? (
            <DealCard deal={active} />
          ) : null}

          {!loading && !active ? (
            <View style={{ alignItems: 'center', paddingVertical: 36, backgroundColor: PARCHMENT_DEEP, borderRadius: 22 }}>
              <GeoGlyph kind="skyline-generic" size={64} color={INK} accent={BRICK} />
              <Text style={{ fontFamily: SERIF, fontSize: 18, color: INK, marginTop: 10 }}>
                Nothing to compare yet
              </Text>
              <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: 6, paddingHorizontal: 36 }}>
                Add at least one stay or activity to this bundle and I&apos;ll rank combinations for you.
              </Text>
            </View>
          ) : null}

          {/* secondary tiles — quick glance at the other strategies */}
          {!loading && deals.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.2, marginBottom: 8 }}>
                ALSO WORTH A LOOK
              </Text>
              {deals
                .filter((d) => d.strategy !== strategy)
                .map((d) => {
                  const meta = STRATEGIES.find((s) => s.key === d.strategy)!;
                  return (
                    <Pressable
                      key={d.strategy}
                      onPress={() => setStrategy(d.strategy)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        backgroundColor: PARCHMENT_DEEP,
                        borderRadius: 18,
                        marginBottom: 8,
                      }}>
                      <View
                        style={{
                          width: 8,
                          height: 38,
                          borderRadius: 4,
                          backgroundColor: meta.tint,
                          marginRight: 12,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
                          {meta.label.toUpperCase()}
                        </Text>
                        <Text style={{ fontFamily: SERIF, fontSize: 14, color: INK, marginTop: 2 }} numberOfLines={1}>
                          {d.caption}
                        </Text>
                      </View>
                      <Icon name="ChevronRight" size={14} color={INK} />
                    </Pressable>
                  );
                })}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const meta = STRATEGIES.find((s) => s.key === deal.strategy)!;
  const stayLine = deal.lines.find((l) => l.kind === 'stay');
  const flightLine = deal.lines.find((l) => l.kind === 'flight');
  const activityLines = deal.lines.filter((l) => l.kind === 'activity') as Extract<DealLine, { kind: 'activity' }>[];

  return (
    <View style={{ backgroundColor: INK, borderRadius: 24, padding: 20, marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: meta.tint, marginRight: 8 }} />
        <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: 0.6, letterSpacing: 1.2 }}>
          {meta.label.toUpperCase()} · {meta.tagline}
        </Text>
      </View>

      <Text style={{ fontFamily: SERIF, fontSize: 38, color: PARCHMENT, marginTop: 8 }}>
        ${deal.totalUSD.toLocaleString()}
      </Text>
      <Text style={{ fontFamily: SERIF, fontSize: 13, color: PARCHMENT, opacity: 0.7, fontStyle: 'italic', marginTop: 2 }}>
        {deal.caption}
      </Text>

      {/* stat strip */}
      <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(241,236,228,0.18)' }}>
        <StatCell label="AVG RATING" value={deal.averageRating > 0 ? deal.averageRating.toFixed(1) : '—'} />
        <StatCell label="REVIEWS" value={deal.totalReviews > 0 ? deal.totalReviews.toLocaleString() : '—'} />
        <StatCell label="ITEMS" value={String(deal.lines.length)} />
      </View>

      {/* picked items */}
      <View style={{ marginTop: 16, gap: 10 }}>
        {flightLine ? <FlightLineRow line={flightLine as Extract<DealLine, { kind: 'flight' }>} /> : null}
        {stayLine ? <StayLineRow line={stayLine as Extract<DealLine, { kind: 'stay' }>} /> : null}
        {activityLines.map((a) => (
          <ActivityLineRow key={a.savedActivityId} line={a} />
        ))}
      </View>

      {/* CTA: reserve cheapest stay if there is one */}
      {stayLine ? (
        <Pressable
          onPress={() => {
            const s = stayLine as Extract<DealLine, { kind: 'stay' }>;
            // The stay id may already include checkIn/checkOut in its key. Just route by id; the detail
            // screen resolves the rest.
            router.push({ pathname: '/screens/stays/[id]', params: { id: s.savedStayId.split('|').pop() ?? s.savedStayId } });
          }}
          style={{ marginTop: 18, backgroundColor: MOSS, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="ArrowRight" size={16} color={PARCHMENT} />
          <Text style={{ fontFamily: SERIF, fontSize: 15, color: PARCHMENT, marginLeft: 10 }}>
            Reserve the picked stay
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: SERIF, fontSize: 9, color: PARCHMENT, opacity: 0.55, letterSpacing: 1.2 }}>{label}</Text>
      <Text style={{ fontFamily: SERIF, fontSize: 18, color: PARCHMENT, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function StayLineRow({ line }: { line: Extract<DealLine, { kind: 'stay' }> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(241,236,228,0.08)', borderRadius: 14, padding: 10 }}>
      {line.coverPhoto ? (
        <Image source={{ uri: line.coverPhoto }} contentFit="cover" style={{ width: 48, height: 48, borderRadius: 12 }} />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(241,236,228,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="BedDouble" size={18} color={PARCHMENT} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: 0.55, letterSpacing: 1.1 }}>
          STAY · {line.cityName.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 15, color: PARCHMENT, marginTop: 2 }} numberOfLines={1}>
          {line.name}
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 12, color: PARCHMENT, opacity: 0.65, fontStyle: 'italic', marginTop: 2 }}>
          {line.nights} night{line.nights > 1 ? 's' : ''} · {line.currency} {Math.round(line.pricePerNight)} / night · {line.rating.toFixed(1)}★
        </Text>
      </View>
      <Text style={{ fontFamily: SERIF, fontSize: 15, color: PARCHMENT, marginLeft: 8 }}>
        ${Math.round(line.totalAmount).toLocaleString()}
      </Text>
    </View>
  );
}

function ActivityLineRow({ line }: { line: Extract<DealLine, { kind: 'activity' }> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(241,236,228,0.08)', borderRadius: 14, padding: 10 }}>
      {line.photo ? (
        <Image source={{ uri: line.photo }} contentFit="cover" style={{ width: 48, height: 48, borderRadius: 12 }} />
      ) : (
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(241,236,228,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="MapPin" size={18} color={PARCHMENT} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: 0.55, letterSpacing: 1.1 }}>
          THING TO DO · {line.area.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 14, color: PARCHMENT, marginTop: 2 }} numberOfLines={2}>
          {line.title}
        </Text>
      </View>
      <Text style={{ fontFamily: SERIF, fontSize: 13, color: PARCHMENT, opacity: 0.7, marginLeft: 8 }}>
        {'$'.repeat(line.priceLevel)}
      </Text>
    </View>
  );
}

function FlightLineRow({ line }: { line: Extract<DealLine, { kind: 'flight' }> }) {
  const from = findAirport(line.origin);
  const to = findAirport(line.destination);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(241,236,228,0.08)', borderRadius: 14, padding: 10 }}>
      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(241,236,228,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="Plane" size={18} color={PARCHMENT} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: 0.55, letterSpacing: 1.1 }}>
          FLIGHT · TRACKED
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 15, color: PARCHMENT, marginTop: 2 }} numberOfLines={1}>
          {from?.city ?? line.origin} → {to?.city ?? line.destination}
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 12, color: PARCHMENT, opacity: 0.65, fontStyle: 'italic', marginTop: 2 }}>
          Lowest seen {line.currency} {line.lowestPrice}
        </Text>
      </View>
      <Text style={{ fontFamily: SERIF, fontSize: 15, color: PARCHMENT, marginLeft: 8 }}>
        {line.currency} {line.lastPrice}
      </Text>
    </View>
  );
}
