import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import type { StayAmenity, StayOffer } from '@/lib/stayTypes';

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

const ALL_AMENITIES: StayAmenity[] = [
  'wifi', 'pool', 'gym', 'breakfast', 'parking',
  'pet_friendly', 'kitchen', 'workspace', 'view', 'spa', 'beach', 'ac',
];

type Props = {
  visible: boolean;
  onClose: () => void;
  stays: StayOffer[];
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
};

const LABEL_COL = 90;

function RowLabel({ children }: { children: string }) {
  return (
    <View style={{ width: LABEL_COL, paddingRight: 6 }}>
      <Text
        numberOfLines={2}
        style={{
          fontFamily: SERIF,
          fontSize: 11,
          color: INK,
          opacity: 0.55,
          lineHeight: 15,
        }}>
        {children}
      </Text>
    </View>
  );
}

function MatrixRow({
  label,
  children,
  bg,
}: {
  label: string;
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: bg ?? 'transparent',
        minHeight: 36,
      }}>
      <RowLabel>{label}</RowLabel>
      {children}
    </View>
  );
}

export default function StayCompareSheet({
  visible,
  onClose,
  stays,
  checkIn,
  checkOut,
  guests,
  rooms,
}: Props) {
  const insets = useSafeAreaInsets();

  if (!stays || stays.length < 2) return null;

  const cheapest = stays.reduce(
    (best, s) => (s.pricePerNight < best.pricePerNight ? s : best),
    stays[0],
  );

  function cancellationLabel(c: string) {
    if (c === 'free') return 'Free cancel';
    if (c === 'flexible') return 'Flexible';
    return 'Non-refund.';
  }

  function cancellationColor(c: string) {
    if (c === 'non_refundable') return BRICK;
    return MOSS;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PARCHMENT }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 16,
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderColor: 'rgba(19,26,42,0.08)',
          }}>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(19,26,42,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="X" size={18} color={INK} />
          </Pressable>
          <Text
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              color: INK,
              marginLeft: 12,
              letterSpacing: -0.3,
            }}>
            Compare
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              fontSize: 13,
              color: INK,
              opacity: 0.5,
              marginLeft: 8,
              fontStyle: 'italic',
            }}>
            {stays.length} stays
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}>

          {/* Photo strip + name header */}
          <View
            style={{
              flexDirection: 'row',
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderColor: 'rgba(19,26,42,0.08)',
            }}>
            {/* Label spacer */}
            <View style={{ width: LABEL_COL }} />
            {stays.map((stay) => (
              <View key={stay.id} style={{ flex: 1, paddingHorizontal: 4 }}>
                {stay.photos?.[0] ? (
                  <Image
                    source={{ uri: stay.photos[0] }}
                    style={{ width: '100%', height: 64, borderRadius: 10, marginBottom: 6 }}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: '100%',
                      height: 64,
                      borderRadius: 10,
                      marginBottom: 6,
                      backgroundColor: PARCHMENT_COOL,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="BedDouble" size={22} color={INK} />
                  </View>
                )}
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: SERIF,
                    fontSize: 12,
                    color: INK,
                    lineHeight: 15,
                  }}>
                  {stay.name}
                </Text>
                {stay.neighborhood ? (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: SERIF,
                      fontSize: 10,
                      color: INK,
                      opacity: 0.5,
                      marginTop: 2,
                    }}>
                    {stay.neighborhood}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {/* Matrix rows */}
          {/* Price / night */}
          <MatrixRow label="Price/night" bg={PARCHMENT_COOL}>
            {stays.map((stay) => (
              <View key={stay.id} style={{ flex: 1, paddingHorizontal: 4, alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontFamily: SERIF,
                    fontSize: 14,
                    color: stay.id === cheapest.id ? MOSS : INK,
                    fontWeight: stay.id === cheapest.id ? '700' : '400',
                  }}>
                  {stay.currency} {Math.round(stay.pricePerNight)}
                </Text>
              </View>
            ))}
          </MatrixRow>

          {/* Total */}
          <MatrixRow label="Total">
            {stays.map((stay) => (
              <View key={stay.id} style={{ flex: 1, paddingHorizontal: 4, alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: SERIF, fontSize: 13, color: INK }}>
                  {stay.currency} {Math.round(stay.totalAmount)}
                </Text>
              </View>
            ))}
          </MatrixRow>

          {/* Rating */}
          <MatrixRow label="Rating" bg={PARCHMENT_COOL}>
            {stays.map((stay) => (
              <View
                key={stay.id}
                style={{ flex: 1, paddingHorizontal: 4, alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: SERIF, fontSize: 13, color: INK }}>
                  {stay.rating.toFixed(1)}
                </Text>
                <Text style={{ fontFamily: SERIF, fontSize: 10, color: INK, opacity: 0.5 }}>
                  {stay.reviewCount} rev.
                </Text>
              </View>
            ))}
          </MatrixRow>

          {/* Distance */}
          <MatrixRow label="Distance">
            {stays.map((stay) => (
              <View key={stay.id} style={{ flex: 1, paddingHorizontal: 4, alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: SERIF, fontSize: 13, color: INK }}>
                  {stay.distanceFromCenterKm} km
                </Text>
              </View>
            ))}
          </MatrixRow>

          {/* Cancellation */}
          <MatrixRow label="Cancel" bg={PARCHMENT_COOL}>
            {stays.map((stay) => (
              <View key={stay.id} style={{ flex: 1, paddingHorizontal: 4, alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontFamily: SERIF,
                    fontSize: 11,
                    color: cancellationColor(stay.cancellation),
                    fontStyle: 'italic',
                  }}>
                  {cancellationLabel(stay.cancellation)}
                </Text>
              </View>
            ))}
          </MatrixRow>

          {/* Section divider */}
          <View
            style={{
              marginHorizontal: 16,
              marginVertical: 8,
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: 'rgba(19,26,42,0.12)',
            }}
          />

          {/* Amenities header */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.4, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Amenities
            </Text>
          </View>

          {/* One row per amenity */}
          {ALL_AMENITIES.map((amenity, idx) => (
            <MatrixRow key={amenity} label={AMENITY_LABEL[amenity]} bg={idx % 2 === 0 ? PARCHMENT_COOL : undefined}>
              {stays.map((stay) => {
                const has = stay.amenities.includes(amenity);
                return (
                  <View
                    key={stay.id}
                    style={{ flex: 1, paddingHorizontal: 4, alignItems: 'center' }}>
                    {has ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: MOSS,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Icon name="Check" size={10} color={PARCHMENT} />
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1.5,
                          borderColor: 'rgba(19,26,42,0.18)',
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </MatrixRow>
          ))}
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 12,
            paddingTop: 12,
            backgroundColor: PARCHMENT,
            borderTopWidth: 1,
            borderColor: 'rgba(19,26,42,0.08)',
          }}>
          <Pressable
            onPress={() => {
              onClose();
              router.push({
                pathname: '/screens/stays/[id]',
                params: {
                  id: cheapest.id,
                  checkIn,
                  checkOut,
                  guests: String(guests),
                  rooms: String(rooms),
                },
              });
            }}
            style={{
              backgroundColor: MOSS,
              borderRadius: 999,
              height: 50,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 16 }}>
              Reserve {cheapest.name}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
