import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GeoGlyph from '@/components/GeoGlyph';
import Icon from '@/components/Icon';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import type { Bundle, BundleItemRef } from '@/lib/bundleTypes';
import { addToBundle, countItems, createBundle, listBundles } from '@/utils/bundleStorage';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The item to add. The picker calls addToBundle internally and reports the bundle id. */
  item: BundleItemRef | null;
  /** Optional cover photo used when creating a brand-new bundle from inside the picker. */
  suggestionCoverPhoto?: string;
  /** Optional default name used as the placeholder for the inline "new bundle" creator. */
  suggestionName?: string;
  onPicked?: (bundleId: string) => void;
};

function formatDateRange(range?: { from: string; to: string }): string {
  if (!range) return 'Dates open';
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

export default function BundlePickerSheet({
  visible,
  onClose,
  item,
  suggestionCoverPhoto,
  suggestionName,
  onPicked,
}: Props) {
  const insets = useSafeAreaInsets();
  const [bundles, setBundles] = useState<Bundle[]>([]);
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

  useEffect(() => {
    if (visible) {
      load();
      setCreating(false);
      setDraftName('');
    }
  }, [visible, load]);

  const pick = useCallback(
    async (bundleId: string) => {
      if (!item) return;
      await addToBundle(bundleId, item);
      onPicked?.(bundleId);
      onClose();
    },
    [item, onPicked, onClose],
  );

  const createAndPick = useCallback(async () => {
    if (!item) return;
    const name = draftName.trim() || suggestionName || 'New bundle';
    const fresh = await createBundle({ name, coverPhoto: suggestionCoverPhoto });
    await addToBundle(fresh.id, item);
    onPicked?.(fresh.id);
    onClose();
  }, [draftName, item, onClose, onPicked, suggestionCoverPhoto, suggestionName]);

  const headerLabel = useMemo(() => {
    if (!item) return 'Add to a bundle';
    if (item.kind === 'stay') return 'Save this stay to…';
    if (item.kind === 'activity') return 'Save this idea to…';
    return 'Save this route to…';
  }, [item]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PARCHMENT, paddingTop: insets.top }}>
        {/* header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: PARCHMENT_COOL, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="X" size={16} color={INK} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.2 }}>
              BUNDLES
            </Text>
            <Text style={{ fontFamily: SERIF, fontSize: 22, color: INK, marginTop: 2 }}>
              {headerLabel}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}>
          {/* inline new-bundle creator */}
          {creating ? (
            <View
              style={{
                backgroundColor: INK,
                borderRadius: 20,
                padding: 18,
                marginBottom: 14,
              }}>
              <Text style={{ fontFamily: SERIF, fontSize: 11, color: PARCHMENT, opacity: 0.6, letterSpacing: 1.2 }}>
                NEW BUNDLE
              </Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder={suggestionName ?? 'A name for this collection'}
                placeholderTextColor="rgba(241,236,228,0.45)"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createAndPick}
                style={{
                  fontFamily: SERIF,
                  fontSize: 20,
                  color: PARCHMENT,
                  marginTop: 8,
                  paddingVertical: 6,
                }}
              />
              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <Pressable
                  onPress={() => setCreating(false)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(241,236,228,0.12)' }}>
                  <Text style={{ fontFamily: SERIF, fontSize: 13, color: PARCHMENT }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={createAndPick}
                  style={{ marginLeft: 'auto', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: MOSS, flexDirection: 'row', alignItems: 'center' }}>
                  <Icon name="Plus" size={14} color={PARCHMENT} />
                  <Text style={{ fontFamily: SERIF, fontSize: 13, color: PARCHMENT, marginLeft: 6 }}>
                    Create + save
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
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: INK,
                borderStyle: 'dashed',
                marginBottom: 14,
              }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: INK,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="Plus" size={20} color={PARCHMENT} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontFamily: SERIF, fontSize: 16, color: INK }}>
                  Start a new bundle
                </Text>
                <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.6, fontStyle: 'italic', marginTop: 2 }}>
                  Group favourites and I&apos;ll find the best combo.
                </Text>
              </View>
            </Pressable>
          )}

          {/* existing bundles */}
          {bundles.length === 0 && !creating ? (
            <View style={{ alignItems: 'center', paddingVertical: 36 }}>
              <GeoGlyph kind="skyline-generic" size={64} color={INK} accent={BRICK} />
              <Text style={{ fontFamily: SERIF, fontSize: 18, color: INK, marginTop: 12 }}>
                No bundles yet
              </Text>
              <Text style={{ fontFamily: SERIF, fontSize: 13, color: INK, opacity: 0.6, fontStyle: 'italic', textAlign: 'center', marginTop: 6, paddingHorizontal: 30 }}>
                Bundles let you group stays, activities and routes, then pick the cheapest or best-rated combination.
              </Text>
            </View>
          ) : null}

          {bundles.map((b) => {
            const c = counts[b.id] ?? { stays: 0, activities: 0, flights: 0 };
            const total = c.stays + c.activities + c.flights;
            return (
              <Pressable
                key={b.id}
                onPress={() => pick(b.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderRadius: 20,
                  backgroundColor: PARCHMENT_DEEP,
                  marginBottom: 10,
                }}>
                {b.coverPhoto ? (
                  <Image
                    source={{ uri: b.coverPhoto }}
                    contentFit="cover"
                    style={{ width: 56, height: 56, borderRadius: 14 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      backgroundColor: PARCHMENT_COOL,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="Heart" size={20} color={INK} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontFamily: SERIF, fontSize: 11, color: INK, opacity: 0.55, letterSpacing: 1.1 }}>
                    {formatDateRange(b.dateRange)}
                  </Text>
                  <Text style={{ fontFamily: SERIF, fontSize: 17, color: INK, marginTop: 2 }} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={{ fontFamily: SERIF, fontSize: 12, color: INK, opacity: 0.65, marginTop: 4, fontStyle: 'italic' }}>
                    {total === 0
                      ? 'Empty — add some favourites'
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
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
