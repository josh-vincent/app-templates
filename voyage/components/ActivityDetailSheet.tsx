import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BundlePickerSheet from '@/components/BundlePickerSheet';
import Icon from '@/components/Icon';
import ImageCarousel from '@/components/ImageCarousel';
import TripMap, { type MapPin } from '@/components/TripMap';
import TripPickerSheet from '@/components/TripPickerSheet';
import type { BundleItemRef } from '@/lib/bundleTypes';
import { KIND_META, type Activity } from '@/lib/discover';
import { activityDistanceFromStay, formatDistance } from '@/lib/distanceUtils';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { photosForActivity } from '@/lib/photoProvider';
import type { SavedStay } from '@/lib/stayTypes';
import { saveActivity } from '@/utils/discoverStorage';
import { linkActivityToTrip } from '@/utils/tripStorage';

type Props = {
  activity: Activity | null;
  visible: boolean;
  onClose: () => void;
  tripContext?: { tripId: string; stay?: SavedStay | null };
  onSaved?: (activityId: string) => void;
};

export default function ActivityDetailSheet({
  activity,
  visible,
  onClose,
  tripContext,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bundlePickerVisible, setBundlePickerVisible] = useState(false);
  const [bundleItem, setBundleItem] = useState<BundleItemRef | null>(null);
  const [photosFailed, setPhotosFailed] = useState(false);

  const handleAddToBundle = async () => {
    if (!activity) return;
    const record = await saveActivity(activity);
    setBundleItem({ kind: 'activity', savedActivityId: record.id });
    setBundlePickerVisible(true);
  };

  if (!activity) return null;

  const meta = KIND_META[activity.kind];
  const photos = photosForActivity(activity, 3);

  const distance =
    tripContext?.stay ? activityDistanceFromStay(activity, tripContext.stay) : null;
  const distLabel = distance ? formatDistance(distance) : null;

  const mapPins: MapPin[] =
    activity.lat != null && activity.lng != null
      ? [
          {
            id: activity.id,
            lat: activity.lat,
            lng: activity.lng,
            kind: 'activity',
            label: activity.title,
            sublabel: activity.area,
          },
        ]
      : [];

  const mapsUrl =
    activity.lat != null && activity.lng != null
      ? `https://maps.apple.com/?ll=${activity.lat},${activity.lng}&q=${encodeURIComponent(activity.title)}`
      : `https://maps.apple.com/?q=${encodeURIComponent(activity.title)}`;

  const handleAddToTrip = async () => {
    if (!activity) return;
    if (tripContext?.tripId) {
      await saveActivity(activity, { tripId: tripContext.tripId });
      await linkActivityToTrip(tripContext.tripId, activity.id);
      setSaved(true);
      onSaved?.(activity.id);
      onClose();
    } else {
      setPickerVisible(true);
    }
  };

  const handlePickerSelect = async (selectedTripId: string | null) => {
    setPickerVisible(false);
    if (!activity) return;
    await saveActivity(activity, { tripId: selectedTripId ?? undefined });
    if (selectedTripId) {
      await linkActivityToTrip(selectedTripId, activity.id);
    }
    setSaved(true);
    onSaved?.(activity.id);
    onClose();
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
          paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
        }}>
        {/* Image Carousel */}
        <View style={{ position: 'relative' }}>
          {!photosFailed ? (
            <ImageCarousel
              images={photos}
              height={240}
              rounded="none"
              showPagination
              onAllFailed={() => setPhotosFailed(true)}
            />
          ) : (
            <View
              style={{
                height: 240,
                backgroundColor: PARCHMENT_DEEP,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="MapPin" size={36} color={INK} />
              <Text
                style={{
                  fontFamily: SERIF,
                  fontSize: 12,
                  color: INK,
                  opacity: 0.5,
                  marginTop: 8,
                  fontStyle: 'italic',
                }}>
                Imagery loading…
              </Text>
            </View>
          )}
          {/* Close button overlaid on photo */}
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              position: 'absolute',
              top: 14,
              right: 16,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="X" size={16} color={PARCHMENT} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}>
          {/* Eyebrow row: kind · when on left, price level on right */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 18,
              paddingBottom: 6,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: meta.accent + '22',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}>
                <Icon name={meta.icon as any} size={12} color={meta.accent} />
              </View>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.6,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}>
                {meta.label} · {activity.when}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Text
                  key={i}
                  style={{
                    fontFamily: SERIF,
                    color:
                      i < activity.priceLevel ? INK : 'rgba(19,26,42,0.2)',
                    fontSize: 13,
                    marginLeft: 1,
                  }}>
                  $
                </Text>
              ))}
            </View>
          </View>

          {/* Title */}
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 22,
              lineHeight: 28,
              letterSpacing: -0.3,
              paddingHorizontal: 20,
              marginBottom: 4,
            }}>
            {activity.title}
          </Text>

          {/* Area + distance row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 6,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="MapPin" size={11} color={INK} style={{ opacity: 0.5 } as any} />
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 12,
                  marginLeft: 4,
                }}>
                {activity.area}
              </Text>
            </View>
            {distLabel ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="Navigation" size={10} color={INK} style={{ opacity: 0.45 } as any} />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: INK,
                    opacity: 0.5,
                    fontSize: 11,
                    marginLeft: 4,
                    fontStyle: 'italic',
                  }}>
                  {distLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Blurb */}
          {activity.blurb ? (
            <View
              style={{
                marginHorizontal: 20,
                marginBottom: 20,
                padding: 16,
                backgroundColor: PARCHMENT_COOL,
                borderRadius: 16,
                borderLeftWidth: 3,
                borderLeftColor: meta.accent,
              }}>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.8,
                  fontSize: 14,
                  lineHeight: 22,
                  fontStyle: 'italic',
                }}>
                {activity.blurb}
              </Text>
            </View>
          ) : null}

          {/* Mini map */}
          {mapPins.length > 0 ? (
            <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
              <TripMap pins={mapPins} height={160} />
            </View>
          ) : null}

          {/* Open in Apple Maps link */}
          <Pressable
            onPress={() => Linking.openURL(mapsUrl)}
            style={{
              marginHorizontal: 20,
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              height: 42,
              borderRadius: 21,
              borderWidth: 1,
              borderColor: 'rgba(19,26,42,0.15)',
              backgroundColor: PARCHMENT_DEEP,
              gap: 8,
            }}>
            <Icon name="Map" size={14} color={INK} />
            <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13, opacity: 0.75 }}>
              Open in Apple Maps
            </Text>
          </Pressable>
        </ScrollView>

        {/* Sticky bottom CTA */}
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
            borderTopColor: 'rgba(19,26,42,0.08)',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={handleAddToBundle}
              hitSlop={6}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                backgroundColor: 'rgba(201,125,74,0.14)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
              <Icon name="Heart" size={18} color={BRICK} />
            </Pressable>
            <Pressable
              onPress={handleAddToTrip}
              style={{
                flex: 1,
                backgroundColor: saved ? MOSS : INK,
                height: 50,
                borderRadius: 25,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name={saved ? 'Check' : 'Plus'} size={14} color={PARCHMENT} />
              <Text
                style={{
                  color: PARCHMENT,
                  fontFamily: SERIF,
                  fontSize: 15,
                  marginLeft: 8,
                }}>
                {saved ? 'Added to trip' : 'Add to trip'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Nested TripPickerSheet — only shown when no direct tripContext.tripId */}
      <TripPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handlePickerSelect}
        mode="attach-activity"
        suggestionCityName={activity.city}
      />
      <BundlePickerSheet
        visible={bundlePickerVisible}
        onClose={() => setBundlePickerVisible(false)}
        item={bundleItem}
        suggestionCoverPhoto={activity.photo}
        suggestionName={activity.city}
      />
    </Modal>
  );
}
