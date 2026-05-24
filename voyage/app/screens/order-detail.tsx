import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import ThemedText from '@/components/ThemedText';
import { findAirport } from '@/lib/airports';
import { linkToTrip, shareTrip } from '@/lib/links';
import { INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { getOrder, type StoredOrder } from '@/utils/trackedStorage';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoaded(true);
      setOrder(null);
      return;
    }
    setLoaded(false);
    getOrder(String(id))
      .then((o) => setOrder(o ?? null))
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: PARCHMENT }}>
        <ActivityIndicator color={INK} />
      </View>
    );
  }

  if (!order) {
    return (
      <View className="flex-1 justify-center px-global" style={{ backgroundColor: PARCHMENT }}>
        <View className="rounded-3xl p-5" style={{ backgroundColor: PARCHMENT_DEEP }}>
          <GeoGlyph kind="compass" size={64} color={INK} accent="#c97d4a" />
          <ThemedText
            className="mt-5"
            style={{ fontFamily: SERIF, fontSize: 24, letterSpacing: -0.3 }}>
            Couldn't load this booking
          </ThemedText>
          <ThemedText
            className="mt-2"
            style={{ fontSize: 13, fontStyle: 'italic', lineHeight: 19, opacity: 0.62 }}>
            It may have expired or only exists on another device.
          </ThemedText>
          <Pressable
            onPress={() => router.replace('/(tabs)/trips')}
            className="mt-6 flex-row items-center justify-center rounded-full px-5 py-3.5"
            style={{ backgroundColor: INK }}>
            <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>All trips</Text>
            <Icon name="ArrowRight" size={14} color={PARCHMENT} />
          </Pressable>
        </View>
      </View>
    );
  }

  const first = order.slices[0];
  const last = order.slices[order.slices.length - 1];
  const from = findAirport(first?.origin);
  const to = findAirport(last?.destination);
  const link = linkToTrip(order.id);
  const summary = `${from?.city ?? first?.origin} → ${to?.city ?? last?.destination} · ${order.bookingReference}`;

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 8, backgroundColor: PARCHMENT }}>
      <View className="items-center px-6 pt-4">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: '#1f6b43' }}>
          <Icon name="Check" size={22} color={PARCHMENT} />
        </View>
        <ThemedText
          className="mt-4"
          style={{ fontFamily: SERIF, fontSize: 28, letterSpacing: -0.3 }}>
          You're booked
        </ThemedText>
        <ThemedText
          className="opacity-65 mt-1"
          style={{ fontFamily: SERIF, fontSize: 14, fontStyle: 'italic' }}>
          Confirmation {order.bookingReference}
        </ThemedText>
      </View>

      <View className="mt-6 px-5">
        <View className="overflow-hidden rounded-3xl" style={{ backgroundColor: INK }}>
          <View style={{ padding: 20 }}>
            <View className="flex-row items-end">
              <View className="flex-1">
                <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 10, letterSpacing: 1 }}>
                  FROM
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: PARCHMENT,
                    fontSize: 32,
                    letterSpacing: -0.5,
                  }}>
                  {first?.origin}
                </Text>
                <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 11, marginTop: 2 }}>
                  {from?.city}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingBottom: 8 }}>
                <Icon name="Plane" size={16} color={PARCHMENT} />
              </View>
              <View className="flex-1 items-end">
                <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 10, letterSpacing: 1 }}>
                  TO
                </Text>
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: PARCHMENT,
                    fontSize: 32,
                    letterSpacing: -0.5,
                  }}>
                  {last?.destination}
                </Text>
                <Text style={{ color: PARCHMENT, opacity: 0.55, fontSize: 11, marginTop: 2 }}>
                  {to?.city}
                </Text>
              </View>
            </View>
            <View className="mt-4 flex-row" style={{ alignItems: 'center' }}>
              <Text style={{ color: PARCHMENT, opacity: 0.6, fontSize: 12 }}>
                {order.passengerName}
              </Text>
              <Text
                style={{ marginLeft: 'auto', color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>
                {order.totalCurrency} {Math.round(parseFloat(order.totalAmount))}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => shareTrip(order.id, summary)}
          className="mt-4 flex-row items-center rounded-2xl"
          style={{ backgroundColor: PARCHMENT_DEEP, paddingVertical: 14, paddingHorizontal: 16 }}>
          <Icon name="Share2" size={15} color={INK} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>Share this trip</Text>
            <Text
              style={{ color: INK, opacity: 0.55, fontSize: 11, marginTop: 2 }}
              numberOfLines={1}>
              {link}
            </Text>
          </View>
          <Icon name="ChevronRight" size={14} color={INK} />
        </Pressable>

        <View className="mt-4 flex-row" style={{ gap: 10 }}>
          <Pressable
            onPress={() =>
              router.replace({ pathname: '/screens/trip-detail', params: { id: order.id } })
            }
            className="flex-1 flex-row items-center justify-center rounded-full"
            style={{ backgroundColor: INK, paddingVertical: 14 }}>
            <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15 }}>Open trip</Text>
            <Icon name="ArrowRight" size={14} color={PARCHMENT} />
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(tabs)/trips')}
            className="items-center justify-center rounded-full"
            style={{
              borderWidth: 1,
              borderColor: INK,
              paddingVertical: 14,
              paddingHorizontal: 18,
            }}>
            <Text style={{ color: INK, fontFamily: SERIF, fontSize: 14 }}>All trips</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-6 items-center px-5">
        <GeoGlyph iata={last?.destination} size={90} color={INK} accent="#c97d4a" />
      </View>
    </View>
  );
}
