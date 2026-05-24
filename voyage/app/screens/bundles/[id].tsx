import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BundleDealsSheet from '@/components/BundleDealsSheet';
import DateRangeCalendar from '@/components/DateRangeCalendar';
import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { findAirport } from '@/lib/airports';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import type { Bundle, BundleItemRef } from '@/lib/bundleTypes';
import {
  deleteBundle,
  getBundleById,
  removeFromBundle,
  updateBundle,
} from '@/utils/bundleStorage';
import { listSavedActivities, type SavedActivity } from '@/utils/discoverStorage';
import { listSavedStays } from '@/utils/staysStorage';
import { listTracked, type TrackedRoute } from '@/utils/trackedStorage';
import type { SavedStay } from '@/lib/stayTypes';

type ResolvedItem =
  | { ref: BundleItemRef; kind: 'stay'; record: SavedStay }
  | { ref: BundleItemRef; kind: 'activity'; record: SavedActivity }
  | { ref: BundleItemRef; kind: 'flight'; record: TrackedRoute };

function formatDateRange(range?: { from: string; to: string }): string {
  if (!range) return 'Tap to set a date window';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

function nightsOf(range?: { from: string; to: string }): number {
  if (!range) return 0;
  const a = Date.parse(range.from);
  const b = Date.parse(range.to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export default function BundleDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [dealsOpen, setDealsOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const b = await getBundleById(id);
    if (!b) {
      router.back();
      return;
    }
    setBundle(b);
    setDraftName(b.name);

    const [stays, activities, tracked] = await Promise.all([
      listSavedStays(),
      listSavedActivities(),
      listTracked(),
    ]);
    const resolved: ResolvedItem[] = [];
    for (const ref of b.items) {
      if (ref.kind === 'stay') {
        const record = stays.find((s) => s.id === ref.savedStayId);
        if (record) resolved.push({ ref, kind: 'stay', record });
      } else if (ref.kind === 'activity') {
        const record = activities.find((a) => a.id === ref.savedActivityId);
        if (record) resolved.push({ ref, kind: 'activity', record });
      } else if (ref.kind === 'flight') {
        const record = tracked.find((t) => t.id === ref.trackedRouteId);
        if (record) resolved.push({ ref, kind: 'flight', record });
      }
    }
    setItems(resolved);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo(() => {
    const c = { stays: 0, activities: 0, flights: 0 };
    for (const r of items) {
      if (r.kind === 'stay') c.stays++;
      else if (r.kind === 'activity') c.activities++;
      else if (r.kind === 'flight') c.flights++;
    }
    return c;
  }, [items]);

  const onSaveName = async () => {
    if (!bundle) return;
    const next = draftName.trim() || 'Untitled bundle';
    await updateBundle(bundle.id, { name: next });
    setEditingName(false);
    await load();
  };

  const onConfirmRange = async () => {
    if (!bundle) return;
    const { startDate, endDate } = pendingRange;
    if (startDate && endDate) {
      await updateBundle(bundle.id, { dateRange: { from: startDate, to: endDate } });
    } else {
      await updateBundle(bundle.id, { dateRange: undefined });
    }
    setCalendarOpen(false);
    await load();
  };

  const onClearRange = async () => {
    if (!bundle) return;
    await updateBundle(bundle.id, { dateRange: undefined });
    setCalendarOpen(false);
    await load();
  };

  const onRemoveItem = async (ref: BundleItemRef) => {
    if (!bundle) return;
    await removeFromBundle(bundle.id, ref);
    await load();
  };

  const onDeleteBundle = () => {
    if (!bundle) return;
    Alert.alert('Delete bundle?', `“${bundle.name}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBundle(bundle.id);
          router.back();
        },
      },
    ]);
  };

  useEffect(() => {
    if (calendarOpen && bundle?.dateRange) {
      setPendingRange({ startDate: bundle.dateRange.from, endDate: bundle.dateRange.to });
    } else if (calendarOpen) {
      setPendingRange({});
    }
  }, [calendarOpen, bundle]);

  if (!bundle) return null;

  const nights = nightsOf(bundle.dateRange);
  const canFindDeals = items.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: PARCHMENT }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ChevronLeft" size={18} color={INK} />
          </Pressable>
          <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.2, marginLeft: 14 }}>
            BUNDLE
          </Text>
          <Pressable
            onPress={onDeleteBundle}
            hitSlop={10}
            style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Trash2" size={14} color={INK} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 130 }}>
        {/* name */}
        {editingName ? (
          <View style={{ marginTop: 6 }}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSaveName}
              onBlur={onSaveName}
              style={{ fontFamily: SERIF, fontSize: 30, color: INK, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: INK }}
            />
          </View>
        ) : (
          <Pressable onPress={() => setEditingName(true)} style={{ marginTop: 6 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, color: INK }}>{bundle.name}</Text>
            <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.45, marginTop: 2, fontStyle: 'italic' }}>
              tap to rename
            </Text>
          </Pressable>
        )}

        {/* date range */}
        <Pressable
          onPress={() => setCalendarOpen(true)}
          style={{
            marginTop: 18,
            padding: 16,
            backgroundColor: PARCHMENT_DEEP,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Calendar" size={18} color={PARCHMENT} />
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
              {nights > 0 ? `${nights} NIGHT${nights > 1 ? 'S' : ''}` : 'WINDOW'}
            </Text>
            <Text style={{ fontFamily: SERIF, fontSize: 17, color: INK, marginTop: 2 }}>
              {formatDateRange(bundle.dateRange)}
            </Text>
          </View>
          <Icon name="ChevronRight" size={16} color={INK} />
        </Pressable>

        {/* find deals CTA */}
        <Pressable
          onPress={() => canFindDeals && setDealsOpen(true)}
          disabled={!canFindDeals}
          style={{
            marginTop: 14,
            padding: 18,
            backgroundColor: canFindDeals ? INK : 'rgba(19,26,42,0.18)',
            borderRadius: 22,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: MOSS, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Sparkles" size={18} color={PARCHMENT} />
          </View>
          <View style={{ marginLeft: 14, flex: 1 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: canFindDeals ? 0.6 : 0.4, letterSpacing: 1.1 }}>
              DEAL FINDER
            </Text>
            <Text style={{ fontFamily: SERIF, fontSize: 17, color: PARCHMENT, marginTop: 2 }}>
              {canFindDeals ? 'Find the best combination' : 'Add favourites to find combos'}
            </Text>
          </View>
          <Icon name="ArrowRight" size={16} color={PARCHMENT} />
        </Pressable>

        {/* contents section */}
        <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.2, marginTop: 26, marginBottom: 10 }}>
          IN THIS BUNDLE — {counts.stays} STAY{counts.stays === 1 ? '' : 'S'} · {counts.activities} THING{counts.activities === 1 ? '' : 'S'} · {counts.flights} FLIGHT{counts.flights === 1 ? '' : 'S'}
        </Text>

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 36, backgroundColor: PARCHMENT_DEEP, borderRadius: 22 }}>
            <GeoGlyph kind="skyline-generic" size={64} color={INK} accent={BRICK} />
            <Text style={{ fontFamily: SERIF, fontSize: 18, color: INK, marginTop: 10 }}>Empty for now</Text>
            <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: 6 }}>
              Tap the heart on a stay, activity, or tracked route to add it here.
            </Text>
          </View>
        ) : (
          items.map((it) => <ItemRow key={refKey(it.ref)} item={it} onRemove={() => onRemoveItem(it.ref)} />)
        )}
      </ScrollView>

      {/* date picker modal */}
      <Modal visible={calendarOpen} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setCalendarOpen(false)}>
        <View style={{ flex: 1, backgroundColor: PARCHMENT, paddingTop: insets.top }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
            <Pressable
              onPress={() => setCalendarOpen(false)}
              hitSlop={10}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="X" size={16} color={INK} />
            </Pressable>
            <Text style={{ fontFamily: SERIF, fontSize: 22, color: INK, marginLeft: 14 }}>Pick a window</Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <DateRangeCalendar
              initialRange={pendingRange}
              onDateRangeChange={(r) => setPendingRange(r)}
              minDate={new Date().toISOString().slice(0, 10)}
            />
          </View>
          <View style={{ flexDirection: 'row', padding: 16, paddingBottom: insets.bottom + 16, gap: 12 }}>
            <Pressable
              onPress={onClearRange}
              style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: PARCHMENT_COOL }}>
              <Text style={{ fontFamily: SERIF, fontSize: 14, color: INK }}>Clear window</Text>
            </Pressable>
            <Pressable
              onPress={onConfirmRange}
              disabled={!pendingRange.startDate || !pendingRange.endDate}
              style={{
                flex: 1,
                paddingVertical: 14,
                alignItems: 'center',
                borderRadius: 16,
                backgroundColor: pendingRange.startDate && pendingRange.endDate ? INK : 'rgba(19,26,42,0.25)',
              }}>
              <Text style={{ fontFamily: SERIF, fontSize: 14, color: PARCHMENT }}>
                Save window
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <BundleDealsSheet
        bundleId={bundle.id}
        visible={dealsOpen}
        onClose={() => setDealsOpen(false)}
      />
    </View>
  );
}

function refKey(r: BundleItemRef): string {
  if (r.kind === 'stay') return `stay:${r.savedStayId}`;
  if (r.kind === 'activity') return `activity:${r.savedActivityId}`;
  return `flight:${r.trackedRouteId}`;
}

function ItemRow({ item, onRemove }: { item: ResolvedItem; onRemove: () => void }) {
  if (item.kind === 'stay') {
    const s = item.record;
    return (
      <View style={rowStyle}>
        {s.coverPhoto ? (
          <Image source={{ uri: s.coverPhoto }} contentFit="cover" style={thumbStyle} />
        ) : (
          <FallbackThumb icon="BedDouble" tint={MOSS} />
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
            STAY · {s.cityName.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: SERIF, fontSize: 16, color: INK, marginTop: 2 }} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.65, marginTop: 4, fontStyle: 'italic' }}>
            {s.currency} {Math.round(s.pricePerNight)} / night · {s.rating.toFixed(1)}★
          </Text>
        </View>
        <RemoveBtn onPress={onRemove} />
      </View>
    );
  }
  if (item.kind === 'activity') {
    const a = item.record;
    return (
      <View style={rowStyle}>
        {a.photo ? (
          <Image source={{ uri: a.photo }} contentFit="cover" style={thumbStyle} />
        ) : (
          <FallbackThumb icon="MapPin" tint={BRICK} />
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
            {a.kind.toUpperCase()} · {a.area.toUpperCase()}
          </Text>
          <Text style={{ fontFamily: SERIF, fontSize: 16, color: INK, marginTop: 2 }} numberOfLines={2}>
            {a.title}
          </Text>
          <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.65, marginTop: 4, fontStyle: 'italic' }}>
            {a.when} · {'$'.repeat(a.priceLevel)}
          </Text>
        </View>
        <RemoveBtn onPress={onRemove} />
      </View>
    );
  }
  // flight
  const t = item.record;
  const from = findAirport(t.origin);
  const to = findAirport(t.destination);
  return (
    <View style={rowStyle}>
      <FallbackThumb icon="Plane" tint={INK} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
          FLIGHT · TRACKED
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 16, color: INK, marginTop: 2 }} numberOfLines={1}>
          {from?.city ?? t.origin} → {to?.city ?? t.destination}
        </Text>
        <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.65, marginTop: 4, fontStyle: 'italic' }}>
          {t.currency} {Math.round(t.lastPrice)} · lowest seen {Math.round(t.lowestPrice ?? t.lastPrice)}
        </Text>
      </View>
      <RemoveBtn onPress={onRemove} />
    </View>
  );
}

const rowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  padding: 12,
  backgroundColor: PARCHMENT_DEEP,
  borderRadius: 20,
  marginBottom: 10,
};

const thumbStyle = { width: 60, height: 60, borderRadius: 14 } as const;

function FallbackThumb({ icon, tint }: { icon: string; tint: string }) {
  return (
    <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon as any} size={22} color={tint} />
    </View>
  );
}

function RemoveBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
      <Icon name="X" size={14} color={INK} />
    </Pressable>
  );
}
