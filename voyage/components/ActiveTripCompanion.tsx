import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { type ActionSheetRef } from 'react-native-actions-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActiveTrip } from '@/contexts/ActiveTripContext';
import ActionSheetThemed from '@/components/ActionSheetThemed';
import GeoGlyph from '@/components/GeoGlyph';
import Icon, { type IconName } from '@/components/Icon';
import ThemedText from '@/components/ThemedText';
import { saveToDeviceCalendar, type CalendarEvent } from '@/lib/calendarActions';
import { checkInUrl, shareTrip } from '@/lib/links';
import { INK, BRICK, BRICK_LIGHT, MOSS, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { getTripById } from '@/utils/tripStorage';
import type { ItinerarySlot } from '@/lib/tripTypes';

type SectionMenu = 'day' | 'explore' | 'nearby' | 'trip';

export default function ActiveTripCompanion() {
  const {
    activeTrip,
    session,
    selectedDayIndex,
    isExpanded,
    locationPermission,
    expand,
    collapse,
    goToNextDay,
    goToPreviousDay,
    startTracking,
    pauseTracking,
    stopTracking,
  } = useActiveTrip();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [activeMenu, setActiveMenu] = useState<SectionMenu>('trip');
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const dragY = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    dragY.value = reduceMotion ? 0 : 30;
    dragY.value = withTiming(0, { duration: reduceMotion ? 0 : 340 });
  }, [dragY, isExpanded, reduceMotion]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const closeFromGesture = () => {
    collapse();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY < 0) return;
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      if (event.translationY > 140 || event.velocityY > 1000) {
        dragY.value = withTiming(screenHeight, { duration: reduceMotion ? 0 : 220 }, () => {
          runOnJS(closeFromGesture)();
          dragY.value = 0;
        });
        return;
      }
      dragY.value = withSpring(0, { damping: 18, stiffness: 180 });
    });

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      activeTrip?.order.slices.map((slice) => ({
        title: `Flight: ${slice.origin} → ${slice.destination} (${slice.carrierName} ${slice.flightNumber})`,
        start: slice.departing_at,
        end: slice.arriving_at,
        location: `${slice.origin} → ${slice.destination}`,
        notes: `Booking ${activeTrip.order.bookingReference} · ${activeTrip.order.passengerName}`,
      })) ?? [],
    [activeTrip]
  );

  const selectedDay = activeTrip?.days[selectedDayIndex];
  const trackingState = session?.trackingState ?? 'idle';
  const trackingTone =
    trackingState === 'tracking'
      ? MOSS
      : trackingState === 'paused'
        ? BRICK
        : 'rgba(241,236,228,0.22)';

  // Pick the active/next slice for the mini-player route label.
  const activeSlice = useMemo(() => {
    if (!activeTrip) return null;
    const slices = activeTrip.order.slices;
    const now = Date.now();
    // Prefer a slice currently in progress (departing_at <= now <= arriving_at).
    const inFlight = slices.find((s) => {
      const dep = Date.parse(s.departing_at);
      const arr = Date.parse(s.arriving_at);
      return Number.isFinite(dep) && Number.isFinite(arr) && dep <= now && now <= arr;
    });
    if (inFlight) return inFlight;
    // Otherwise pick the next future slice.
    const upcoming = slices
      .filter((s) => {
        const dep = Date.parse(s.departing_at);
        return Number.isFinite(dep) && dep > now;
      })
      .sort((a, b) => Date.parse(a.departing_at) - Date.parse(b.departing_at))[0];
    if (upcoming) return upcoming;
    // Fall back to the last slice when all are past.
    return slices[slices.length - 1] ?? null;
  }, [activeTrip]);

  // Timing copy derived from the active slice (not the whole trip's arrivalAt).
  const sliceTimingLabel = useMemo(() => {
    if (!activeSlice) return activeTrip?.timingLabel ?? '';
    const now = Date.now();
    const dep = Date.parse(activeSlice.departing_at);
    const arr = Date.parse(activeSlice.arriving_at);
    const fmt = (ts: number) =>
      new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const fmtFull = (ts: number) =>
      new Date(ts).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    if (Number.isFinite(dep) && Number.isFinite(arr) && dep <= now && now <= arr) {
      return `Lands at ${fmt(arr)}`;
    }
    if (Number.isFinite(dep) && dep > now) {
      const diff = dep - now;
      const hours = Math.round(diff / 3_600_000);
      if (hours <= 24) return `Boarding in ${Math.max(hours, 1)}h · ${fmt(dep)}`;
      const days = Math.ceil(diff / 86_400_000);
      if (days === 1) return `Boards tomorrow · ${fmtFull(dep)}`;
      return `Boards in ${days} days · ${fmtFull(dep)}`;
    }
    // Past slice — show landed.
    return Number.isFinite(arr) ? `Landed ${fmt(arr)}` : (activeTrip?.timingLabel ?? '');
  }, [activeSlice, activeTrip]);

  // Route label derived from the active slice only.
  const sliceRouteLabel = activeSlice
    ? `${activeSlice.origin} → ${activeSlice.destination}`
    : (activeTrip?.routeLabel ?? '');

  // Next itinerary slot from the linked Trip (via tripId).
  const [nextSlotLine, setNextSlotLine] = useState<string | null>(null);
  useEffect(() => {
    if (!activeTrip) return;
    let cancelled = false;
    getTripById(activeTrip.tripId)
      .then((linkedTrip) => {
        if (cancelled || !linkedTrip) return;
        const now = Date.now();
        const todayDate = new Date(now).toISOString().slice(0, 10);
        const nowTime = new Date(now).toTimeString().slice(0, 5); // "HH:MM"
        let found: (ItinerarySlot & { date: string }) | null = null;
        for (const day of linkedTrip.itineraryDays) {
          for (const slot of day.slots) {
            if (!slot.time) continue;
            // Compare date+time to now.
            if (day.date > todayDate || (day.date === todayDate && slot.time >= nowTime)) {
              if (
                !found ||
                day.date < found.date ||
                (day.date === found.date && slot.time < found.time!)
              ) {
                found = { ...slot, date: day.date };
              }
            }
          }
        }
        if (found) {
          const label = found.time
            ? `${found.time} · ${found.title}`
            : found.title;
          setNextSlotLine(label);
        } else {
          setNextSlotLine(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTrip]);

  if (!activeTrip || !selectedDay) return null;

  const trip = activeTrip;

  const openMenu = (menu: SectionMenu) => {
    setActiveMenu(menu);
    actionSheetRef.current?.show();
  };

  const latestLocation = session?.latestLocation;
  const locationLabel = latestLocation
    ? `${latestLocation.latitude.toFixed(3)}, ${latestLocation.longitude.toFixed(3)}`
    : locationPermission === 'denied'
      ? 'Location access is off'
      : 'No live fix yet';

  const summary = `${trip.routeLabel} · ${trip.order.bookingReference}`;
  const firstCarrier = trip.order.slices[0]?.carrierCode;

  return (
    <>
      <View
        style={{
          backgroundColor: PARCHMENT,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(19,26,42,0.06)',
        }}>
        <Pressable
          accessibilityRole="button"
              accessibilityLabel={`Open active trip for ${trip.destinationCity}`}
          onPress={expand}
          style={[styles.miniPlayer, { paddingBottom: Math.max(insets.bottom * 0.15, 2) }]}>
          <View style={styles.miniLeft}>
            <View style={styles.miniEyebrowRow}>
              <Text style={styles.miniEyebrow}>
                {trip.status === 'in_progress' ? 'ACTIVE TRIP' : 'UP NEXT'}
              </Text>
              <View style={[styles.miniStatusPill, { backgroundColor: trackingTone }]}>
                <Text style={styles.miniStatusText}>
                  {trackingState === 'tracking'
                    ? 'Tracking live'
                    : trackingState === 'paused'
                      ? 'Tracking paused'
                      : selectedDay.label}
                </Text>
              </View>
            </View>
            <ThemedText style={styles.miniTitle}>{sliceRouteLabel}</ThemedText>
            <ThemedText style={styles.miniSubtitle}>
              {sliceTimingLabel} · {selectedDay.dateLabel}
            </ThemedText>
          </View>

          <View style={styles.miniRight}>
            <GeoGlyph
              iata={activeSlice?.destination ?? trip.order.slices[trip.order.slices.length - 1]?.destination}
              size={46}
              color={PARCHMENT}
              accent={BRICK_LIGHT}
            />
            <View style={styles.miniChevron}>
              <Icon name="ChevronUp" size={16} color={PARCHMENT} />
            </View>
          </View>
        </Pressable>
      </View>

      <Modal visible={isExpanded} transparent animationType="none" onRequestClose={collapse}>
        <View style={styles.modalBackdrop}>
          <Animated.View style={[styles.modalCard, animatedSheetStyle]}>
            <ScrollView
              bounces={false}
              contentContainerStyle={{
                paddingTop: insets.top + 10,
                paddingBottom: insets.bottom + 32,
              }}
              showsVerticalScrollIndicator={false}>
              <GestureDetector gesture={panGesture}>
                <View style={styles.headerWrap}>
                  <View style={styles.dragHandle} />
                  <View style={styles.headerRow}>
                    <View>
                      <Text style={styles.heroEyebrow}>{activeTrip.statusLabel}</Text>
                      <ThemedText style={styles.heroTitle}>{activeTrip.headline}</ThemedText>
                      <ThemedText style={styles.heroMeta}>
                        {sliceTimingLabel} · {activeTrip.bookingLabel}
                      </ThemedText>
                    </View>
                    <Pressable onPress={collapse} style={styles.closeButton}>
                      <Icon name="X" size={18} color={PARCHMENT} />
                    </Pressable>
                  </View>

                  <View style={styles.heroRail}>
                    <View>
                      <Text style={styles.heroRoute}>{sliceRouteLabel}</Text>
                      <ThemedText style={styles.heroRouteCopy}>{sliceTimingLabel}</ThemedText>
                      {nextSlotLine ? (
                        <ThemedText
                          style={[
                            styles.heroRouteCopy,
                            { marginTop: 6, opacity: 0.65, fontSize: 12 },
                          ]}>
                          Next: {nextSlotLine}
                        </ThemedText>
                      ) : null}
                    </View>
                    <GeoGlyph
                      iata={
                        activeSlice?.destination ??
                        activeTrip.order.slices[activeTrip.order.slices.length - 1]?.destination
                      }
                      size={82}
                      color={PARCHMENT}
                      accent={BRICK_LIGHT}
                    />
                  </View>
                </View>
              </GestureDetector>

              <View style={styles.contentWrap}>
                <SectionFrame
                  title="Trip day"
                  subtitle={selectedDay.dateLabel}
                  onMenu={() => openMenu('day')}>
                  <View style={styles.dayPlayer}>
                    <DayStepButton
                      icon="ChevronLeft"
                      disabled={selectedDayIndex === 0}
                      label="Previous"
                      onPress={goToPreviousDay}
                    />
                    <View style={styles.dayCore}>
                      <Text style={styles.dayLabel}>{selectedDay.label}</Text>
                      <ThemedText style={styles.dayTitle}>{selectedDay.title}</ThemedText>
                      <ThemedText style={styles.daySummary}>{selectedDay.summary}</ThemedText>
                    </View>
                    <DayStepButton
                      icon="ChevronRight"
                      disabled={selectedDayIndex === activeTrip.days.length - 1}
                      label="Next"
                      onPress={goToNextDay}
                    />
                  </View>
                  <View style={styles.momentList}>
                    {selectedDay.moments.map((moment) => (
                      <View key={moment.id} style={styles.momentRow}>
                        <View
                          style={[
                            styles.momentDot,
                            {
                              backgroundColor:
                                moment.tone === 'travel'
                                  ? INK
                                  : moment.tone === 'local'
                                    ? MOSS
                                    : BRICK,
                            },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.momentTitle}>{moment.title}</ThemedText>
                          <ThemedText style={styles.momentDetail}>{moment.detail}</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </SectionFrame>

                <SectionFrame
                  title="Ground tracking"
                  subtitle={
                    trackingState === 'tracking'
                      ? 'Live'
                      : trackingState === 'paused'
                        ? 'Paused'
                        : 'Ready'
                  }
                  onMenu={() => openMenu('trip')}
                  tone="dark">
                  <View style={styles.trackingRow}>
                    <TrackingButton
                      label="Start"
                      icon="Play"
                      active={trackingState === 'tracking'}
                      onPress={startTracking}
                    />
                    <TrackingButton
                      label="Pause"
                      icon="Pause"
                      active={trackingState === 'paused'}
                      onPress={pauseTracking}
                    />
                    <TrackingButton label="Stop" icon="Square" destructive onPress={stopTracking} />
                  </View>
                  <View style={styles.metaGrid}>
                    <MetaStat
                      label="Last fix"
                      value={
                        latestLocation
                          ? new Date(latestLocation.recordedAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Not yet'
                      }
                    />
                    <MetaStat label="Position" value={locationLabel} />
                  </View>
                </SectionFrame>

                <SectionFrame
                  title="Explore"
                  subtitle={activeTrip.destinationCity}
                  onMenu={() => openMenu('explore')}>
                  <ThemedText style={styles.sectionCopy}>
                    Keep this day grounded around one strong neighborhood, then let the assistant
                    widen the radius only when you have margin.
                  </ThemedText>
                  <View style={styles.inlineActions}>
                    <PillAction
                      label="Ask assistant"
                      icon="Sparkles"
                      onPress={() => router.push('/(tabs)/chat')}
                    />
                    <PillAction
                      label="Open trip details"
                      icon="Plane"
                      onPress={async () => {
                        const t = await getTripById(trip.tripId);
                        const orderId = t?.orderIds[0];
                        if (orderId) {
                          router.push({ pathname: '/screens/trip-detail', params: { id: orderId } });
                        } else {
                          router.push({ pathname: '/screens/itinerary/[tripId]', params: { tripId: trip.tripId } });
                        }
                      }}
                    />
                  </View>
                </SectionFrame>

                <SectionFrame
                  title="Near me"
                  subtitle={
                    locationPermission === 'granted' ? 'Location ready' : 'Needs permission'
                  }
                  onMenu={() => openMenu('nearby')}>
                  <ThemedText style={styles.sectionCopy}>
                    {locationPermission === 'granted'
                      ? `Use your latest fix to branch into coffee, essentials, or a quick reset near ${locationLabel}.`
                      : 'Allow location to turn this into an on-the-ground view of nearby essentials and quick recommendations.'}
                  </ThemedText>
                  <View style={styles.inlineActions}>
                    <PillAction
                      label={
                        locationPermission === 'granted' ? 'Refresh tracking' : 'Enable location'
                      }
                      icon={locationPermission === 'granted' ? 'MapPinned' : 'LocateFixed'}
                      onPress={startTracking}
                    />
                    <PillAction
                      label="Open maps"
                      icon="Navigation"
                      onPress={() => {
                        const destination = latestLocation
                          ? `${latestLocation.latitude},${latestLocation.longitude}`
                          : trip.destinationCity;
                        Linking.openURL(
                          `https://maps.apple.com/?q=${encodeURIComponent(destination)}`
                        ).catch(() => {});
                      }}
                    />
                  </View>
                </SectionFrame>

                <SectionFrame title="Trip actions" subtitle="Keep the essentials close">
                  <View style={styles.actionList}>
                    <ActionRow
                      icon="CalendarDays"
                      label="Add flights to calendar"
                      detail="Save the booked slices as local calendar events."
                      onPress={() => saveToDeviceCalendar(calendarEvents)}
                    />
                    {firstCarrier ? (
                      <ActionRow
                        icon="UserCheck"
                        label="Check in with airline"
                        detail={`${trip.order.slices[0]?.carrierName} · ${trip.order.bookingReference}`}
                        onPress={() =>
                          Linking.openURL(
                            checkInUrl(firstCarrier, trip.order.bookingReference)
                          ).catch(() => {})
                        }
                      />
                    ) : null}
                    <ActionRow
                      icon="Share2"
                      label="Share trip"
                      detail={summary}
                      onPress={() => shareTrip(trip.tripId, summary)}
                    />
                  </View>
                </SectionFrame>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ActionSheetThemed
        ref={actionSheetRef}
        gestureEnabled
        indicatorStyle={{ backgroundColor: 'rgba(19,26,42,0.12)' }}>
        <View style={styles.sheetBody}>
          <Text style={styles.sheetEyebrow}>{menuTitle(activeMenu)}</Text>
          {menuItems(activeMenu).map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                actionSheetRef.current?.hide();
                item.onPress();
              }}
              style={styles.sheetAction}>
              <View style={styles.sheetActionIcon}>
                <Icon name={item.icon} size={16} color={INK} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.sheetActionTitle}>{item.label}</ThemedText>
                <ThemedText style={styles.sheetActionDetail}>{item.detail}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      </ActionSheetThemed>
    </>
  );

  function menuItems(menu: SectionMenu): {
    label: string;
    detail: string;
    icon: IconName;
    onPress: () => void | Promise<void>;
  }[] {
    switch (menu) {
      case 'day':
        return [
          {
            label: 'Previous day',
            detail: 'Step back in the itinerary player.',
            icon: 'ChevronLeft',
            onPress: goToPreviousDay,
          },
          {
            label: 'Next day',
            detail: 'Move ahead to the next day.',
            icon: 'ChevronRight',
            onPress: goToNextDay,
          },
        ];
      case 'explore':
        return [
          {
            label: 'Open assistant',
            detail: 'Ask for a tighter plan around this destination.',
            icon: 'Sparkles',
            onPress: () => router.push('/(tabs)/chat'),
          },
          {
            label: 'Open trip detail',
            detail: 'Jump to the booked-flight detail page.',
            icon: 'Plane',
            onPress: async () => {
              const t = await getTripById(trip.tripId);
              const orderId = t?.orderIds[0];
              if (orderId) {
                router.push({ pathname: '/screens/trip-detail', params: { id: orderId } });
              } else {
                router.push({ pathname: '/screens/itinerary/[tripId]', params: { tripId: trip.tripId } });
              }
            },
          },
        ];
      case 'nearby':
        return [
          {
            label: 'Start live tracking',
            detail: 'Begin or refresh the foreground location watch.',
            icon: 'LocateFixed',
            onPress: () => {
              startTracking().catch(() => {});
            },
          },
          {
            label: 'Open Maps',
            detail: 'Jump to Apple Maps with this trip context.',
            icon: 'Map',
            onPress: () => {
              const query = latestLocation
                ? `${latestLocation.latitude},${latestLocation.longitude}`
                : trip.destinationCity;
              Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(query)}`).catch(
                () => {}
              );
            },
          },
        ];
      case 'trip':
      default:
        return [
          {
            label: 'Share trip',
            detail: 'Send the booked route and reference.',
            icon: 'Share2',
            onPress: () => {
              shareTrip(trip.tripId, summary).catch(() => {});
            },
          },
          {
            label: 'Open trip details',
            detail: 'See the full booking ledger and flight actions.',
            icon: 'ReceiptText',
            onPress: async () => {
              const t = await getTripById(trip.tripId);
              const orderId = t?.orderIds[0];
              if (orderId) {
                router.push({ pathname: '/screens/trip-detail', params: { id: orderId } });
              } else {
                router.push({ pathname: '/screens/itinerary/[tripId]', params: { tripId: trip.tripId } });
              }
            },
          },
          {
            label: 'Open itinerary',
            detail: 'Day-by-day plan with slots.',
            icon: 'Calendar',
            onPress: () =>
              router.push({ pathname: '/screens/itinerary/[tripId]', params: { tripId: trip.tripId } }),
          },
        ];
    }
  }
}

function SectionFrame({
  children,
  title,
  subtitle,
  onMenu,
  tone = 'light',
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onMenu?: () => void;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';

  return (
    <View
      style={[
        styles.sectionFrame,
        dark
          ? {
              backgroundColor: 'rgba(241,236,228,0.08)',
              borderColor: 'rgba(241,236,228,0.12)',
            }
          : {
              backgroundColor: PARCHMENT_DEEP,
              borderColor: 'rgba(19,26,42,0.08)',
            },
      ]}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionEyebrow, dark && { color: 'rgba(241,236,228,0.6)' }]}>
            {subtitle}
          </Text>
          <ThemedText style={[styles.sectionTitle, dark && { color: PARCHMENT }]}>
            {title}
          </ThemedText>
        </View>
        {onMenu ? (
          <Pressable
            accessibilityRole="button"
            onPress={onMenu}
            style={[styles.sectionMenu, dark && { backgroundColor: 'rgba(241,236,228,0.1)' }]}>
            <Icon name="Ellipsis" size={18} color={dark ? PARCHMENT : INK} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function DayStepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.dayStepButton, disabled && { opacity: 0.35 }]}>
      <Icon name={icon} size={18} color={INK} />
      <Text style={styles.dayStepLabel}>{label}</Text>
    </Pressable>
  );
}

function TrackingButton({
  label,
  icon,
  active = false,
  destructive = false,
  onPress,
}: {
  label: string;
  icon: IconName;
  active?: boolean;
  destructive?: boolean;
  onPress: () => void | Promise<void> | Promise<boolean>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Promise.resolve(onPress()).catch(() => {});
      }}
      style={[
        styles.trackingButton,
        active && { backgroundColor: destructive ? BRICK : MOSS },
        destructive && !active && { borderColor: 'rgba(201,125,74,0.4)' },
      ]}>
      <Icon name={icon} size={15} color={PARCHMENT} />
      <Text style={styles.trackingLabel}>{label}</Text>
    </Pressable>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaStat}>
      <Text style={styles.metaLabel}>{label}</Text>
      <ThemedText style={styles.metaValue}>{value}</ThemedText>
    </View>
  );
}

function PillAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable onPress={() => { Promise.resolve(onPress()).catch(() => {}); }} style={styles.pillAction}>
      <Icon name={icon} size={16} color={INK} />
      <Text style={styles.pillActionLabel}>{label}</Text>
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow}>
      <View style={styles.actionIconWrap}>
        <Icon name={icon} size={16} color={INK} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.actionLabel}>{label}</ThemedText>
        <ThemedText style={styles.actionDetail}>{detail}</ThemedText>
      </View>
      <Icon name="ChevronRight" size={16} color="rgba(19,26,42,0.45)" />
    </Pressable>
  );
}

function menuTitle(menu: SectionMenu) {
  switch (menu) {
    case 'day':
      return 'Day actions';
    case 'explore':
      return 'Explore actions';
    case 'nearby':
      return 'Nearby actions';
    case 'trip':
    default:
      return 'Trip actions';
  }
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 17, 28, 0.88)',
  },
  modalCard: {
    flex: 1,
    backgroundColor: INK,
  },
  miniPlayer: {
    backgroundColor: INK,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  miniLeft: {
    flex: 1,
    gap: 4,
  },
  miniEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniEyebrow: {
    color: 'rgba(241,236,228,0.58)',
    fontSize: 10,
    letterSpacing: 1.8,
  },
  miniStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  miniStatusText: {
    color: PARCHMENT,
    fontSize: 10,
    fontWeight: '600',
  },
  miniTitle: {
    color: PARCHMENT,
    fontSize: 24,
    letterSpacing: -0.4,
    fontFamily: SERIF,
  },
  miniSubtitle: {
    color: 'rgba(241,236,228,0.74)',
    fontSize: 12,
  },
  miniRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  miniChevron: {
    backgroundColor: 'rgba(241,236,228,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerWrap: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 18,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(241,236,228,0.28)',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241,236,228,0.08)',
  },
  heroEyebrow: {
    color: 'rgba(241,236,228,0.58)',
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  heroTitle: {
    color: PARCHMENT,
    fontFamily: SERIF,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.8,
    maxWidth: 260,
  },
  heroMeta: {
    color: 'rgba(241,236,228,0.7)',
    fontSize: 13,
    marginTop: 8,
  },
  heroRail: {
    backgroundColor: 'rgba(241,236,228,0.08)',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  heroRoute: {
    color: PARCHMENT,
    fontSize: 14,
    letterSpacing: 1.8,
  },
  heroRouteCopy: {
    color: 'rgba(241,236,228,0.74)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 220,
  },
  contentWrap: {
    paddingHorizontal: 20,
    gap: 14,
  },
  sectionFrame: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    color: 'rgba(19,26,42,0.46)',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitle: {
    color: INK,
    fontFamily: SERIF,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  sectionMenu: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19,26,42,0.07)',
  },
  dayPlayer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  dayStepButton: {
    width: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(19,26,42,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  dayStepLabel: {
    fontSize: 11,
    color: INK,
    opacity: 0.65,
  },
  dayCore: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayLabel: {
    color: 'rgba(19,26,42,0.55)',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  dayTitle: {
    color: INK,
    fontFamily: SERIF,
    fontSize: 24,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  daySummary: {
    color: 'rgba(19,26,42,0.72)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  momentList: {
    gap: 10,
  },
  momentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  momentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 7,
  },
  momentTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: '600',
  },
  momentDetail: {
    color: 'rgba(19,26,42,0.66)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  trackingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trackingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(241,236,228,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(241,236,228,0.12)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  trackingLabel: {
    color: PARCHMENT,
    fontSize: 13,
    fontWeight: '600',
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metaStat: {
    flex: 1,
    backgroundColor: 'rgba(241,236,228,0.08)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  metaLabel: {
    color: 'rgba(241,236,228,0.52)',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metaValue: {
    color: PARCHMENT,
    fontSize: 15,
    lineHeight: 20,
  },
  sectionCopy: {
    color: INK,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pillAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  pillActionLabel: {
    color: INK,
    fontSize: 13,
    fontWeight: '600',
  },
  actionList: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19,26,42,0.07)',
  },
  actionLabel: {
    color: INK,
    fontSize: 15,
    fontWeight: '600',
  },
  actionDetail: {
    color: 'rgba(19,26,42,0.56)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetBody: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
  },
  sheetEyebrow: {
    color: 'rgba(19,26,42,0.55)',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(19,26,42,0.04)',
  },
  sheetActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19,26,42,0.06)',
  },
  sheetActionTitle: {
    color: INK,
    fontSize: 15,
    fontWeight: '600',
  },
  sheetActionDetail: {
    color: 'rgba(19,26,42,0.58)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});
