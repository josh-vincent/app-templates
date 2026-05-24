import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import type { Bundle } from '@/lib/bundleTypes';
import { countItems, createBundle, deleteBundle, listBundles } from '@/utils/bundleStorage';

function formatDateRange(range?: { from: string; to: string }): string {
  if (!range) return 'Dates open';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

export default function BundlesIndex() {
  const insets = useSafeAreaInsets();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [counts, setCounts] = useState<Record<string, { stays: number; activities: number; flights: number }>>({});

  const load = useCallback(async () => {
    const all = await listBundles();
    setBundles(all);
    const c: Record<string, { stays: number; activities: number; flights: number }> = {};
    for (const b of all) c[b.id] = await countItems(b);
    setCounts(c);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onCreate = async () => {
    const name = draftName.trim() || 'New bundle';
    const fresh = await createBundle({ name });
    setDraftName('');
    setCreating(false);
    await load();
    router.push({ pathname: '/screens/bundles/[id]', params: { id: fresh.id } });
  };

  const onLongPressDelete = (b: Bundle) => {
    Alert.alert(
      'Delete bundle?',
      `“${b.name}” will be removed. Your saved stays and activities stay safe — only this collection is deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBundle(b.id);
            await load();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: PARCHMENT }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="ChevronLeft" size={18} color={INK} />
          </Pressable>
          <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.2, marginLeft: 14 }}>
            FAVOURITES
          </Text>
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 30, color: INK, marginTop: 6 }}>Bundles</Text>
        <Text style={{ fontFamily: SERIF, fontSize: 14, color: INK, opacity: 0.65, marginTop: 4, fontStyle: 'italic' }}>
          Collect stays, activities and tracked routes. Pick a window. I&apos;ll find the cheapest, the best-rated, the combo that fits.
        </Text>
      </View>

      <FlatList
        data={bundles}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INK} />}
        ListHeaderComponent={
          creating ? (
            <View
              style={{
                backgroundColor: INK,
                borderRadius: 22,
                padding: 18,
                marginBottom: 14,
              }}>
              <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: 0.6, letterSpacing: 1.2 }}>
                NEW BUNDLE
              </Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g. Tokyo cherry blossom"
                placeholderTextColor="rgba(241,236,228,0.45)"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onCreate}
                style={{ fontFamily: SERIF, fontSize: 22, color: PARCHMENT, marginTop: 8, paddingVertical: 6 }}
              />
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <Pressable
                  onPress={() => { setCreating(false); setDraftName(''); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(241,236,228,0.12)' }}>
                  <Text style={{ fontFamily: SERIF, fontSize: 13, color: PARCHMENT }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onCreate}
                  style={{ marginLeft: 'auto', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: MOSS, flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="Plus" size={14} color={PARCHMENT} />
                  <Text style={{ fontFamily: SERIF, fontSize: 13, color: PARCHMENT, marginLeft: 6 }}>
                    Create bundle
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setCreating(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 22,
                borderWidth: 1.5,
                borderColor: INK,
                borderStyle: 'dashed',
                marginBottom: 14,
              }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="Plus" size={20} color={PARCHMENT} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontFamily: SERIF, fontSize: 17, color: INK }}>Start a new bundle</Text>
                <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.6, fontStyle: 'italic', marginTop: 2 }}>
                  Group your favourites and compare combinations.
                </Text>
              </View>
            </Pressable>
          )
        }
        ListEmptyComponent={
          !creating ? (
            <View
              style={{ alignItems: 'center', paddingVertical: 36, marginTop: 8, paddingHorizontal: 24, backgroundColor: PARCHMENT_DEEP, borderRadius: 24 }}>
              <GeoGlyph kind="skyline-generic" size={72} color={INK} accent={BRICK} />
              <Text style={{ fontFamily: SERIF, fontSize: 22, color: INK, marginTop: 12 }}>
                No bundles yet
              </Text>
              <Text style={{ fontFamily: SERIF, fontSize: 13, color: INK, opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }}>
                Tap the heart on any stay or activity to start one — or hit the dashed button above.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const c = counts[item.id] ?? { stays: 0, activities: 0, flights: 0 };
          const total = c.stays + c.activities + c.flights;
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/screens/bundles/[id]', params: { id: item.id } })}
              onLongPress={() => onLongPressDelete(item)}
              style={{
                flexDirection: 'row',
                padding: 14,
                borderRadius: 22,
                backgroundColor: PARCHMENT_DEEP,
                marginBottom: 12,
                alignItems: 'center',
              }}>
              {item.coverPhoto ? (
                <Image
                  source={{ uri: item.coverPhoto }}
                  contentFit="cover"
                  style={{ width: 64, height: 64, borderRadius: 16 }}
                />
              ) : (
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    backgroundColor: PARCHMENT_COOL,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="Heart" size={24} color={INK} />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
                  {formatDateRange(item.dateRange)}
                </Text>
                <Text style={{ fontFamily: SERIF, fontSize: 19, color: INK, marginTop: 2 }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.65, marginTop: 4, fontStyle: 'italic' }}>
                  {total === 0
                    ? 'Empty bundle — add favourites'
                    : [c.stays ? `${c.stays} stay${c.stays > 1 ? 's' : ''}` : null,
                       c.activities ? `${c.activities} thing${c.activities > 1 ? 's' : ''}` : null,
                       c.flights ? `${c.flights} flight${c.flights > 1 ? 's' : ''}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                </Text>
              </View>
              <Icon name="ChevronRight" size={16} color={INK} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
