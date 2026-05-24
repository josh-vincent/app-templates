// Push notifications hook.
//
// Mounted once at the root via app/_layout.tsx → <RegisterPushHandler />.
// Responsibilities:
//   1. Show banners while the app is in the foreground.
//   2. On real devices: ask for permission, fetch the Expo push token,
//      register it with Convex (keyed by a stable AsyncStorage installation
//      id so repeat launches reuse the row).
//   3. On notification tap: deep-link to the bet referenced in
//      notification.data.betId, if present.
//
// Defensive lazy-requires so a stale build (or simulator without native
// modules) doesn't crash the JS bundle.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useMutation } from '@/lib/persona-convex';

import { api } from '@/convex/_generated/api';

const INSTALLATION_KEY = 'fitstake.push.installationId';

function tryLoadNotifications() {
  try {
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

function tryLoadDevice() {
  try {
    return require('expo-device') as typeof import('expo-device');
  } catch {
    return null;
  }
}

async function getOrCreateInstallationId(): Promise<string> {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (existing) return existing;
  // RN doesn't have crypto.randomUUID natively; build a v4-ish id.
  const id = `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  await AsyncStorage.setItem(INSTALLATION_KEY, id);
  return id;
}

function projectId(): string | undefined {
  // EAS-injected projectId is the canonical source; fall back to the
  // expo config in dev. May be undefined in bare expo-dev-client builds —
  // expo-notifications can still issue a token in that case.
  return (
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    undefined
  );
}

export function usePushNotifications() {
  const setPushToken = useMutation(api.notifications.setPushToken);

  useEffect(() => {
    const Notifications = tryLoadNotifications();
    if (!Notifications) return;

    // Foreground display behaviour. Show banners; let the OS badge.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    let cancelled = false;

    async function register() {
      const Device = tryLoadDevice();
      // expo-go / simulator can't receive remote pushes; bail quietly.
      if (Device && Device.isDevice === false) return;
      const Notifications = tryLoadNotifications();
      if (!Notifications) return;

      try {
        const settings = await Notifications.getPermissionsAsync();
        let granted =
          settings.granted ||
          settings.ios?.status ===
            Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!granted) {
          const ask = await Notifications.requestPermissionsAsync();
          granted = !!ask.granted;
        }
        if (!granted || cancelled) return;

        const tokenResp = await Notifications.getExpoPushTokenAsync(
          projectId() ? { projectId: projectId()! } : undefined
        );
        const token = tokenResp.data;
        if (!token || cancelled) return;

        const installationId = await getOrCreateInstallationId();
        await setPushToken({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          installationId,
        });
      } catch (e) {
        console.warn('[push] registration failed', e);
      }
    }
    register();

    // Tap handler — deep-link to the bet.
    const tapSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data as
          | { betId?: string }
          | undefined;
        if (data?.betId) {
          router.push(`/(tabs)/challenges/${data.betId}` as any);
        }
      }
    );

    return () => {
      cancelled = true;
      tapSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// Convenience wrapper component so _layout.tsx can mount it as a sibling
// alongside the other root-level effect components.
export function RegisterPushHandler() {
  usePushNotifications();
  return null;
}
