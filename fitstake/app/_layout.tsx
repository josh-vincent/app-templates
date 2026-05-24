import 'expo-dev-client';
import '../global.css';

import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConvexReactClient, useConvexAuth } from 'convex/react';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { NativeWindStyleSheet } from 'nativewind';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ReactNativeGrabGate, ReactNativeGrabScreenGate } from '@/components/dev/ReactNativeGrabGate';
import { ErrorBoundary } from '@jv/ui';
import CelebrationsHost from '@/components/modals/CelebrationsHost';
import { RevenueCatProvider } from '@/components/RevenueCatProvider';
import { DevPersonaProvider } from '@/contexts/DevPersonaContext';
import { ThemeProvider } from '@jv/ui';
import { CelebrationsProvider } from '@/lib/celebrations';
import { resolveConvexUrl } from '@/lib/convexUrl';
// Side-effect import: registers the TaskManager background-location task at
// module load. Must be top-level so iOS/Android know about it before the OS
// invokes the headless task.
import { reconcileTracking } from '@/lib/locationTracking';

import { BackgroundStepObserverHost } from './hooks/useBackgroundStepObserver';
import { RegisterPushHandler } from './hooks/usePushNotifications';
import { StepSubmitterHost } from './hooks/useStepSubmitter';
import useThemedNavigation from './hooks/useThemedNavigation';
import { WidgetSnapshotHost } from './hooks/useWidgetSnapshot';

NativeWindStyleSheet.setOutput({ default: 'native' });

// Resolve at module-load. `resolveConvexUrl` rewrites a 127.0.0.1 URL to the
// LAN host Metro served the bundle from, so the same .env.local works for
// localhost sims AND LAN devices without a config change.
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

// Auto sign-in anonymously so the app skips the sign-in screen in dev.
// Users can still upgrade to Apple sign-in from Profile.
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

// On every app mount: prune expired bets from the tracking set, restart the
// background location task if anything is still active, and flush queued
// pings. Idempotent and safe.
function ReconcileTracking() {
  useEffect(() => {
    reconcileTracking().catch((e) => console.warn('[tracking] reconcile failed', e));
  }, []);
  return null;
}

function ThemedStack() {
  const { ThemedStatusBar, screenOptions } = useThemedNavigation();
  return (
    <ReactNativeGrabScreenGate id="root-stack">
      <ThemedStatusBar />
      <Stack screenOptions={screenOptions}>
        {/* Deep secondary surfaces are presented as full-screen modals so the
            primary tab stack never has to nest more than one level. */}
        <Stack.Screen
          name="friends"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="notifications"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
      </Stack>
    </ReactNativeGrabScreenGate>
  );
}

export default function RootLayout() {
  const tree = (
    <GestureHandlerRootView
      className={`bg-light-primary dark:bg-dark-primary ${Platform.OS === 'ios' ? 'pb-0 ' : ''}`}
      style={{ flex: 1 }}>
      <ErrorBoundary>
        <ReactNativeGrabGate>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <DevPersonaProvider>
                <RevenueCatProvider>
                <CelebrationsProvider>
                  {/* StepSubmitterHost depends on useHealthSteps which uses
                      react-query, so it must live inside QueryClientProvider. */}
                  <StepSubmitterHost />
                  {/* iOS background HealthKit observer — invalidates the steps
                      cache when HealthKit pushes a new sample. */}
                  <BackgroundStepObserverHost />
                  {/* Pumps the widget/Live-Activity/Watch shared snapshot. */}
                  <WidgetSnapshotHost />
                  <ThemedStack />
                  <CelebrationsHost />
                </CelebrationsProvider>
                </RevenueCatProvider>
              </DevPersonaProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ReactNativeGrabGate>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );

  if (!convex) {
    // Convex URL not set — render the app shell without backend. Queries will
    // return undefined; screens already handle that.
    return tree;
  }

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <AutoAnonymousSignIn />
      <ReconcileTracking />
      <RegisterPushHandler />
      {tree}
    </ConvexAuthProvider>
  );
}
