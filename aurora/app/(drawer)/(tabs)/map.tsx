import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Menu,
  Plus,
  Share2,
  Star,
  Trash2,
} from 'lucide-react-native';

import SkyBackground from '@/components/SkyBackground';
import WeatherIcon from '@/components/WeatherIcon';
import {
  GlassButton,
  GlassIconButton,
  GlassSurface,
  GlassToolbar,
} from '@/components/GlassPrimitives';
import {
  GlassActionSheet,
  GlassAlert,
  useGlassToast,
} from '@/components/GlassOverlays';
import {
  conditionLabel,
  removeLocation,
  setActive,
  useActiveLocation,
  useAuroraState,
  type Location,
} from '@/lib/aurora-data';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const active = useActiveLocation();
  const { locations, activeId } = useAuroraState();
  const nav = useNavigation();
  const hour = new Date().getHours();
  const toast = useGlassToast();
  const [sheetFor, setSheetFor] = useState<Location | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Location | null>(null);

  useEffect(() => {
    nav.setOptions({ headerShown: false });
  }, [nav]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E27' }}>
      <SkyBackground condition={active.current.condition} hour={hour} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 28,
          paddingHorizontal: 20,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <GlassToolbar
          left={
            <GlassIconButton
              accessibilityLabel="Open locations"
              onPress={() => nav.dispatch(DrawerActions.openDrawer())}
              icon={<Menu size={18} color="#FFFFFF" strokeWidth={2.2} />}
            />
          }
          center={
            <View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.4,
                }}>
                CONDITIONS WORLDWIDE
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>
                Compare locations
              </Text>
            </View>
          }
          style={{ marginBottom: 18 }}
        />

        <GlassSurface style={{ marginBottom: 18 }}>
          <View style={{ padding: 18 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.4,
              }}>
              ACTIVE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <View style={{ marginRight: 14 }}>
                <WeatherIcon condition={active.current.condition} size={44} strokeWidth={1.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>
                  {active.name}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{active.region}</Text>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 42, fontWeight: '300' }}>
                {active.current.tempF}°
              </Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 14, flexWrap: 'wrap' }}>
              <MiniStat label="Feels" value={`${active.current.feelsF}°`} />
              <MiniStat label="Humidity" value={`${active.current.humidity}%`} />
              <MiniStat label="Wind" value={`${active.current.windMph} mph`} />
              <MiniStat label="UV" value={`${active.current.uvIndex}`} />
            </View>
          </View>
        </GlassSurface>

        <Text
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.4,
            marginBottom: 10,
            marginLeft: 4,
          }}>
          ALL LOCATIONS
        </Text>

        {locations.map((loc) => (
          <Pressable
            key={loc.id}
            onPress={() => router.push(`/location/${loc.id}`)}
            onLongPress={() => setSheetFor(loc)}
            delayLongPress={350}
            style={{ marginBottom: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`View ${loc.name} forecast. Long press for actions.`}>
            <GlassSurface
              borderColor={
                loc.id === activeId ? 'rgba(123,91,255,0.55)' : 'rgba(255,255,255,0.14)'
              }
              tintColor={loc.id === activeId ? 'rgba(123,91,255,0.18)' : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <WeatherIcon condition={loc.current.condition} size={32} strokeWidth={1.6} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
                    {loc.name}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                    {conditionLabel(loc.current.condition)} · {loc.daily[0].hiF}°/{loc.daily[0].loF}°
                  </Text>
                </View>
                <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '300' }}>
                  {loc.current.tempF}°
                </Text>
                <View style={{ marginLeft: 6 }}>
                  <ChevronRight size={18} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />
                </View>
              </View>
            </GlassSurface>
          </Pressable>
        ))}

        <View style={{ marginTop: 6 }}>
          <GlassButton
            intent="success"
            label="Add location"
            icon={<Plus size={18} color="#06301F" strokeWidth={2.8} />}
            onPress={() => router.push('/add-location')}
          />
        </View>
      </ScrollView>

      <GlassActionSheet
        visible={!!sheetFor}
        title={sheetFor?.name}
        message={sheetFor?.region}
        onClose={() => setSheetFor(null)}
        actions={
          sheetFor
            ? [
                {
                  label: 'Set as active',
                  icon: <Star size={16} color="#FFFFFF" strokeWidth={2.4} />,
                  onPress: () => {
                    setActive(sheetFor.id);
                    toast.show(`${sheetFor.name} is now active`, 'success');
                  },
                },
                {
                  label: 'Share forecast',
                  icon: <Share2 size={16} color="#FFFFFF" strokeWidth={2.2} />,
                  onPress: () => toast.show('Share sheet would open here'),
                },
                {
                  label: 'Remove location',
                  icon: <Trash2 size={16} color="#FF7B9C" strokeWidth={2.4} />,
                  intent: 'danger',
                  onPress: () => setConfirmRemove(sheetFor),
                },
              ]
            : []
        }
      />

      <GlassAlert
        visible={!!confirmRemove}
        title={`Remove ${confirmRemove?.name ?? ''}?`}
        message="This will clear the location's saved forecast. You can re-add it any time."
        primaryLabel="Remove"
        primaryIntent="danger"
        onPrimary={() => {
          if (confirmRemove) {
            removeLocation(confirmRemove.id);
            toast.show(`${confirmRemove.name} removed`, 'danger');
          }
        }}
        onClose={() => setConfirmRemove(null)}
      />
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 64 }}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
        }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '500', marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
