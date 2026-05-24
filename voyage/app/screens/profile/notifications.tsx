import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import Header from '@/components/Header';
import ThemedScroller from '@/components/ThemeScroller';
import ThemedText from '@/components/ThemedText';
import Switch from '@/components/forms/Switch';
import Section from '@/components/layout/Section';
import { useThemeColors } from '@/contexts/ThemeColors';
import { INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const rowBg = isDark ? themeColors.secondary : PARCHMENT_DEEP;
  const headingColor = isDark ? themeColors.text : INK;

  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    bookingConfirmations: true,
    priceDrops: true,
    paymentConfirmations: true,
    scheduleChanges: true,
    checkInReminders: true,
    specialOffers: false,
    fareSales: false,
    travelInspiration: false,
    marketingEmails: false,
  });

  const handleToggle = (setting: keyof typeof notifications, value: boolean) => {
    setNotifications((prev) => ({
      ...prev,
      [setting]: value,
    }));
  };

  const saveSettings = () => {
    Alert.alert('Saved', 'Notification preferences saved (mock).', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <View className="bg-light-bg dark:bg-dark-bg flex-1">
      <Header
        showBackButton
        rightComponents={[
          <Pressable onPress={saveSettings} style={{ backgroundColor: INK, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 }}>
            <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 13 }}>Save changes</Text>
          </Pressable>
        ]}
      />
      <ThemedScroller>
        <Section
          titleSize="3xl"
          className="mt-10 pb-10"
          title="Notifications"
          subtitle="Stay on top of your tracked routes and trips"
        />

        <View className="mb-8">
          <ThemedText
            className="mb-4"
            style={{ color: headingColor, fontFamily: SERIF, fontSize: 18, letterSpacing: -0.2 }}>
            Flights & Trips
          </ThemedText>

          <Switch
            label="Booking Confirmations"
            description="Order confirmations, e-tickets, and itinerary changes"
            value={notifications.bookingConfirmations}
            onChange={(value) => handleToggle('bookingConfirmations', value)}
            disabled={!notifications.pushEnabled}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Price Drops"
            description="Alerts when fares drop on your tracked routes"
            value={notifications.priceDrops}
            onChange={(value) => handleToggle('priceDrops', value)}
            disabled={!notifications.pushEnabled}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Payment Confirmations"
            description="Receipts and payment processing updates"
            value={notifications.paymentConfirmations}
            onChange={(value) => handleToggle('paymentConfirmations', value)}
            disabled={!notifications.pushEnabled}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Schedule Changes"
            description="Gate, time, and aircraft updates from your airline"
            value={notifications.scheduleChanges}
            onChange={(value) => handleToggle('scheduleChanges', value)}
            disabled={!notifications.pushEnabled}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Check-in Reminders"
            description="Nudge to check in 24 hours before departure"
            value={notifications.checkInReminders}
            onChange={(value) => handleToggle('checkInReminders', value)}
            disabled={!notifications.pushEnabled}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />
        </View>

        <View className="mt-8">
          <ThemedText
            className="mb-4"
            style={{ color: headingColor, fontFamily: SERIF, fontSize: 18, letterSpacing: -0.2 }}>
            Promotions & Inspiration
          </ThemedText>

          <Switch
            label="Special Offers"
            description="Limited-time fare deals matching your interests"
            value={notifications.specialOffers}
            onChange={(value) => handleToggle('specialOffers', value)}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Fare Sales"
            description="Airline-wide promotions on routes you fly"
            value={notifications.fareSales}
            onChange={(value) => handleToggle('fareSales', value)}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Travel Inspiration"
            description="Destination guides and concierge ideas from your AI assistant"
            value={notifications.travelInspiration}
            onChange={(value) => handleToggle('travelInspiration', value)}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />

          <Switch
            label="Marketing Emails"
            description="Newsletters and destination inspiration"
            value={notifications.marketingEmails}
            onChange={(value) => handleToggle('marketingEmails', value)}
            className="mb-2 rounded-2xl px-4 py-4"
            style={{ backgroundColor: rowBg }}
          />
        </View>
      </ThemedScroller>
    </View>
  );
};

export default NotificationsScreen;
