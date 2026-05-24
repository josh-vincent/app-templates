import { AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon, { IconName } from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { BRICK, INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

type AuthOptionProps = {
  label: string;
  icon?: IconName;
  brandIcon?: 'google' | 'apple';
  onPress: () => void;
};

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={{ backgroundColor: PARCHMENT }} className="flex-1">
      <View className="flex-1 px-global">
        <View className="w-full flex-row justify-end pt-2">
          <ThemeToggle />
        </View>

        <View className="flex-1 justify-center pb-16">
          <View
            className="mb-4 overflow-hidden rounded-3xl"
            style={{ backgroundColor: INK, padding: 22 }}>
            <View
              className="mb-14 h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: PARCHMENT }}>
              <Text style={{ color: INK, fontFamily: SERIF, fontSize: 21 }}>V</Text>
            </View>
            <Text
              style={{
                color: PARCHMENT,
                fontFamily: SERIF,
                fontSize: 34,
                letterSpacing: -0.4,
              }}>
              Welcome back
            </Text>
            <Text
              className="mt-2"
              style={{ color: PARCHMENT, fontSize: 13, fontStyle: 'italic', opacity: 0.65 }}>
              Sign in and pick up the trip thread where you left it.
            </Text>
          </View>

          <View className="gap-2">
            <AuthOption
              label="Continue with Email"
              icon="Mail"
              onPress={() => router.push('/screens/signup')}
            />
            <AuthOption
              label="Continue with Facebook"
              icon="Facebook"
              onPress={() => router.push('/(tabs)/(home)')}
            />
            <AuthOption
              label="Continue with Google"
              brandIcon="google"
              onPress={() => router.push('/(tabs)/(home)')}
            />
            <AuthOption
              label="Continue with Apple"
              brandIcon="apple"
              onPress={() => router.push('/(tabs)/(home)')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthOption({ label, icon, brandIcon, onPress }: AuthOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center rounded-2xl px-4 py-4"
      style={{ backgroundColor: PARCHMENT_DEEP }}>
      <View
        className="mr-3 h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
        {icon ? (
          <Icon name={icon} size={16} color={INK} />
        ) : (
          <AntDesign name={brandIcon} size={18} color={INK} />
        )}
      </View>
      <Text style={{ color: INK, fontFamily: SERIF, fontSize: 15, letterSpacing: -0.1 }}>
        {label}
      </Text>
      <View className="ml-auto">
        <Icon name="ArrowRight" size={14} color={BRICK} />
      </View>
    </Pressable>
  );
}
