import 'expo-dev-client';
import '../global.css';
import '@/lib/glass-probe';

import { Stack } from 'expo-router';
import { NativeWindStyleSheet } from 'nativewind';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlassToastProvider } from '@/components/GlassOverlays';
import { ThemeProvider } from '@/contexts/ThemeContext';

NativeWindStyleSheet.setOutput({ default: 'native' });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0E27' }}>
      <ErrorBoundary>
        <ThemeProvider>
          <GlassToastProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                headerTransparent: true,
                headerLargeTitle: true,
                headerLargeTitleShadowVisible: false,
                headerBlurEffect: 'systemUltraThinMaterialDark',
                headerStyle: { backgroundColor: 'transparent' },
                headerTintColor: '#FFFFFF',
                headerLargeTitleStyle: { color: '#FFFFFF' },
                contentStyle: { backgroundColor: '#0A0E27' },
              }}>
              <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
              <Stack.Screen
                name="add-location"
                options={{
                  presentation: 'formSheet',
                  sheetGrabberVisible: true,
                  sheetAllowedDetents: [0.55, 1],
                  sheetCornerRadius: 28,
                  headerShown: true,
                  headerTitle: 'Add location',
                  headerLargeTitle: false,
                }}
              />
              <Stack.Screen
                name="overlays"
                options={{
                  headerShown: true,
                  headerTitle: 'Glass overlays',
                  headerBackTitle: 'Profile',
                  headerLargeTitle: false,
                }}
              />
              <Stack.Screen
                name="location/[id]"
                options={{
                  headerShown: true,
                  headerTitle: '',
                  headerBackTitle: 'Aurora',
                  headerLargeTitle: false,
                }}
              />
            </Stack>
          </GlassToastProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
