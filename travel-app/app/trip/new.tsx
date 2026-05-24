import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { api } from '@/convex/_generated/api';
import { useMutation } from '@/lib/persona-convex';
import { EMBER, GOLD, IRON, LIME, SKY } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };
const EMOJIS = ['✈️', '🏖️', '🗽', '🏔️', '🍝', '🏰', '🌋', '🎢', '🛶', '🐘', '🍷', '🏯'];

// Date helpers — input format YYYY-MM-DD for parse stability.
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const ms = new Date(iso + 'T12:00:00').getTime() + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function parseISO(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return null;
  const t = Date.parse(iso + 'T12:00:00');
  if (Number.isNaN(t)) return null;
  return t;
}

function fmt(iso: string): string {
  const ts = parseISO(iso);
  if (ts == null) return iso;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NewTripScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const createTrip = useMutation(api.trips.createTrip);

  const today = useMemo(() => isoToday(), []);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startsAt, setStartsAt] = useState(addDaysISO(today, 14));
  const [endsAt, setEndsAt] = useState(addDaysISO(today, 17));
  const [travelers, setTravelers] = useState('2');
  const [coverEmoji, setCoverEmoji] = useState(EMOJIS[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    destination.trim().length > 0 &&
    parseISO(startsAt) != null &&
    parseISO(endsAt) != null &&
    Number.parseInt(travelers, 10) >= 1;

  const onSubmit = async () => {
    setError(null);
    const startMs = parseISO(startsAt);
    const endMs = parseISO(endsAt);
    if (startMs == null || endMs == null) {
      setError('Dates must be in YYYY-MM-DD format.');
      return;
    }
    if (endMs < startMs) {
      setError('End date must be on or after the start date.');
      return;
    }
    const t = Number.parseInt(travelers, 10);
    if (Number.isNaN(t) || t < 1) {
      setError('Need at least one traveler.');
      return;
    }
    setSubmitting(true);
    try {
      const id = await createTrip({
        title: title.trim(),
        destination: destination.trim(),
        startsAt: startMs,
        endsAt: endMs,
        travelerCount: t,
        coverEmoji,
        notes: notes.trim() || undefined,
      });
      router.dismissAll?.();
      router.replace(`/trip/${id}` as any);
    } catch (e: any) {
      setError(e?.message ?? 'Could not create that trip.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 4 }} />
      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="new-trip-close-button">
          <Icon name="X" size={22} color={colors.text} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: colors.text,
            fontSize: 17,
            fontWeight: '800',
          }}>
          New Trip
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled">
        {/* Cover */}
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>
          COVER
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, marginHorizontal: -PAGE_X }}
          contentContainerStyle={{ paddingHorizontal: PAGE_X, gap: 10 }}>
          {EMOJIS.map((e) => {
            const selected = e === coverEmoji;
            return (
              <Pressable
                key={e}
                onPress={() => setCoverEmoji(e)}
                accessibilityRole="button"
                accessibilityLabel={`Cover ${e}`}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? GOLD : colors.text + '08',
                  borderWidth: selected ? 0 : 1,
                  borderColor: colors.text + '14',
                }}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Title */}
        <Field label="TITLE" colors={colors}>
          <TextInput
            placeholder="Tokyo getaway"
            placeholderTextColor={colors.placeholder}
            value={title}
            onChangeText={setTitle}
            testID="new-trip-title-input"
            style={inputStyle(colors)}
          />
        </Field>

        {/* Destination */}
        <Field label="DESTINATION" colors={colors}>
          <TextInput
            placeholder="Tokyo, Japan"
            placeholderTextColor={colors.placeholder}
            value={destination}
            onChangeText={setDestination}
            testID="new-trip-destination-input"
            style={inputStyle(colors)}
          />
        </Field>

        {/* Dates */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="START" colors={colors}>
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
                value={startsAt}
                onChangeText={setStartsAt}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                testID="new-trip-start-input"
                style={inputStyle(colors)}
              />
              <Text style={{ marginTop: 4, fontSize: 11, color: colors.text, opacity: 0.5 }}>
                {fmt(startsAt)}
              </Text>
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="END" colors={colors}>
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
                value={endsAt}
                onChangeText={setEndsAt}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                testID="new-trip-end-input"
                style={inputStyle(colors)}
              />
              <Text style={{ marginTop: 4, fontSize: 11, color: colors.text, opacity: 0.5 }}>
                {fmt(endsAt)}
              </Text>
            </Field>
          </View>
        </View>

        {/* Travelers */}
        <Field label="TRAVELERS" colors={colors}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => {
                const n = Math.max(1, Number.parseInt(travelers, 10) - 1);
                setTravelers(String(n));
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Decrement travelers"
              testID="travelers-decrement"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.text + '10',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="Minus" size={16} color={colors.text} />
            </Pressable>
            <TextInput
              value={travelers}
              onChangeText={(v) => setTravelers(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              testID="travelers-input"
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 22,
                fontWeight: '800',
                textAlign: 'center',
                paddingVertical: 8,
              }}
            />
            <Pressable
              onPress={() => {
                const n = (Number.parseInt(travelers, 10) || 0) + 1;
                setTravelers(String(n));
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Increment travelers"
              testID="travelers-increment"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: colors.text + '10',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="Plus" size={16} color={colors.text} />
            </Pressable>
          </View>
        </Field>

        {/* Notes */}
        <Field label="NOTES (OPTIONAL)" colors={colors}>
          <TextInput
            placeholder="Anything we shouldn't forget?"
            placeholderTextColor={colors.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
            testID="new-trip-notes-input"
            style={{
              ...inputStyle(colors),
              minHeight: 70,
              textAlignVertical: 'top',
            }}
          />
        </Field>

        {error ? (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              backgroundColor: EMBER + '1c',
            }}>
            <Text style={{ color: EMBER, fontSize: 13, fontWeight: '700' }}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 14,
          paddingTop: 14,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}>
        <Pressable
          onPress={onSubmit}
          disabled={submitting || !canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Save trip"
          testID="new-trip-save-button"
          style={{
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: GOLD,
            alignItems: 'center',
            opacity: submitting || !canSubmit ? 0.5 : 1,
          }}>
          <Text style={{ color: IRON, fontWeight: '800', fontSize: 15 }}>
            {submitting ? 'Saving…' : 'Save trip'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof useThemeColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>{label}</Text>
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useThemeColors>) {
  return {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600' as const,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.text + '08',
    borderWidth: 1,
    borderColor: colors.text + '14',
  };
}
