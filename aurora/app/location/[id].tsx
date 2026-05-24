import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, Trash2 } from 'lucide-react-native';

import SkyBackground from '@/components/SkyBackground';
import WeatherIcon, { WeatherIconHero } from '@/components/WeatherIcon';
import { GlassButton, GlassSurface } from '@/components/GlassPrimitives';
import { GlassAlert, useGlassToast } from '@/components/GlassOverlays';
import {
  conditionLabel,
  formatHour,
  removeLocation,
  setActive,
  useLocationById,
} from '@/lib/aurora-data';

export default function LocationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const loc = useLocationById(id);
  const nav = useNavigation();
  const hour = new Date().getHours();
  const toast = useGlassToast();
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (loc) nav.setOptions({ title: loc.name });
  }, [loc, nav]);

  if (!loc) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0E27' }}>
        <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Location not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E27' }}>
      <SkyBackground condition={loc.current.condition} hour={hour} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1.4,
          }}>
          {loc.region.toUpperCase()}
        </Text>
        <Text
          style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '700', marginTop: 4 }}>
          {loc.name}
        </Text>

        <View style={{ alignItems: 'center', marginVertical: 28 }}>
          <WeatherIconHero condition={loc.current.condition} size={108} />
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 96,
              fontWeight: '300',
              marginTop: 6,
              lineHeight: 100,
              letterSpacing: -2,
              textShadowColor: 'rgba(0,0,0,0.22)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 14,
            }}>
            {loc.current.tempF}°
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: 19, fontWeight: '500' }}>
            {conditionLabel(loc.current.condition)}
          </Text>
        </View>

        <GlassSurface style={{ marginBottom: 16 }}>
          <View style={{ padding: 14 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.4,
                marginBottom: 10,
              }}>
              NEXT 12 HOURS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {loc.hourly.slice(0, 12).map((h) => (
                <View key={h.hour} style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>
                    {h.hour === hour ? 'Now' : formatHour(h.hour)}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <WeatherIcon condition={h.condition} size={22} />
                  </View>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                      marginTop: 6,
                    }}>
                    {h.tempF}°
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </GlassSurface>

        <View style={{ gap: 10 }}>
          <GlassButton
            intent="success"
            label="Set as active"
            icon={<Star size={18} color="#06301F" strokeWidth={2.4} fill="#06301F" />}
            onPress={() => {
              setActive(loc.id);
              toast.show(`${loc.name} is now active`, 'success');
              router.back();
            }}
          />
          <GlassButton
            intent="danger"
            label="Remove location"
            icon={<Trash2 size={18} color="#FFFFFF" strokeWidth={2.4} />}
            onPress={() => setConfirmRemove(true)}
          />
        </View>
      </ScrollView>

      <GlassAlert
        visible={confirmRemove}
        title={`Remove ${loc.name}?`}
        message="This will clear the saved forecast for this location. You can re-add it any time."
        primaryLabel="Remove"
        primaryIntent="danger"
        onPrimary={() => {
          const name = loc.name;
          removeLocation(loc.id);
          toast.show(`${name} removed`, 'danger');
          router.back();
        }}
        onClose={() => setConfirmRemove(false)}
      />
    </View>
  );
}
