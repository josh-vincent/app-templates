import { router } from 'expo-router';
import React, { useState } from 'react';
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
import { EMBER, IRON, SKY } from '@/lib/theme';

const PAGE_X = 20;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };
const EMOJIS = ['📍', '🏝️', '🏔️', '🌃', '🏛️', '🍜', '☕', '🛍️', '🎨'];

export default function NewPlaceScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const savePlace = useMutation(api.places.savePlace);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [note, setNote] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Place needs a name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await savePlace({
        name: name.trim(),
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        note: note.trim() || undefined,
        emoji,
      });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that place.');
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
          testID="new-place-close-button">
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
          Save a Place
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled">
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>ICON</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 10, marginHorizontal: -PAGE_X }}
          contentContainerStyle={{ paddingHorizontal: PAGE_X, gap: 10 }}>
          {EMOJIS.map((e) => {
            const selected = e === emoji;
            return (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? SKY : colors.text + '08',
                  borderWidth: selected ? 0 : 1,
                  borderColor: colors.text + '14',
                }}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ marginTop: 18 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>NAME</Text>
          <TextInput
            placeholder="Senso-ji Temple"
            placeholderTextColor={colors.placeholder}
            value={name}
            onChangeText={setName}
            testID="new-place-name-input"
            style={{
              marginTop: 6,
              color: colors.text,
              fontSize: 16,
              fontWeight: '600',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.text + '08',
              borderWidth: 1,
              borderColor: colors.text + '14',
            }}
          />
        </View>

        <View style={{ marginTop: 18, flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>CITY</Text>
            <TextInput
              placeholder="Tokyo"
              placeholderTextColor={colors.placeholder}
              value={city}
              onChangeText={setCity}
              style={{
                marginTop: 6,
                color: colors.text,
                fontSize: 14,
                fontWeight: '600',
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.text + '08',
                borderWidth: 1,
                borderColor: colors.text + '14',
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>COUNTRY</Text>
            <TextInput
              placeholder="Japan"
              placeholderTextColor={colors.placeholder}
              value={country}
              onChangeText={setCountry}
              style={{
                marginTop: 6,
                color: colors.text,
                fontSize: 14,
                fontWeight: '600',
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: colors.text + '08',
                borderWidth: 1,
                borderColor: colors.text + '14',
              }}
            />
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>NOTE</Text>
          <TextInput
            placeholder="Why this one?"
            placeholderTextColor={colors.placeholder}
            value={note}
            onChangeText={setNote}
            multiline
            style={{
              marginTop: 6,
              color: colors.text,
              fontSize: 14,
              fontWeight: '500',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.text + '08',
              borderWidth: 1,
              borderColor: colors.text + '14',
              minHeight: 70,
              textAlignVertical: 'top',
            }}
          />
        </View>

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
          disabled={submitting || !name.trim()}
          testID="new-place-save-button"
          style={{
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: SKY,
            alignItems: 'center',
            opacity: submitting || !name.trim() ? 0.5 : 1,
          }}>
          <Text style={{ color: IRON, fontWeight: '800', fontSize: 15 }}>
            {submitting ? 'Saving…' : 'Save place'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
