import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';

import WeatherIcon from '@/components/WeatherIcon';
import { GlassButton, GlassSurface } from '@/components/GlassPrimitives';
import { useGlassToast } from '@/components/GlassOverlays';
import { addLocation, type Condition } from '@/lib/aurora-data';

const PRESETS: { name: string; region: string; condition: Condition }[] = [
  { name: 'London', region: 'United Kingdom', condition: 'fog' },
  { name: 'Reykjavík', region: 'Iceland', condition: 'snow' },
  { name: 'Cape Town', region: 'South Africa', condition: 'partly-cloudy' },
  { name: 'Singapore', region: 'Singapore', condition: 'rain' },
  { name: 'Rio de Janeiro', region: 'Brazil', condition: 'clear-day' },
  { name: 'Vancouver', region: 'Canada', condition: 'cloudy' },
];

export default function AddLocationModal() {
  const insets = useSafeAreaInsets();
  const toast = useGlassToast();
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');

  const canSave = name.trim().length >= 2;

  const handleSave = () => {
    if (!canSave) return;
    addLocation(name, region);
    toast.show(`${name.trim()} added`, 'success');
    router.back();
  };

  const handlePreset = (preset: { name: string; region: string }) => {
    addLocation(preset.name, preset.region);
    toast.show(`${preset.name} added`, 'success');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E27' }}>
      <LinearGradient
        colors={['#1A1B4B', '#0A0E27']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 80,
        }}
        keyboardShouldPersistTaps="handled">
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 18 }}>
          Track conditions for any place. Data here is simulated.
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.4,
            marginBottom: 8,
          }}>
          NAME
        </Text>
        <GlassSurface radius={14} style={{ marginBottom: 14 }}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Kyoto"
            placeholderTextColor="rgba(255,255,255,0.35)"
            autoFocus
            style={{
              paddingHorizontal: 14,
              paddingVertical: 14,
              color: '#FFFFFF',
              fontSize: 16,
            }}
          />
        </GlassSurface>

        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.4,
            marginBottom: 8,
          }}>
          REGION (OPTIONAL)
        </Text>
        <GlassSurface radius={14} style={{ marginBottom: 22 }}>
          <TextInput
            value={region}
            onChangeText={setRegion}
            placeholder="e.g. Japan"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 14,
              color: '#FFFFFF',
              fontSize: 16,
            }}
          />
        </GlassSurface>

        <GlassButton
          intent={canSave ? 'accent' : 'neutral'}
          label="Save location"
          onPress={handleSave}
          disabled={!canSave}
          accessibilityLabel="Save location"
          style={{ marginBottom: 24 }}
        />

        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.4,
            marginBottom: 10,
            marginLeft: 4,
          }}>
          QUICK PICK
        </Text>
        {PRESETS.map((p) => (
          <Pressable
            key={p.name}
            onPress={() => handlePreset(p)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.name}`}
            style={{ marginBottom: 8 }}>
            <GlassSurface radius={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                <View style={{ width: 36, alignItems: 'center', marginRight: 10 }}>
                  <WeatherIcon condition={p.condition} size={24} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                    {p.name}
                  </Text>
                  <Text
                    style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                    {p.region}
                  </Text>
                </View>
                <Plus size={18} color="#0BF6A0" strokeWidth={2.4} />
              </View>
            </GlassSurface>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
