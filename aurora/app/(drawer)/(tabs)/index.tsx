import { router, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Droplets,
  Eye,
  Menu,
  Sun,
  TriangleAlert,
  Wind,
} from 'lucide-react-native';

import SkyBackground from '@/components/SkyBackground';
import WeatherIcon, { WeatherIconHero } from '@/components/WeatherIcon';
import {
  GlassIconButton,
  GlassSurface,
  GlassToolbar,
} from '@/components/GlassPrimitives';
import {
  conditionLabel,
  formatHour,
  useActiveLocation,
} from '@/lib/aurora-data';

const AURORA = '#0BF6A0';
const PINK = '#FF7B9C';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const loc = useActiveLocation();
  const nav = useNavigation();
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
          // Modest padding so the last card slides *under* the Liquid Glass
          // tab bar — iOS auto-inset handles the safe stopping point.
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
                {loc.region.toUpperCase()}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700' }}>
                {loc.name}
              </Text>
            </View>
          }
          style={{ marginBottom: 20 }}
        />

        <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 28 }}>
          <WeatherIconHero condition={loc.current.condition} size={108} />
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 104,
              fontWeight: '300',
              marginTop: 6,
              lineHeight: 108,
              letterSpacing: -2,
              textShadowColor: 'rgba(0,0,0,0.22)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 14,
            }}>
            {loc.current.tempF}°
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: 19,
              fontWeight: '500',
              marginTop: -2,
            }}>
            {conditionLabel(loc.current.condition)}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 6 }}>
            Feels like {loc.current.feelsF}° · H {loc.daily[0].hiF}° L {loc.daily[0].loF}°
          </Text>
        </View>

        {loc.alerts.length > 0 && (
          <GlassSurface
            tintColor="rgba(255,123,156,0.20)"
            borderColor="rgba(255,123,156,0.55)"
            style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(255,123,156,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                <TriangleAlert size={18} color={PINK} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: PINK,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}>
                  WEATHER ALERT
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '500', marginTop: 2 }}>
                  {loc.alerts[0].title}
                </Text>
              </View>
            </View>
          </GlassSurface>
        )}

        <GlassSurface style={{ marginBottom: 16 }}>
          <View style={{ padding: 16 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.4,
                marginBottom: 12,
              }}>
              NEXT 24 HOURS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {loc.hourly.slice(0, 24).map((h) => {
                const isNow = h.hour === hour;
                return (
                  <View
                    key={h.hour}
                    style={{
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      minWidth: 64,
                      borderRadius: 14,
                      backgroundColor: isNow ? 'rgba(123,91,255,0.28)' : 'transparent',
                    }}>
                    <Text
                      style={{
                        color: isNow ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                        fontSize: 12,
                        fontWeight: isNow ? '700' : '500',
                      }}>
                      {isNow ? 'Now' : formatHour(h.hour)}
                    </Text>
                    <View style={{ marginTop: 8 }}>
                      <WeatherIcon condition={h.condition} size={26} />
                    </View>
                    <Text
                      style={{
                        color: h.precipPct >= 30 ? '#7BB3F0' : 'transparent',
                        fontSize: 10,
                        fontWeight: '600',
                        marginTop: 4,
                        minHeight: 12,
                      }}>
                      {h.precipPct >= 30 ? `${h.precipPct}%` : '·'}
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600', marginTop: 4 }}>
                      {h.tempF}°
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </GlassSurface>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <Stat label="HUMIDITY" value={`${loc.current.humidity}%`} Icon={Droplets} />
          <Stat
            label="WIND"
            value={`${loc.current.windMph} mph`}
            sub={loc.current.windDir}
            Icon={Wind}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <Stat
            label="UV INDEX"
            value={`${loc.current.uvIndex}`}
            sub={uvSeverity(loc.current.uvIndex)}
            Icon={Sun}
          />
          <Stat label="VISIBILITY" value={`${loc.current.visibilityMi} mi`} Icon={Eye} />
        </View>

        <GlassSurface style={{ marginBottom: 16 }}>
          <View style={{ padding: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.4,
                }}>
                7-DAY FORECAST
              </Text>
              <Text
                onPress={() => router.push('/(drawer)/(tabs)/hourly')}
                style={{ color: AURORA, fontSize: 12, fontWeight: '600' }}>
                See all →
              </Text>
            </View>
            {loc.daily.map((d, i) => (
              <View
                key={d.date}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: 'rgba(255,255,255,0.10)',
                }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500', width: 64 }}>
                  {d.weekday}
                </Text>
                <View style={{ width: 40, alignItems: 'center' }}>
                  <WeatherIcon condition={d.condition} size={22} />
                </View>
                {d.precipPct >= 30 ? (
                  <Text style={{ color: '#7BB3F0', fontSize: 12, width: 44 }}>{d.precipPct}%</Text>
                ) : (
                  <View style={{ width: 44 }} />
                )}
                <View style={{ flex: 1 }} />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: 15,
                    width: 36,
                    textAlign: 'right',
                  }}>
                  {d.loF}°
                </Text>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: '600',
                    width: 36,
                    textAlign: 'right',
                  }}>
                  {d.hiF}°
                </Text>
              </View>
            ))}
          </View>
        </GlassSurface>

        <GlassSurface>
          <View style={{ padding: 16 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.4,
                marginBottom: 12,
              }}>
              SUN & PRESSURE
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SunRow label="Sunrise" value={loc.current.sunriseHHMM} />
              <SunRow label="Sunset" value={loc.current.sunsetHHMM} />
              <SunRow label="Pressure" value={`${loc.current.pressureMb}`} sub="mb" />
            </View>
          </View>
        </GlassSurface>
      </ScrollView>
    </View>
  );
}

function Stat({
  label,
  value,
  sub,
  Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}) {
  return (
    <GlassSurface style={{ flex: 1 }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Icon size={14} color="rgba(255,255,255,0.65)" strokeWidth={2.2} />
          <Text
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.3,
              marginLeft: 6,
            }}>
            {label}
          </Text>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '300' }}>{value}</Text>
        {sub && (
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2 }}>
            {sub}
          </Text>
        )}
      </View>
    </GlassSurface>
  );
}

function SunRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>{label}</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '500', marginTop: 4 }}>
        {value}
        {sub ? (
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}> {sub}</Text>
        ) : null}
      </Text>
    </View>
  );
}

function uvSeverity(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'Very high';
  return 'Extreme';
}
