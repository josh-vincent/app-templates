import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppleMaps, requestPermissionsAsync as requestMapPermissionsAsync } from 'expo-maps';
import * as Notifications from 'expo-notifications';
import { type ReactNode, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import Header from '@/components/Header';
import Icon from '@/components/Icon';
import { BRICK, INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import TripStatusWidget from '@/widgets/TripStatusWidget';

const TOKYO = { latitude: 35.6764, longitude: 139.65 };

function formatBiometricTypes(types: LocalAuthentication.AuthenticationType[]) {
  if (types.length === 0) return 'none';
  return types
    .map((type) => {
      if (type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'Face ID';
      if (type === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'Touch ID';
      if (type === LocalAuthentication.AuthenticationType.IRIS) return 'Iris';
      return 'Unknown';
    })
    .join(', ');
}

export default function NativeFeaturesScreen() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;

  const [pushStatus, setPushStatus] = useState('Not requested yet');
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [biometricsStatus, setBiometricsStatus] = useState('Not checked yet');
  const [mapStatus, setMapStatus] = useState('Not requested yet');
  const [widgetStatus, setWidgetStatus] = useState('Not updated yet');

  const mapMarkers = useMemo<AppleMaps.Marker[]>(
    () => [
      {
        id: 'tokyo',
        coordinates: TOKYO,
        title: 'Tokyo',
        systemImage: 'airplane.departure',
      },
    ],
    []
  );

  const handlePushRegistration = async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      let finalStatus = current.status;
      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      setPushStatus(finalStatus);
      if (finalStatus !== 'granted') {
        setPushToken(null);
        return;
      }

      if (!projectId) {
        throw new Error('EAS project ID is missing from app config.');
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      setPushToken(token.data);
    } catch (error: any) {
      setPushStatus(error?.message ?? 'Failed to register for push notifications');
      setPushToken(null);
    }
  };

  const handleBiometricCheck = async () => {
    try {
      const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      setBiometricsStatus(
        `hardware: ${hasHardware ? 'yes' : 'no'} / enrolled: ${
          isEnrolled ? 'yes' : 'no'
        } / types: ${formatBiometricTypes(supportedTypes)}`
      );
    } catch (error: any) {
      setBiometricsStatus(error?.message ?? 'Biometric check failed');
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Voyage',
        cancelLabel: 'Cancel',
      });

      setBiometricsStatus(
        result.success
          ? 'Biometric authentication succeeded'
          : `Authentication failed: ${result.error ?? 'unknown'}`
      );
    } catch (error: any) {
      setBiometricsStatus(error?.message ?? 'Biometric authentication failed');
    }
  };

  const handleMapPermission = async () => {
    try {
      const result = await requestMapPermissionsAsync();
      setMapStatus(result.status);
    } catch (error: any) {
      setMapStatus(error?.message ?? 'Map permission request failed');
    }
  };

  const handleWidgetUpdate = () => {
    TripStatusWidget.updateSnapshot({
      eyebrow: 'Next trip',
      title: 'Tokyo escape',
      subtitle: 'Boarding in 2 hours',
      footer: `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });
    setWidgetStatus('Trip Status widget snapshot updated');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
      <Header showBackButton />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 64, gap: 10 }}
        showsVerticalScrollIndicator={false}>
        <View className="pb-4">
          <Text style={{ color: INK, fontFamily: SERIF, fontSize: 32, letterSpacing: -0.35 }}>
            Native features
          </Text>
          <Text
            className="mt-2"
            style={{
              color: INK,
              fontSize: 13,
              fontStyle: 'italic',
              lineHeight: 19,
              opacity: 0.62,
            }}>
            Validate native modules before the first App Store build.
          </Text>
        </View>

        <FeatureCard title="Notifications" status={`Status: ${pushStatus}`}>
          <Text style={bodyText}>Token: {pushToken ?? 'Not available yet'}</Text>
          <VoyageAction label="Register for push notifications" onPress={handlePushRegistration} />
        </FeatureCard>

        <FeatureCard title="Biometrics" status={biometricsStatus}>
          <View className="flex-row gap-2">
            <VoyageAction label="Check availability" onPress={handleBiometricCheck} tone="light" />
            <VoyageAction label="Authenticate" onPress={handleBiometricAuth} />
          </View>
        </FeatureCard>

        <FeatureCard title="Maps" status={`Location permission: ${mapStatus}`}>
          <VoyageAction
            label="Request map location access"
            onPress={handleMapPermission}
            tone="light"
          />
          <AppleMaps.View
            style={{ height: 220, borderRadius: 24, overflow: 'hidden' }}
            cameraPosition={{ coordinates: TOKYO, zoom: 11 }}
            markers={mapMarkers}
            properties={{ selectionEnabled: true }}
            uiSettings={{
              compassEnabled: true,
              scaleBarEnabled: true,
              myLocationButtonEnabled: true,
            }}
          />
        </FeatureCard>

        <FeatureCard title="Widgets" status={widgetStatus}>
          <Text style={bodyText}>
            On iOS, add the Trip Status widget from the Home Screen widget gallery after installing
            the app.
          </Text>
          <VoyageAction label="Update widget snapshot" onPress={handleWidgetUpdate} tone="light" />
        </FeatureCard>

        <Text style={{ color: INK, fontSize: 12, fontStyle: 'italic', opacity: 0.5 }}>
          Running on {Platform.OS} with project ID {projectId ?? 'missing'}.
        </Text>
      </ScrollView>
    </View>
  );
}

function FeatureCard({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-3xl p-4" style={{ backgroundColor: PARCHMENT_DEEP }}>
      <View className="flex-row items-start">
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: INK }}>
          <Icon name="Settings" size={15} color={PARCHMENT} />
        </View>
        <View className="flex-1">
          <Text style={{ color: INK, fontFamily: SERIF, fontSize: 18, letterSpacing: -0.2 }}>
            {title}
          </Text>
          <Text style={bodyText}>{status}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function VoyageAction({
  label,
  onPress,
  tone = 'dark',
}: {
  label: string;
  onPress: () => void;
  tone?: 'dark' | 'light';
}) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center justify-center rounded-full px-4 py-3"
      style={{ backgroundColor: dark ? INK : PARCHMENT }}>
      <Text style={{ color: dark ? PARCHMENT : INK, fontFamily: SERIF, fontSize: 13 }}>
        {label}
      </Text>
      {dark ? <Icon name="ArrowRight" size={13} color={BRICK} /> : null}
    </Pressable>
  );
}

const bodyText = {
  color: INK,
  fontSize: 12,
  fontStyle: 'italic' as const,
  lineHeight: 18,
  opacity: 0.6,
};
