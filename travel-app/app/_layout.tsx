import 'expo-dev-client';
import '../global.css';

import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexReactClient, useConvexAuth } from 'convex/react';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { NativeWindStyleSheet } from 'nativewind';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DevPersonaProvider } from '@/contexts/DevPersonaContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { resolveConvexUrl } from '@/lib/convexUrl';

import { RegisterPushHandler } from './hooks/usePushNotifications';
import useThemedNavigation from './hooks/useThemedNavigation';

NativeWindStyleSheet.setOutput({ default: 'native' });

const convexUrl = resolveConvexUrl();
if (convexUrl && __DEV__) {
  console.log(`[convex] using ${convexUrl}`);
}
const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

// Auto-anonymous sign-in so the app skips the sign-in screen in dev.
function AutoAnonymousSignIn() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      signIn('anonymous').catch((e) => console.warn('[auto-signin] failed', e));
    }
  }, [isLoading, isAuthenticated, signIn]);
  return null;
}

function ThemedStack() {
  const { ThemedStatusBar, screenOptions } = useThemedNavigation();
  return (
    <>
      <ThemedStatusBar />
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip/[id]"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="trip/new"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="place/new"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const tree = (
    <GestureHandlerRootView
      className={`bg-light-primary dark:bg-dark-primary ${Platform.OS === 'ios' ? 'pb-0 ' : ''}`}
      style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <DevPersonaProvider>
              <ThemedStack />
            </DevPersonaProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );

  if (!convex) return tree;

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <AutoAnonymousSignIn />
      <RegisterPushHandler />
      {tree}
    </ConvexAuthProvider>
  );
}
