import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ScrollView, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from '@/components/ThemedText';
import Icon from '@/components/Icon';
import GeoGlyph from '@/components/GeoGlyph';
import ThemeToggle from '@/components/ThemeToggle';
import { usePremium } from '@/contexts/PremiumContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { listOrders, listTracked, listRecents } from '@/utils/trackedStorage';
import { INK, PARCHMENT, PARCHMENT_DEEP, PARCHMENT_COOL, SERIF, MOSS } from '@/lib/theme';
import { getOwnerProfile, subscribeTravelerProfiles } from '@/utils/travelerProfileStorage';
import { type TravelerProfile } from '@/lib/travelerProfileTypes';

type Counts = { trips: number; tracked: number; recents: number };

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { state, isPremium } = usePremium();
  const [counts, setCounts] = useState<Counts>({ trips: 0, tracked: 0, recents: 0 });
  const [ownerProfile, setOwnerProfile] = useState<TravelerProfile | null>(null);

  // Load owner profile on mount and subscribe to changes from the Traveler details screen.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const profile = await getOwnerProfile();
      if (active) setOwnerProfile(profile);
    };
    load();
    const unsubscribe = subscribeTravelerProfiles(() => {
      load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [orders, tracked, recents] = await Promise.all([
          listOrders(),
          listTracked(),
          listRecents(),
        ]);
        if (!active) return;
        setCounts({ trips: orders.length, tracked: tracked.length, recents: recents.length });
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const givenName = ownerProfile?.givenName?.trim() ?? '';
  const headline = givenName ? `Hello, ${givenName}` : 'Hello, wanderer';
  const avatarLetter = givenName ? givenName[0].toUpperCase() : 'T';

  // Subhead fallback chain: top FF > passport country > trip count > default
  let subhead = 'Welcome aboard';
  if (ownerProfile) {
    const topFF = ownerProfile.frequentFlyers[0];
    if (topFF) {
      const tier = topFF.tier ? ` ${topFF.tier.charAt(0).toUpperCase()}${topFF.tier.slice(1)}` : '';
      subhead = `${topFF.carrierName}${tier}`;
    } else if (ownerProfile.passport?.countryCode) {
      subhead = `${ownerProfile.passport.countryCode} passport`;
    } else if (counts.trips > 0) {
      subhead = `${counts.trips} trip${counts.trips === 1 ? '' : 's'} on the calendar`;
    }
  }

  return (
    <View
      className="flex-1 bg-light-primary dark:bg-dark-primary"
      style={{ paddingTop: insets.top }}>
      <View className="flex-row items-start justify-between px-global pb-2 pt-4">
        <View className="flex-1 pr-3">
          <ThemedText style={{ fontFamily: SERIF, fontSize: 14, opacity: 0.55 }}>
            The traveler
          </ThemedText>
          <ThemedText
            className="mt-1"
            style={{ fontFamily: SERIF, fontSize: 30, letterSpacing: -0.3 }}>
            {headline}
          </ThemedText>
          <ThemedText
            className="opacity-65 mt-1"
            style={{ fontFamily: SERIF, fontSize: 14, fontStyle: 'italic' }}>
            Everything you've set in motion, in one place.
          </ThemedText>
        </View>
        <View className="flex-row items-center">
          <ThemeToggle accessibilityLabel="Toggle color theme" />
          <Pressable
            onPress={() => router.push('/screens/notifications')}
            className="ml-2 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: PARCHMENT_DEEP }}
            accessibilityRole="button"
            accessibilityLabel="Open notifications">
            <Icon name="Bell" size={16} color={INK} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}>
        <View className="mt-4 overflow-hidden rounded-3xl" style={{ backgroundColor: INK }}>
          <View className="flex-row items-center px-5 pb-3 pt-5">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: PARCHMENT }}>
              <Text style={{ fontFamily: SERIF, fontSize: 18, color: INK }}>{avatarLetter}</Text>
            </View>
            <View className="ml-3 flex-1">
              <Text
                style={{ fontFamily: SERIF, fontSize: 20, color: PARCHMENT, letterSpacing: -0.2 }}>
                Traveler
              </Text>
              <Text
                style={{
                  fontFamily: SERIF,
                  fontSize: 13,
                  color: PARCHMENT,
                  opacity: 0.65,
                  fontStyle: 'italic',
                  marginTop: 2,
                }}>
                {subhead}
              </Text>
            </View>
            <GeoGlyph kind="compass" size={48} color={PARCHMENT} accent="#c97d4a" />
          </View>

          <View
            className="mx-5 mb-5 flex-row rounded-2xl"
            style={{
              backgroundColor: 'rgba(241,236,228,0.07)',
              borderColor: 'rgba(241,236,228,0.15)',
              borderWidth: 1,
            }}>
            <StatCell label="Trips" value={counts.trips} />
            <View style={{ width: 1, backgroundColor: 'rgba(241,236,228,0.12)' }} />
            <StatCell label="Tracked" value={counts.tracked} />
            <View style={{ width: 1, backgroundColor: 'rgba(241,236,228,0.12)' }} />
            <StatCell label="Recent" value={counts.recents} />
          </View>
        </View>

        <Pressable
          onPress={() => router.push(isPremium ? '/(tabs)/chat' : '/screens/premium')}
          className="mt-3 flex-row items-center rounded-3xl p-5"
          style={{ backgroundColor: isPremium ? INK : PARCHMENT_DEEP }}
          accessibilityRole="button"
          accessibilityLabel={
            isPremium ? 'Open concierge planning' : 'Open Voyage Premium upgrade'
          }>
          <View style={{ marginRight: 14 }}>
            <GeoGlyph kind="sun" size={54} color={isPremium ? PARCHMENT : INK} accent="#c97d4a" />
          </View>
          <View className="flex-1">
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 18,
                color: isPremium ? PARCHMENT : INK,
                letterSpacing: -0.2,
              }}>
              {isPremium ? 'Plan your next trip' : 'Voyage Premium'}
            </Text>
            <Text
              style={{
                fontFamily: SERIF,
                fontSize: 13,
                color: isPremium ? PARCHMENT : INK,
                opacity: 0.65,
                fontStyle: 'italic',
                marginTop: 3,
              }}>
              {isPremium
                ? 'Ask the concierge for deals, itineraries, alerts.'
                : 'Test upgrades, premium access, and paywall copy locally.'}
            </Text>
          </View>
          <Icon name="ArrowUpRight" size={16} color={isPremium ? PARCHMENT : INK} />
        </Pressable>

        <View className="mt-3 flex-row">
          <ShortcutCard
            label="Your trips"
            sub={counts.trips === 0 ? 'Nothing booked yet' : `${counts.trips} in the calendar`}
            glyph="skyline-generic"
            onPress={() => router.push('/(tabs)/trips')}
            bg={PARCHMENT_COOL}
          />
          <View style={{ width: 10 }} />
          <ShortcutCard
            label="Tracked routes"
            sub={counts.tracked === 0 ? 'None watched' : `${counts.tracked} watched`}
            glyph="mountain"
            onPress={() => router.push('/(tabs)/favorites')}
            bg={PARCHMENT_DEEP}
          />
        </View>

        <Text
          className="mb-2 mt-6 px-1"
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            color: themeColors.isDark ? themeColors.text : INK,
            letterSpacing: -0.2,
          }}>
          Your account
        </Text>
        <View
          className="overflow-hidden rounded-3xl"
          style={{ backgroundColor: themeColors.isDark ? themeColors.secondary : PARCHMENT_DEEP }}>
          <ProfileRow
            title="Premium"
            hint={
              isPremium
                ? `${state.plan.toUpperCase()} active locally`
                : 'Paywall mock, restore, cancellation'
            }
            icon="Sparkles"
            isDark={themeColors.isDark}
            textColor={themeColors.text}
            onPress={() => router.push('/screens/premium')}
          />
          <Rule isDark={themeColors.isDark} />
          <ProfileRow
            title="Account settings"
            hint="Profile, security, preferences"
            icon="Settings"
            isDark={themeColors.isDark}
            textColor={themeColors.text}
            onPress={() => router.push('/screens/settings')}
          />
          <Rule isDark={themeColors.isDark} />
          <ProfileRow
            title="Edit profile"
            hint="Name, photo, contact info"
            icon="UserRoundPen"
            isDark={themeColors.isDark}
            textColor={themeColors.text}
            onPress={() => router.push('/screens/edit-profile')}
          />
          <Rule isDark={themeColors.isDark} />
          <ProfileRow
            title="Notifications"
            hint="Price drops, reminders"
            icon="Bell"
            isDark={themeColors.isDark}
            textColor={themeColors.text}
            onPress={() => router.push('/screens/notifications')}
          />
        </View>

        <Text
          className="mb-2 mt-6 px-1"
          style={{
            fontFamily: SERIF,
            fontSize: 18,
            color: themeColors.isDark ? themeColors.text : INK,
            letterSpacing: -0.2,
          }}>
          Support
        </Text>
        <View
          className="overflow-hidden rounded-3xl"
          style={{ backgroundColor: themeColors.isDark ? themeColors.secondary : PARCHMENT_DEEP }}>
          <ProfileRow
            title="Get help"
            hint="Docs, contact, FAQs"
            icon="HelpCircle"
            isDark={themeColors.isDark}
            textColor={themeColors.text}
            onPress={() => router.push('/screens/help')}
          />
          <Rule isDark={themeColors.isDark} />
          <ProfileRow
            title="Sign out"
            hint="See you on the next trip"
            icon="LogOut"
            isDark={themeColors.isDark}
            textColor={themeColors.text}
            onPress={() => router.push('/screens/welcome')}
            tone="brick"
          />
        </View>

        <Text
          className="mt-6 text-center"
          style={{
            fontFamily: SERIF,
            fontSize: 13,
            color: themeColors.isDark ? themeColors.text : INK,
            opacity: 0.45,
            fontStyle: 'italic',
          }}>
          Voyage — a small atlas of where you're going.
        </Text>
      </ScrollView>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center py-4">
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: 26,
          color: PARCHMENT,
          letterSpacing: -0.5,
        }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: 11,
          color: PARCHMENT,
          opacity: 0.6,
          marginTop: 2,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
        {label}
      </Text>
    </View>
  );
}

function ShortcutCard({
  label,
  sub,
  glyph,
  onPress,
  bg,
}: {
  label: string;
  sub: string;
  glyph: any;
  onPress: () => void;
  bg: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-3xl p-4"
      style={{ backgroundColor: bg, minHeight: 130 }}>
      <View className="flex-row items-start justify-between">
        <GeoGlyph kind={glyph} size={38} color={INK} accent="#c97d4a" />
        <Icon name="ArrowUpRight" size={14} color={INK} />
      </View>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: 16,
          color: INK,
          marginTop: 14,
          letterSpacing: -0.2,
        }}>
        {label}
      </Text>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: 12,
          color: INK,
          opacity: 0.6,
          marginTop: 3,
          fontStyle: 'italic',
        }}>
        {sub}
      </Text>
    </Pressable>
  );
}

function ProfileRow({
  title,
  hint,
  icon,
  onPress,
  tone,
  isDark,
  textColor,
}: {
  title: string;
  hint: string;
  icon: string;
  onPress: () => void;
  tone?: 'brick';
  isDark?: boolean;
  textColor?: string;
}) {
  const baseColor = isDark ? textColor ?? 'white' : INK;
  const color = tone === 'brick' ? '#c97d4a' : baseColor;
  const iconBubble =
    tone === 'brick'
      ? 'rgba(201,125,74,0.12)'
      : isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(19,26,42,0.06)';
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-5 py-4">
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBubble }}>
        <Icon name={icon as any} size={15} color={color} />
      </View>
      <View className="ml-3 flex-1">
        <Text style={{ fontFamily: SERIF, fontSize: 15, color, letterSpacing: -0.1 }}>{title}</Text>
        <Text
          style={{
            fontFamily: SERIF,
            fontSize: 12,
            color: baseColor,
            opacity: 0.5,
            marginTop: 1,
            fontStyle: 'italic',
          }}>
          {hint}
        </Text>
      </View>
      <Icon name="ChevronRight" size={14} color={baseColor} />
    </Pressable>
  );
}

function Rule({ isDark }: { isDark?: boolean }) {
  return (
    <View
      style={{
        height: 1,
        marginLeft: 60,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(19,26,42,0.06)',
      }}
    />
  );
}
