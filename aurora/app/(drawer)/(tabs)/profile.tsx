import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Cloud,
  Code,
  Layers,
  Menu,
  Sparkles,
  Sun,
  Sunrise,
  TriangleAlert,
} from 'lucide-react-native';

import SkyBackground from '@/components/SkyBackground';
import { GlassIconButton, GlassSurface, GlassToolbar } from '@/components/GlassPrimitives';
import { useActiveLocation, useAuroraState } from '@/lib/aurora-data';

const ACCENT = '#7B5BFF';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const active = useActiveLocation();
  const { locations } = useAuroraState();
  const nav = useNavigation();
  const [units, setUnits] = useState<'F' | 'C'>('F');
  const [alerts, setAlerts] = useState(true);
  const [precision, setPrecision] = useState(true);
  const hour = new Date().getHours();

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
                PROFILE
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>
                Preferences
              </Text>
            </View>
          }
          style={{ marginBottom: 18 }}
        />

        <GlassSurface style={{ marginBottom: 18 }}>
          <View style={{ alignItems: 'center', padding: 22 }}>
            <View
              style={{
                width: 78,
                height: 78,
                borderRadius: 39,
                backgroundColor: 'rgba(123,91,255,0.25)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: 'rgba(123,91,255,0.6)',
              }}>
              <Sunrise size={36} color="#FFD15C" strokeWidth={1.6} />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 12 }}>
              Aurora demo
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>
              {locations.length} location{locations.length === 1 ? '' : 's'} saved · mock data mode
            </Text>
          </View>
        </GlassSurface>

        <Section title="UNITS">
          <GlassSurface>
            <View style={{ flexDirection: 'row' }}>
              <UnitPill
                label="Fahrenheit"
                sub="°F"
                selected={units === 'F'}
                onPress={() => setUnits('F')}
              />
              <View
                style={{
                  width: StyleSheet.hairlineWidth,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              />
              <UnitPill
                label="Celsius"
                sub="°C"
                selected={units === 'C'}
                onPress={() => setUnits('C')}
              />
            </View>
          </GlassSurface>
        </Section>

        <Section title="NOTIFICATIONS">
          <GlassSurface>
            <Row
              Icon={TriangleAlert}
              label="Weather alerts"
              sub="Storms, wind, heat"
              trailing={
                <Switch
                  value={alerts}
                  onValueChange={setAlerts}
                  trackColor={{ false: 'rgba(255,255,255,0.18)', true: ACCENT }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="rgba(255,255,255,0.18)"
                />
              }
            />
            <Row
              Icon={Sparkles}
              label="Daily summary"
              sub="One push at 7am"
              trailing={
                <Switch
                  value={precision}
                  onValueChange={setPrecision}
                  trackColor={{ false: 'rgba(255,255,255,0.18)', true: ACCENT }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="rgba(255,255,255,0.18)"
                />
              }
              last
            />
          </GlassSurface>
        </Section>

        <Section title="DEVELOPER">
          <GlassSurface>
            <Pressable
              onPress={() => router.push('/overlays')}
              accessibilityRole="button"
              accessibilityLabel="Open glass overlays showcase">
              <Row
                Icon={Layers}
                label="Glass overlays"
                sub="Sheets, drawers, alerts, toasts, popover"
                trailing={<ChevronRight size={18} color="rgba(255,255,255,0.45)" strokeWidth={2.2} />}
                last
              />
            </Pressable>
          </GlassSurface>
        </Section>

        <Section title="ABOUT">
          <GlassSurface>
            <Row Icon={Cloud} label="Aurora" sub="A glass-first weather demo" />
            <Row Icon={Code} label="Version" sub="0.1.0 · mock data only" />
            <Row Icon={Sun} label="Status" sub="Liquid Glass active on iOS 26+" last />
          </GlassSurface>
        </Section>

        <Text
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 11,
            marginTop: 24,
            textAlign: 'center',
          }}>
          Aurora v0.1 · all forecasts simulated
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1.4,
          marginLeft: 4,
          marginBottom: 8,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function UnitPill({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} units`}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: selected ? 'rgba(123,91,255,0.28)' : 'transparent',
      }}>
      <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '600' }}>{sub}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );
}

function Row({
  Icon,
  label,
  sub,
  trailing,
  last,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
      }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
        <Icon size={16} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {sub && (
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{sub}</Text>
        )}
      </View>
      {trailing}
    </View>
  );
}
