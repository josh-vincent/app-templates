import Drawer from 'expo-router/drawer';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Plus } from 'lucide-react-native';

import WeatherIcon from '@/components/WeatherIcon';
import { GlassButton, GlassSurface } from '@/components/GlassPrimitives';
import { setActive, useAuroraState } from '@/lib/aurora-data';

function LocationsDrawer({ navigation }: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { locations, activeId } = useAuroraState();

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0E27', paddingTop: insets.top + 16 }}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <Text
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.4,
          }}>
          AURORA
        </Text>
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 2 }}>
          Locations
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}>
        {locations.map((loc) => {
          const isActive = loc.id === activeId;
          return (
            <Pressable
              key={loc.id}
              onPress={() => {
                setActive(loc.id);
                navigation.closeDrawer();
              }}
              style={{ marginBottom: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${loc.name}`}>
              <GlassSurface
                radius={18}
                tintColor={isActive ? 'rgba(123,91,255,0.30)' : undefined}
                borderColor={isActive ? 'rgba(123,91,255,0.55)' : 'rgba(255,255,255,0.10)'}>
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  <View style={{ width: 36, alignItems: 'center', marginRight: 10 }}>
                    <WeatherIcon condition={loc.current.condition} size={26} strokeWidth={1.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                      {loc.name}
                    </Text>
                    <Text
                      style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                      {loc.region}
                    </Text>
                  </View>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '300' }}>
                    {loc.current.tempF}°
                  </Text>
                </View>
              </GlassSurface>
            </Pressable>
          );
        })}

        <View style={{ marginTop: 12 }}>
          <GlassButton
            intent="success"
            label="Add location"
            icon={<Plus size={18} color="#06301F" strokeWidth={2.8} />}
            onPress={() => {
              navigation.closeDrawer();
              setTimeout(() => router.push('/add-location'), 220);
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <LocationsDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { backgroundColor: '#0A0E27', width: 320 },
        drawerType: 'slide',
        swipeEdgeWidth: 60,
      }}>
      <Drawer.Screen name="(tabs)" />
    </Drawer>
  );
}
