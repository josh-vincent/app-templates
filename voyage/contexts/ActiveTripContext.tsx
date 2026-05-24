import * as Location from 'expo-location';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';

import { getActiveTrip, getTripDayIndex, type ActiveTrip } from '@/lib/activeTrip';
import {
  getTripCompanionSession,
  listOrders,
  saveTripCompanionSession,
  subscribeTripState,
  type TripCompanionSession,
  type TripLocationSnapshot,
} from '@/utils/trackedStorage';

type LocationPermissionState = 'unknown' | 'granted' | 'denied';

type ActiveTripContextValue = {
  activeTrip: ActiveTrip | null;
  session: TripCompanionSession | null;
  selectedDayIndex: number;
  isExpanded: boolean;
  locationPermission: LocationPermissionState;
  expand: () => void;
  collapse: () => void;
  selectDay: (index: number) => void;
  goToNextDay: () => void;
  goToPreviousDay: () => void;
  startTracking: () => Promise<boolean>;
  pauseTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ActiveTripContext = createContext<ActiveTripContextValue | undefined>(undefined);

const DEFAULT_SESSION = (tripId: string, selectedDayIndex = 0): TripCompanionSession => ({
  tripId,
  selectedDayIndex,
  trackingState: 'idle',
});

export function ActiveTripProvider({ children }: { children: React.ReactNode }) {
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [session, setSession] = useState<TripCompanionSession | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>('unknown');
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const activeTripRef = useRef<ActiveTrip | null>(null);
  const sessionRef = useRef<TripCompanionSession | null>(null);

  const persistSession = useCallback(async (nextSession: TripCompanionSession | null) => {
    setSession(nextSession);
    if (nextSession) await saveTripCompanionSession(nextSession);
  }, []);

  const stopWatcher = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    const orders = await listOrders();
    const nextTrip = getActiveTrip(orders);
    setActiveTrip(nextTrip);

    if (!nextTrip) {
      stopWatcher();
      setSession(null);
      setIsExpanded(false);
      return;
    }

    const storedSession = (await getTripCompanionSession(nextTrip.tripId)) ?? null;
    const derivedDay = getTripDayIndex(nextTrip);
    const nextSession = storedSession
      ? {
          ...storedSession,
          selectedDayIndex: clamp(storedSession.selectedDayIndex, 0, nextTrip.days.length - 1),
        }
      : DEFAULT_SESSION(nextTrip.tripId, derivedDay);

    setSession(nextSession);
  }, [stopWatcher]);

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const ensurePermission = useCallback(async () => {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) {
      setLocationPermission('granted');
      return true;
    }

    const requested = await Location.requestForegroundPermissionsAsync();
    const granted = requested.granted;
    setLocationPermission(granted ? 'granted' : 'denied');
    if (!granted) {
      Alert.alert(
        'Location needed',
        'Enable location access to start trip tracking and use nearby suggestions.'
      );
    }
    return granted;
  }, []);

  const handleLocationUpdate = useCallback(async (location: Location.LocationObject) => {
    const currentTrip = activeTripRef.current;
    if (!currentTrip) return;

    const snapshot: TripLocationSnapshot = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
      recordedAt: location.timestamp || Date.now(),
    };

    const nextSession: TripCompanionSession = {
      ...(sessionRef.current ?? DEFAULT_SESSION(currentTrip.tripId, getTripDayIndex(currentTrip))),
      tripId: currentTrip.tripId,
      trackingState: 'tracking',
      startedAt: sessionRef.current?.startedAt ?? Date.now(),
      pausedAt: undefined,
      latestLocation: snapshot,
    };

    setSession(nextSession);
    await saveTripCompanionSession(nextSession);
  }, []);

  const beginWatcher = useCallback(async () => {
    stopWatcher();
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 40,
      },
      (location) => {
        handleLocationUpdate(location).catch(() => {});
      }
    );
  }, [handleLocationUpdate, stopWatcher]);

  const startTracking = useCallback(async () => {
    if (!activeTrip) return false;
    const granted = await ensurePermission();
    if (!granted) return false;

    await beginWatcher();
    const nextSession: TripCompanionSession = {
      ...(session ?? DEFAULT_SESSION(activeTrip.tripId, getTripDayIndex(activeTrip))),
      tripId: activeTrip.tripId,
      trackingState: 'tracking',
      startedAt: session?.startedAt ?? Date.now(),
      pausedAt: undefined,
    };
    await persistSession(nextSession);
    return true;
  }, [activeTrip, beginWatcher, ensurePermission, persistSession, session]);

  const pauseTracking = useCallback(async () => {
    if (!activeTrip || !session) return;
    stopWatcher();
    await persistSession({
      ...session,
      tripId: activeTrip.tripId,
      trackingState: 'paused',
      pausedAt: Date.now(),
    });
  }, [activeTrip, persistSession, session, stopWatcher]);

  const stopTracking = useCallback(async () => {
    if (!activeTrip) return;
    stopWatcher();
    await persistSession({
      ...(session ?? DEFAULT_SESSION(activeTrip.tripId, getTripDayIndex(activeTrip))),
      tripId: activeTrip.tripId,
      trackingState: 'idle',
      startedAt: undefined,
      pausedAt: undefined,
      latestLocation: null,
    });
  }, [activeTrip, persistSession, session, stopWatcher]);

  const selectDay = useCallback(
    (index: number) => {
      if (!activeTrip || !session) return;
      const next = {
        ...session,
        tripId: activeTrip.tripId,
        selectedDayIndex: clamp(index, 0, activeTrip.days.length - 1),
      };
      persistSession(next).catch(() => {});
    },
    [activeTrip, persistSession, session]
  );

  const goToNextDay = useCallback(() => {
    if (!session) return;
    selectDay(session.selectedDayIndex + 1);
  }, [selectDay, session]);

  const goToPreviousDay = useCallback(() => {
    if (!session) return;
    selectDay(session.selectedDayIndex - 1);
  }, [selectDay, session]);

  const expand = useCallback(() => setIsExpanded(true), []);
  const collapse = useCallback(() => setIsExpanded(false), []);

  useEffect(() => {
    refresh().catch(() => {});
    const unsubscribe = subscribeTripState(() => {
      refresh().catch(() => {});
    });

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh().catch(() => {});
    });

    return () => {
      unsubscribe();
      sub.remove();
      stopWatcher();
    };
  }, [refresh, stopWatcher]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        setLocationPermission(permission.granted ? 'granted' : 'denied');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeTrip || !session) return;
    if (session.tripId !== activeTrip.tripId) return;
    if (session.selectedDayIndex >= 0 && session.selectedDayIndex < activeTrip.days.length) return;

    const next = {
      ...session,
      selectedDayIndex: clamp(session.selectedDayIndex, 0, activeTrip.days.length - 1),
    };
    persistSession(next).catch(() => {});
  }, [activeTrip, persistSession, session]);

  useEffect(() => {
    if (!activeTrip || !session) return;
    if (session.trackingState !== 'tracking') {
      stopWatcher();
      return;
    }

    beginWatcher().catch(() => {});
  }, [activeTrip?.tripId, beginWatcher, session?.trackingState, stopWatcher]);

  const value = useMemo<ActiveTripContextValue>(
    () => ({
      activeTrip,
      session,
      selectedDayIndex: session?.selectedDayIndex ?? (activeTrip ? getTripDayIndex(activeTrip) : 0),
      isExpanded,
      locationPermission,
      expand,
      collapse,
      selectDay,
      goToNextDay,
      goToPreviousDay,
      startTracking,
      pauseTracking,
      stopTracking,
      refresh,
    }),
    [
      activeTrip,
      session,
      isExpanded,
      locationPermission,
      expand,
      collapse,
      selectDay,
      goToNextDay,
      goToPreviousDay,
      startTracking,
      pauseTracking,
      stopTracking,
      refresh,
    ]
  );

  return <ActiveTripContext.Provider value={value}>{children}</ActiveTripContext.Provider>;
}

export function useActiveTrip() {
  const context = useContext(ActiveTripContext);
  if (!context) {
    throw new Error('useActiveTrip must be used within an ActiveTripProvider');
  }
  return context;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
