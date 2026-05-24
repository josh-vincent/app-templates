import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActivityDetailSheet from '@/components/ActivityDetailSheet';
import AnimatedView from '@/components/AnimatedView';
import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import TripPickerSheet from '@/components/TripPickerSheet';
import { useThemeColors } from '@/contexts/ThemeColors';
import {
  KIND_META,
  type Activity,
  type ActivityKind,
  getCityActivities,
  listSupportedCities,
} from '@/lib/discover';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import {
  listSavedActivities,
  removeSavedActivity,
  saveActivity,
} from '@/utils/discoverStorage';
import { linkActivityToTrip, getTripById } from '@/utils/tripStorage';
import { listSavedStays } from '@/utils/staysStorage';
import type { SavedStay } from '@/lib/stayTypes';
import { activityDistanceFromStay, formatDistance } from '@/lib/distanceUtils';

type Query = {
  city: string;
  tripId?: string;
};

const KIND_ORDER: ActivityKind[] = ['food', 'view', 'culture', 'outdoors', 'nightlife', 'shopping'];

export default function DiscoverScreen() {
  const params = useLocalSearchParams<Query>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;

  const cityParam = String(params.city ?? '');
  const tripId = params.tripId ? String(params.tripId) : undefined;

  const resolved = useMemo(() => getCityActivities(cityParam), [cityParam]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all');
  const [pickerActivity, setPickerActivity] = useState<Activity | null>(null);
  const [dismissedBar, setDismissedBar] = useState(false);
  const [primaryStay, setPrimaryStay] = useState<SavedStay | null>(null);

  // Sheet state — tapping a card opens the detail sheet
  const [sheetActivity, setSheetActivity] = useState<Activity | null>(null);

  // Bulk-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);

  const toggleSelection = (id: string) =>
    setSelectedIds((prev) => {
      if (prev.size >= 12 && !prev.has(id)) return prev; // soft cap at 12
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const loadSaved = useCallback(async () => {
    const list = await listSavedActivities();
    setSavedIds(new Set(list.filter((s) => !tripId || s.tripId === tripId).map((s) => s.id)));
    if (tripId) {
      const trip = await getTripById(tripId);
      if (trip && trip.stayIds.length > 0) {
        const stays = await listSavedStays();
        const found = stays.find((s) => s.id === trip.stayIds[0]) ?? null;
        setPrimaryStay(found);
      } else {
        setPrimaryStay(null);
      }
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  if (!resolved) {
    return <NotSupported insets={insets} requested={cityParam} isDark={isDark} />;
  }

  const all = resolved.activities;
  const filtered = filter === 'all' ? all : all.filter((a) => a.kind === filter);
  const kindCounts = KIND_ORDER.reduce<Record<ActivityKind, number>>((acc, k) => {
    acc[k] = all.filter((a) => a.kind === k).length;
    return acc;
  }, { food: 0, culture: 0, outdoors: 0, nightlife: 0, view: 0, shopping: 0 });

  const onToggleSave = async (a: Activity) => {
    if (savedIds.has(a.id)) {
      await removeSavedActivity(a.id, tripId);
      loadSaved();
    } else if (!tripId) {
      // No tripId in URL — open picker so the user can choose
      setPickerActivity(a);
    } else {
      await saveActivity(a, { tripId });
      loadSaved();
    }
  };

  const onPickerSelect = async (selectedTripId: string | null) => {
    setPickerActivity(null);
    if (!pickerActivity) return;
    await saveActivity(pickerActivity, { tripId: selectedTripId ?? undefined });
    if (selectedTripId) {
      await linkActivityToTrip(selectedTripId, pickerActivity.id);
    }
    loadSaved();
  };

  const onBulkSave = async (targetTripId: string) => {
    const selected = all.filter((a) => selectedIds.has(a.id));
    await Promise.all(
      selected.map(async (a) => {
        await saveActivity(a, { tripId: targetTripId });
        await linkActivityToTrip(targetTripId, a.id);
      }),
    );
    setSelectedIds(new Set());
    setSelectMode(false);
    loadSaved();
  };

  const onBulkPickerSelect = async (chosenTripId: string | null) => {
    setBulkPickerOpen(false);
    if (!chosenTripId) return;
    await onBulkSave(chosenTripId);
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <TopBar isDark={isDark} city={resolved.city} />

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View
          className="rounded-3xl overflow-hidden mx-5 mt-3 mb-5 p-6"
          style={{
            backgroundColor: PARCHMENT_COOL,
            borderLeftWidth: 4,
            borderLeftColor: BRICK,
            minHeight: 180,
            justifyContent: 'space-between',
          }}>
          <View>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.55,
                fontSize: 13,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>
              Discover
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                fontSize: 32,
                marginTop: 6,
                lineHeight: 36,
                letterSpacing: -0.4,
              }}>
              {resolved.city}
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.65,
                fontSize: 13,
                marginTop: 4,
                fontStyle: 'italic',
              }}>
              {all.length} hand-picked ideas · save the ones that fit your trip
            </Text>
          </View>
          <View className="flex-row items-end justify-between">
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.5,
                fontSize: 12,
                fontStyle: 'italic',
              }}>
              tap a card to read the note
            </Text>
            <GeoGlyph
              iata={resolved.city.slice(0, 3).toUpperCase()}
              size={64}
              color={INK}
              accent={BRICK}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            className="-mx-5 px-5 mb-5"
            contentContainerStyle={{ paddingRight: 8 }}>
            <FilterPill
              label={`All ${all.length}`}
              active={filter === 'all'}
              accent={INK}
              onPress={() => setFilter('all')}
            />
            {KIND_ORDER.filter((k) => kindCounts[k] > 0).map((k) => (
              <FilterPill
                key={k}
                label={`${KIND_META[k].label} ${kindCounts[k]}`}
                icon={KIND_META[k].icon}
                active={filter === k}
                accent={KIND_META[k].accent}
                onPress={() => setFilter(k)}
              />
            ))}
          </ScrollView>
          {/* Divider + Select / Done pill — always visible at right edge */}
          <View
            style={{
              width: 1,
              height: 28,
              backgroundColor: `rgba(19,26,42,0.12)`,
              marginBottom: 20,
              marginRight: 8,
            }}
          />
          <Pressable
            onPress={() => {
              if (selectMode) {
                setSelectMode(false);
                setSelectedIds(new Set());
              } else {
                setSelectMode(true);
              }
            }}
            className="flex-row items-center px-3 py-2 rounded-full"
            style={{ backgroundColor: selectMode ? MOSS : INK, marginBottom: 20, marginRight: 20 }}>
            <Icon name={selectMode ? 'CheckCheck' : 'CheckSquare'} size={12} color={PARCHMENT} />
            <Text
              style={{
                fontFamily: SERIF,
                color: PARCHMENT,
                fontSize: 12,
                marginLeft: 6,
              }}>
              {selectMode ? 'Done' : 'Select'}
            </Text>
          </Pressable>
        </View>

        <AnimatedView animation="scaleIn" className="px-5">
          {filtered.map((a, idx) => (
            <ActivityCard
              key={a.id}
              activity={a}
              isFirst={idx === 0 && filter === 'all'}
              saved={savedIds.has(a.id)}
              onToggleSave={() => onToggleSave(a)}
              onPress={() => {
                // In select mode: toggle selection. Outside: open detail sheet.
                if (selectMode) {
                  toggleSelection(a.id);
                } else {
                  setSheetActivity(a);
                }
              }}
              stay={primaryStay ?? undefined}
              selectMode={selectMode}
              selected={selectedIds.has(a.id)}
              onToggleSelect={() => toggleSelection(a.id)}
            />
          ))}
          {filtered.length === 0 ? (
            <View
              className="rounded-3xl p-6 items-center mt-2"
              style={{ backgroundColor: PARCHMENT_DEEP }}>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  fontSize: 16,
                  marginTop: 8,
                }}>
                Nothing in this category yet
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 12,
                  marginTop: 4,
                  fontStyle: 'italic',
                }}>
                Switch back to all to see the full list.
              </Text>
            </View>
          ) : null}
        </AnimatedView>

        <View className="items-center mt-6 mb-4" style={{ opacity: 0.5 }}>
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 11, fontStyle: 'italic' }}>
            local-first · saved ideas live in your trip
          </Text>
        </View>
      </ScrollView>

      {savedIds.size > 0 && !dismissedBar ? (
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
          <Pressable
            onPress={() => {
              if (tripId) {
                router.push({ pathname: '/screens/trip/[id]', params: { id: tripId } });
              } else {
                setDismissedBar(true);
              }
            }}
            className="rounded-full flex-row items-center justify-center"
            style={{ backgroundColor: INK, height: 50 }}>
            <Icon name="Bookmark" size={14} color={PARCHMENT} />
            <Text
              style={{
                color: PARCHMENT,
                fontFamily: SERIF,
                fontSize: 15,
                marginLeft: 8,
              }}>
              {savedIds.size} saved · {tripId ? 'open trip' : 'keep browsing'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Bulk-add floating CTA */}
      {selectMode && selectedIds.size >= 1 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 64,
            backgroundColor: INK,
            paddingBottom: insets.bottom,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Pressable
            onPress={() => {
              if (tripId) {
                onBulkSave(tripId);
              } else {
                setBulkPickerOpen(true);
              }
            }}
            className="flex-row items-center"
            style={{ flex: 1, justifyContent: 'center' }}>
            <Icon name="PlusCircle" size={16} color={PARCHMENT_COOL} />
            <Text
              style={{
                fontFamily: SERIF,
                color: PARCHMENT_COOL,
                fontSize: 15,
                marginLeft: 8,
              }}>
              {`Add ${selectedIds.size} to trip`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <TripPickerSheet
        visible={pickerActivity !== null}
        onClose={() => setPickerActivity(null)}
        onSelect={onPickerSelect}
        mode="attach-activity"
        suggestionCityName={resolved?.city}
      />

      <TripPickerSheet
        visible={bulkPickerOpen}
        onClose={() => setBulkPickerOpen(false)}
        onSelect={onBulkPickerSelect}
        mode="attach-activity"
        suggestionCityName={resolved?.city}
      />

      {/* Activity detail bottom-sheet */}
      <ActivityDetailSheet
        activity={sheetActivity}
        visible={!!sheetActivity}
        onClose={() => setSheetActivity(null)}
        tripContext={tripId ? { tripId, stay: primaryStay } : undefined}
        onSaved={() => loadSaved()}
      />
    </View>
  );
}

function TopBar({ isDark, city }: { isDark: boolean; city: string }) {
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
          Discover
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: isDark ? PARCHMENT : INK,
            fontSize: 15,
            marginLeft: 8,
          }}>
          · {city}
        </Text>
      </View>
    </View>
  );
}

function FilterPill({
  label,
  icon,
  active,
  accent,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center mr-2 px-3 py-2 rounded-full"
      style={{
        backgroundColor: active ? INK : PARCHMENT_DEEP,
      }}>
      {icon ? (
        <Icon name={icon as any} size={12} color={active ? PARCHMENT : accent} />
      ) : null}
      <Text
        style={{
          fontFamily: SERIF,
          color: active ? PARCHMENT : INK,
          fontSize: 12,
          marginLeft: icon ? 6 : 0,
        }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActivityCard({
  activity,
  isFirst,
  saved,
  onToggleSave,
  onPress,
  stay,
  selectMode,
  selected,
  onToggleSelect,
}: {
  activity: Activity;
  isFirst: boolean;
  saved: boolean;
  onToggleSave: () => void;
  onPress: () => void;
  stay?: SavedStay;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const meta = KIND_META[activity.kind];
  const distLabel = stay ? formatDistance(activityDistanceFromStay(activity, stay)) : '';

  // ── Inverted lead card: full-bleed photo + gradient overlay ─────────────
  if (isFirst && activity.photo) {
    return (
      <Pressable
        onPress={onPress}
        className="rounded-3xl overflow-hidden mb-3"
        style={{ minHeight: 220 }}>
        {/* Full-bleed background photo */}
        <Image
          source={{ uri: activity.photo }}
          contentFit="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* Scrim so INK-coloured content remains legible */}
        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(19,26,42,0.85)']}
          locations={[0, 0.5, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Selection badge */}
        {selectMode ? (
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: selected ? MOSS : 'rgba(241,236,228,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: selected ? 0 : 1.5,
              borderColor: PARCHMENT,
            }}>
            {selected ? <Icon name="Check" size={13} color={PARCHMENT} /> : null}
          </View>
        ) : null}

        {/* Text content pinned to bottom over gradient */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <View className="flex-row items-center">
              <View
                className="h-7 w-7 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: 'rgba(241,236,228,0.15)' }}>
                <Icon name={meta.icon as any} size={12} color={PARCHMENT} />
              </View>
              <Text
                style={{
                  fontFamily: SERIF,
                  color: PARCHMENT,
                  opacity: 0.75,
                  fontSize: 11,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}>
                {meta.label} · {activity.when}
              </Text>
            </View>
            <View className="flex-row">
              {Array.from({ length: 3 }).map((_, i) => (
                <Text
                  key={i}
                  style={{
                    fontFamily: SERIF,
                    color: i < activity.priceLevel ? PARCHMENT : 'rgba(241,236,228,0.25)',
                    fontSize: 12,
                    marginLeft: 1,
                  }}>
                  $
                </Text>
              ))}
            </View>
          </View>

          <View className="px-4 pb-3">
            <Text
              style={{
                fontFamily: SERIF,
                color: PARCHMENT,
                fontSize: 22,
                lineHeight: 26,
                letterSpacing: -0.2,
              }}>
              {activity.title}
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                color: PARCHMENT,
                opacity: 0.6,
                fontSize: 12,
                marginTop: 2,
              }}>
              {activity.area}
            </Text>
            {distLabel ? (
              <View className="flex-row items-center mt-1">
                <Icon name="Navigation" size={10} color={PARCHMENT} style={{ opacity: 0.55 } as any} />
                <Text
                  style={{
                    fontFamily: SERIF,
                    color: PARCHMENT,
                    opacity: 0.55,
                    fontSize: 11,
                    marginLeft: 4,
                    fontStyle: 'italic',
                  }}>
                  {distLabel}
                </Text>
              </View>
            ) : null}
            {activity.blurb ? (
              <Text
                style={{
                  fontFamily: SERIF,
                  color: PARCHMENT,
                  opacity: 0.8,
                  fontSize: 13,
                  marginTop: 8,
                  lineHeight: 19,
                  fontStyle: 'italic',
                }}>
                {activity.blurb}
              </Text>
            ) : null}
          </View>

          <View
            className="flex-row items-center justify-between px-4 py-3"
            style={{ borderTopWidth: 1, borderTopColor: 'rgba(241,236,228,0.12)' }}>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onToggleSave(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="flex-row items-center px-3 py-1.5 rounded-full"
              style={{ backgroundColor: saved ? MOSS : 'rgba(241,236,228,0.12)' }}>
              <Icon name={saved ? 'Check' : 'Plus'} size={12} color={PARCHMENT} />
              <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 12, marginLeft: 4 }}>
                {saved ? 'On your trip' : 'Add to trip'}
              </Text>
            </Pressable>
            <View className="flex-row items-center" style={{ opacity: 0.65 }}>
              <Icon name="MapPin" size={11} color={PARCHMENT} />
              <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 11, marginLeft: 4 }}>
                {activity.area}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Standard card: 16:9 photo strip at top ───────────────────────────────
  return (
    <Pressable
      onPress={onPress}
      className="rounded-3xl overflow-hidden mb-3"
      style={{ backgroundColor: PARCHMENT_DEEP }}>
      {/* Photo strip */}
      {activity.photo ? (
        <Image
          source={{ uri: activity.photo }}
          contentFit="cover"
          style={{
            width: '100%',
            height: 120,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        />
      ) : null}

      {/* Selection badge */}
      {selectMode ? (
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: selected ? MOSS : 'rgba(19,26,42,0.25)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: selected ? 0 : 1.5,
            borderColor: PARCHMENT,
          }}>
          {selected ? <Icon name="Check" size={13} color={PARCHMENT} /> : null}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between p-4 pb-2">
        <View className="flex-row items-center">
          <View
            className="h-7 w-7 rounded-full items-center justify-center mr-2"
            style={{ backgroundColor: meta.accent + '22' }}>
            <Icon name={meta.icon as any} size={12} color={meta.accent} />
          </View>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.6,
              fontSize: 11,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}>
            {meta.label} · {activity.when}
          </Text>
        </View>
        <View className="flex-row">
          {Array.from({ length: 3 }).map((_, i) => (
            <Text
              key={i}
              style={{
                fontFamily: SERIF,
                color: i < activity.priceLevel ? INK : 'rgba(19,26,42,0.2)',
                fontSize: 12,
                marginLeft: 1,
              }}>
              $
            </Text>
          ))}
        </View>
      </View>

      <View className="px-4 pb-3">
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 22,
            lineHeight: 26,
            letterSpacing: -0.2,
          }}>
          {activity.title}
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 12,
            marginTop: 2,
          }}>
          {activity.area}
        </Text>
        {distLabel ? (
          <View className="flex-row items-center mt-1">
            <Icon name="Navigation" size={10} color={INK} style={{ opacity: 0.55 } as any} />
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.55,
                fontSize: 11,
                marginLeft: 4,
                fontStyle: 'italic',
              }}>
              {distLabel}
            </Text>
          </View>
        ) : null}
        {activity.blurb ? (
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.75,
              fontSize: 13,
              marginTop: 8,
              lineHeight: 19,
              fontStyle: 'italic',
            }}>
            {activity.blurb}
          </Text>
        ) : null}
      </View>

      <View
        className="flex-row items-center justify-between px-4 py-3"
        style={{
          borderTopWidth: 1,
          borderTopColor: 'rgba(19,26,42,0.08)',
        }}>
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onToggleSave(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="flex-row items-center px-3 py-1.5 rounded-full"
          style={{ backgroundColor: saved ? MOSS : 'rgba(19,26,42,0.06)' }}>
          <Icon name={saved ? 'Check' : 'Plus'} size={12} color={saved ? PARCHMENT : INK} />
          <Text
            style={{
              fontFamily: SERIF,
              color: saved ? PARCHMENT : INK,
              fontSize: 12,
              marginLeft: 4,
            }}>
            {saved ? 'On your trip' : 'Add to trip'}
          </Text>
        </Pressable>
        <View className="flex-row items-center" style={{ opacity: 0.5 }}>
          <Icon name="MapPin" size={11} color={INK} />
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 11, marginLeft: 4 }}>
            {activity.area}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function NotSupported({
  insets,
  requested,
  isDark,
}: {
  insets: { top: number; bottom: number };
  requested: string;
  isDark: boolean;
}) {
  const cities = listSupportedCities();
  return (
    <View style={{ flex: 1, backgroundColor: PARCHMENT }}>
      <TopBar isDark={isDark} city="—" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <View
          className="rounded-3xl p-6"
          style={{ backgroundColor: PARCHMENT_COOL }}>
          <Icon name="Compass" size={42} color={INK} />
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 22,
              marginTop: 12,
              letterSpacing: -0.2,
            }}>
            No curated notes for {requested || 'this city'} yet
          </Text>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.65,
              fontSize: 13,
              marginTop: 6,
              fontStyle: 'italic',
              lineHeight: 20,
            }}>
            I keep deliberately small lists so the picks stay useful. Pick a city
            below, or ask the concierge for ideas anywhere.
          </Text>
        </View>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 14,
            marginTop: 20,
            marginBottom: 8,
            opacity: 0.6,
          }}>
          Try one of these
        </Text>
        <View className="flex-row flex-wrap">
          {cities.map((c) => (
            <Pressable
              key={c}
              onPress={() => router.replace({ pathname: '/screens/discover/[city]', params: { city: c } })}
              className="rounded-full px-3 py-2 mr-2 mb-2"
              style={{ backgroundColor: PARCHMENT_DEEP }}>
              <Text style={{ fontFamily: SERIF, color: INK, fontSize: 13 }}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
