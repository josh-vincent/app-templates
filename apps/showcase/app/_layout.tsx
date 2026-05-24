import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ThemeProvider, ErrorBoundary } from '@jv/ui';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: '#0d1014' },
                headerTintColor: '#f7f4ef',
                contentStyle: { backgroundColor: '#0d1014' },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'jv showcase' }} />
              <Stack.Screen name="demo/[pkg]/[component]" options={{ title: '' }} />
            </Stack>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
