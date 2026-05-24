import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu } from 'lucide-react-native';

import SkyBackground from '@/components/SkyBackground';
import WeatherIcon from '@/components/WeatherIcon';
import { GlassIconButton, GlassSurface, GlassToolbar } from '@/components/GlassPrimitives';
import {
  conditionLabel,
  formatHour,
  useActiveLocation,
} from '@/lib/aurora-data';

export default function HourlyScreen() {
  const insets = useSafeAreaInsets();
  const loc = useActiveLocation();
  const nav = useNavigation();
  const [tabIdx, setTabIdx] = useState(0); // 0 = hourly, 1 = daily
  const now = new Date();
  const hour = now.getHours();

  useEffect(() => {
    nav.setOptions({ headerShown: false });
  }, [nav]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E27' }}>
      <SkyBackground condition={loc.current.condition} hour={hour} />

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
                FORECAST
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }} numberOfLines={1}>
                {loc.name}
              </Text>
            </View>
          }
          style={{ marginBottom: 18 }}
        />

        <GlassSurface radius={12} style={{ marginBottom: 18, padding: 4 }}>
          <SegmentedControl
            values={['Hourly', 'Daily']}
            selectedIndex={tabIdx}
            onChange={(e) => setTabIdx(e.nativeEvent.selectedSegmentIndex)}
            appearance="dark"
            tintColor="rgba(123,91,255,0.65)"
            backgroundColor="transparent"
            fontStyle={{ color: 'rgba(255,255,255,0.75)', fontWeight: '600' }}
            activeFontStyle={{ color: '#FFFFFF', fontWeight: '700' }}
            style={{ height: 36 }}
          />
        </GlassSurface>

        {tabIdx === 0 ? <HourlyList /> : <DailyList />}
      </ScrollView>
    </View>
  );
}

function HourlyList() {
  const loc = useActiveLocation();
  const hour = new Date().getHours();
  return (
    <GlassSurface>
      <View style={{ padding: 12 }}>
        {loc.hourly.map((h, i) => {
          const isNow = h.hour === hour;
          return (
            <View
              key={h.hour}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: 'rgba(255,255,255,0.10)',
              }}>
              <Text
                style={{
                  color: isNow ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                  fontSize: 14,
                  fontWeight: isNow ? '700' : '500',
                  width: 64,
                }}>
                {isNow ? 'Now' : formatHour(h.hour)}
              </Text>
              <View style={{ width: 40, alignItems: 'center' }}>
                <WeatherIcon condition={h.condition} size={22} />
              </View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 13,
                  marginLeft: 10,
                  flex: 1,
                }}
                numberOfLines={1}>
                {conditionLabel(h.condition)}
              </Text>
              {h.precipPct >= 20 ? (
                <Text
                  style={{
                    color: '#7BB3F0',
                    fontSize: 12,
                    width: 44,
                    textAlign: 'right',
                  }}>
                  {h.precipPct}%
                </Text>
              ) : (
                <View style={{ width: 44 }} />
              )}
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '600',
                  width: 44,
                  textAlign: 'right',
                }}>
                {h.tempF}°
              </Text>
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

function DailyList() {
  const loc = useActiveLocation();
  return (
    <GlassSurface>
      <View style={{ padding: 12 }}>
        {loc.daily.map((d, i) => (
          <View
            key={d.date}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              paddingHorizontal: 10,
              borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(255,255,255,0.10)',
            }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', width: 74 }}>
              {d.weekday}
            </Text>
            <View style={{ width: 44, alignItems: 'center' }}>
              <WeatherIcon condition={d.condition} size={24} />
            </View>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                marginLeft: 8,
                flex: 1,
              }}
              numberOfLines={1}>
              {conditionLabel(d.condition)}
            </Text>
            {d.precipPct >= 20 ? (
              <Text
                style={{
                  color: '#7BB3F0',
                  fontSize: 12,
                  width: 44,
                  textAlign: 'right',
                }}>
                {d.precipPct}%
              </Text>
            ) : (
              <View style={{ width: 44 }} />
            )}
            <Text
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 15,
                width: 40,
                textAlign: 'right',
              }}>
              {d.loF}°
            </Text>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '600',
                width: 40,
                textAlign: 'right',
              }}>
              {d.hiF}°
            </Text>
          </View>
        ))}
      </View>
    </GlassSurface>
  );
}
