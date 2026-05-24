import { Alert, Pressable, View } from 'react-native';
import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import ThemedText from '@/components/ThemedText';
import Icon from '@/components/Icon';
import ListLink from '@/components/ListLink';
import AnimatedView from '@/components/AnimatedView';
import ThemedScroller from '@/components/ThemeScroller';
import Section from '@/components/layout/Section';
import { useCurrency, currencyTitle } from '@/utils/currencyStorage';
import { resetDevData } from '@/lib/devSeed';
import { getOwnerProfile } from '@/utils/travelerProfileStorage';
import type { TravelerProfile } from '@/lib/travelerProfileTypes';
import { PARCHMENT } from '@/lib/theme';

export default function ProfileScreen() {
  const currency = useCurrency();
  const [owner, setOwner] = useState<TravelerProfile | null>(null);

  useEffect(() => {
    getOwnerProfile().then(setOwner).catch(() => {});
  }, []);

  const travelerDescription = (() => {
    if (!owner) return 'Add passport, loyalty, dietary preferences';
    const name = owner.givenName ? owner.givenName : null;
    const dietCount = owner.dietary.length;
    const ffCount = owner.frequentFlyers.length;
    const prefsCount = dietCount + ffCount;
    if (name && prefsCount > 0) return `${name} · ${prefsCount} pref${prefsCount !== 1 ? 's' : ''} saved`;
    if (name) return `${name} · Add passport, loyalty, dietary preferences`;
    return 'Add passport, loyalty, dietary preferences';
  })();
  return (
    <AnimatedView
      className="flex-1 dark:bg-dark-primary"
      style={{ backgroundColor: PARCHMENT }}
      animation="fadeIn"
      duration={350}
      playOnlyOnce={false}>
      <Header showBackButton />
      <ThemedScroller>
        <Section
          titleSize="3xl"
          className="px-4 pb-10 pt-4"
          title="Settings"
          subtitle="Manage your account settings"
        />

        <View className="px-4">
          <ListLink
            title="Payments"
            description="Manage payment methods"
            icon="CreditCard"
            href="/screens/profile/payments"
          />
          <ListLink
            title="Premium"
            description="Local paywall mock and entitlement state"
            icon="Sparkles"
            href="/screens/premium"
          />
          <ListLink
            title="Traveler details"
            description={travelerDescription}
            icon="IdCard"
            href="/screens/profile/traveler-details"
          />
          <ListLink
            title="Notifications"
            description="Push notifications, email notifications"
            icon="Bell"
            href="/screens/profile/notifications"
          />
          <ListLink
            title="Native features"
            description="Maps, widgets, push token, Face ID"
            icon="Map"
            href="/screens/native-features"
          />
          <ListLink
            title="Currency"
            description={`${currency} - ${currencyTitle(currency)}`}
            icon="DollarSign"
            href="/screens/profile/currency"
          />
          <ListLink
            title="Help"
            description="Contact support"
            icon="HelpCircle"
            href="/screens/help"
          />
        </View>
        {__DEV__ ? (
          <View className="px-4 mt-10">
            <Section title="Dev" titleSize="lg" className="mb-3" />
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Reset demo data?',
                  'Clears all local Voyage storage and re-seeds the demo trips, stays, activities, and notifications.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: async () => {
                        await resetDevData();
                        Alert.alert('Demo data reset', 'Reload the app to see the fresh seeds.');
                      },
                    },
                  ],
                );
              }}
              className="flex-row items-center rounded-2xl px-4 py-4 bg-light-secondary/30 dark:bg-dark-secondary/30">
              <View className="w-9 h-9 items-center justify-center rounded-full bg-light-secondary/60 dark:bg-white/10 mr-3">
                <Icon name="RefreshCw" size={16} />
              </View>
              <View className="flex-1">
                <ThemedText className="font-semibold">Reset demo data</ThemedText>
                <ThemedText className="text-xs opacity-60 mt-1">
                  Wipes all @voyage/* keys and re-seeds. Dev builds only.
                </ThemedText>
              </View>
              <Icon name="ChevronRight" size={16} />
            </Pressable>
          </View>
        ) : null}
      </ThemedScroller>
    </AnimatedView>
  );
}
