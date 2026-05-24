// Reusable map surface for trip-level views (trip detail, stay detail,
// discover map mode, active trip companion). Uses expo-maps' AppleMaps
// on iOS and renders a graceful text+distance list on other platforms.

import React, { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { haversineKm } from '@/lib/airportCoords';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

export type MapPinKind = 'flight-origin' | 'flight-dest' | 'stay' | 'activity' | 'me';

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  kind: MapPinKind;
  label: string;
  sublabel?: string;
};

export type MapRoute = {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
};

export type TripMapProps = {
  pins: MapPin[];
  route?: MapRoute;
  height?: number;
  /**
   * If provided, the map auto-zooms to the centroid. Otherwise it uses
   * the first pin (or [0,0] if none).
   */
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  /** Optional title rendered as a small header above the map surface. */
  title?: string;
  /** Optional caption rendered below the map. */
  caption?: string;
  onPinPress?: (pin: MapPin) => void;
};

const KIND_META: Record<MapPinKind, { icon: string; accent: string; systemImage: string; label: string }> = {
  'flight-origin': { icon: 'PlaneTakeoff', accent: INK, systemImage: 'airplane.departure', label: 'Depart' },
  'flight-dest': { icon: 'PlaneLanding', accent: BRICK, systemImage: 'airplane.arrival', label: 'Arrive' },
  stay: { icon: 'BedDouble', accent: MOSS, systemImage: 'bed.double.fill', label: 'Stay' },
  activity: { icon: 'MapPin', accent: BRICK, systemImage: 'mappin.circle.fill', label: 'Do' },
  me: { icon: 'Locate', accent: '#2563eb', systemImage: 'location.circle.fill', label: 'You' },
};

/** @deprecated Use boundingBoxCamera instead. Retained for external callers. */
function centroidOf(pins: MapPin[]): { lat: number; lng: number } {
  if (pins.length === 0) return { lat: 0, lng: 0 };
  const sum = pins.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / pins.length, lng: sum.lng / pins.length };
}

/** @deprecated Use boundingBoxCamera instead. Retained for external callers. */
function suggestedZoom(pins: MapPin[]): number {
  if (pins.length <= 1) return 12;
  let maxDist = 0;
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const d = haversineKm(
        { lat: pins[i].lat, lng: pins[i].lng },
        { lat: pins[j].lat, lng: pins[j].lng },
      );
      if (d > maxDist) maxDist = d;
    }
  }
  if (maxDist > 4000) return 3;
  if (maxDist > 1500) return 5;
  if (maxDist > 400) return 7;
  if (maxDist > 100) return 9;
  if (maxDist > 30) return 10;
  if (maxDist > 8) return 12;
  return 13;
}

export default function TripMap(props: TripMapProps) {
  const { pins, height = 220, title, caption, route, onPinPress } = props;
  if (Platform.OS === 'ios') {
    return <IosMap {...props} height={height} pins={pins} route={route} />;
  }
  return <FallbackList pins={pins} title={title} caption={caption} onPinPress={onPinPress} />;
}

/**
 * Compute bounding-box camera {center, zoom} for a set of points.
 * Uses ≥30% padding so pins sit comfortably inside the viewport.
 * Falls back to zoom 12 when only one distinct point exists.
 */
function boundingBoxCamera(
  points: { lat: number; lng: number }[],
): { center: { lat: number; lng: number }; zoom: number } {
  if (points.length === 0) return { center: { lat: 0, lng: 0 }, zoom: 2 };

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const rawLatDelta = maxLat - minLat;
  const rawLngDelta = maxLng - minLng;

  // When all pins are at effectively the same location, default to a local zoom
  if (rawLatDelta < 0.0001 && rawLngDelta < 0.0001) {
    return { center, zoom: 12 };
  }

  // Apply 35% padding on each side (multiply span by 1.35 total)
  const PADDING = 1.35;
  const latitudeDelta = rawLatDelta * PADDING;
  const longitudeDelta = rawLngDelta * PADDING;

  // Standard Mercator zoom: zoom 0 shows 360° of longitude.
  // Each zoom level halves the visible span.
  // We use the larger of longitudeDelta and latitudeDelta×2 (to account for
  // the map viewport being landscape-ish) to ensure both axes are visible.
  const spanDeg = Math.max(longitudeDelta, latitudeDelta * 2);
  const zoom = Math.log2(360 / spanDeg) - 0.5;

  // Clamp to [1, 17]
  const clampedZoom = Math.min(17, Math.max(1, zoom));

  return { center, zoom: clampedZoom };
}

function IosMap({ pins, height, route, title, caption, initialCenter, initialZoom }: TripMapProps) {
  const AppleMapsRef = useAppleMaps();

  const { center, zoom } = useMemo(() => {
    // Caller overrides take precedence
    if (initialCenter && initialZoom !== undefined) {
      return { center: initialCenter, zoom: initialZoom };
    }

    // Single-pin fallback: centre on the pin, zoom 12
    if (pins.length <= 1) {
      const c = initialCenter ?? (pins.length === 1 ? { lat: pins[0].lat, lng: pins[0].lng } : { lat: 0, lng: 0 });
      return { center: c, zoom: initialZoom ?? 12 };
    }

    // Gather all points: pins + route endpoints
    const points: { lat: number; lng: number }[] = pins.map((p) => ({ lat: p.lat, lng: p.lng }));
    if (route) {
      points.push({ lat: route.from.lat, lng: route.from.lng });
      points.push({ lat: route.to.lat, lng: route.to.lng });
    }

    const bb = boundingBoxCamera(points);
    return {
      center: initialCenter ?? bb.center,
      zoom: initialZoom ?? bb.zoom,
    };
  }, [pins, route, initialCenter, initialZoom]);

  if (!AppleMapsRef) {
    return <FallbackList pins={pins} title={title} caption={caption} />;
  }

  const markers = pins.map((p) => ({
    id: p.id,
    coordinates: { latitude: p.lat, longitude: p.lng },
    title: p.label,
    tintColor: KIND_META[p.kind].accent,
    systemImage: KIND_META[p.kind].systemImage,
  }));

  const polylines = route
    ? [
        {
          id: 'route',
          coordinates: [
            { latitude: route.from.lat, longitude: route.from.lng },
            { latitude: route.to.lat, longitude: route.to.lng },
          ],
          color: INK,
          width: 3,
        },
      ]
    : undefined;

  return (
    <View>
      {title ? (
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 18,
            letterSpacing: -0.2,
            marginBottom: 8,
          }}>
          {title}
        </Text>
      ) : null}
      <View
        style={{
          height,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: PARCHMENT_COOL,
        }}>
        <AppleMapsRef.View
          style={{ flex: 1 }}
          cameraPosition={{ coordinates: { latitude: center.lat, longitude: center.lng }, zoom }}
          markers={markers as any}
          polylines={polylines as any}
          properties={{ selectionEnabled: true }}
          uiSettings={{
            compassEnabled: false,
            scaleBarEnabled: false,
            myLocationButtonEnabled: false,
          }}
        />
      </View>
      {caption ? (
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 12,
            marginTop: 6,
            fontStyle: 'italic',
          }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

// Lazy-load expo-maps so the fallback path doesn't drag the native module
// in (and so missing-module errors don't crash the app on other platforms).
function useAppleMaps(): { View: any } | null {
  return useMemo(() => {
    if (Platform.OS !== 'ios') return null;
    try {
      const mod = require('expo-maps');
      return mod.AppleMaps ? { View: mod.AppleMaps.View } : null;
    } catch {
      return null;
    }
  }, []);
}

function FallbackList({
  pins,
  title,
  caption,
  onPinPress,
}: {
  pins: MapPin[];
  title?: string;
  caption?: string;
  onPinPress?: (pin: MapPin) => void;
}) {
  const routeSummary = useMemo(() => {
    if (pins.length < 2) return null;
    const origin = pins.find((p) => p.kind === 'flight-origin') ?? pins[0];
    const dest = pins.find((p) => p.kind === 'flight-dest') ?? pins[pins.length - 1];
    const totalKm = pins.slice(1).reduce((sum, p, i) => {
      return sum + haversineKm({ lat: pins[i].lat, lng: pins[i].lng }, { lat: p.lat, lng: p.lng });
    }, 0);
    const kmStr = totalKm > 100 ? `${Math.round(totalKm)} km` : `${totalKm.toFixed(1)} km`;
    const stayCount = pins.filter((p) => p.kind === 'stay').length;
    const actCount = pins.filter((p) => p.kind === 'activity').length;
    const parts: string[] = [`${origin.label} → ${dest.label}`, kmStr];
    if (stayCount > 0) parts.push(`${stayCount} ${stayCount === 1 ? 'stay' : 'stays'}`);
    if (actCount > 0) parts.push(`${actCount} ${actCount === 1 ? 'activity' : 'activities'}`);
    return parts.join(' · ');
  }, [pins]);

  return (
    <View>
      {title ? (
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 18,
            letterSpacing: -0.2,
            marginBottom: 8,
          }}>
          {title}
        </Text>
      ) : null}
      <View
        className="rounded-3xl p-4"
        style={{ backgroundColor: PARCHMENT_DEEP }}>
        {routeSummary ? (
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.65,
              fontSize: 12,
              fontStyle: 'italic',
              marginBottom: 12,
            }}>
            {routeSummary}
          </Text>
        ) : null}
        {pins.length === 0 ? (
          <View className="items-center py-8">
            <Icon name="MapPin" size={32} color={INK} />
            <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 13, marginTop: 8 }}>
              No locations to plot.
            </Text>
          </View>
        ) : (
          pins.map((p, i) => {
            const meta = KIND_META[p.kind];
            const prev = i > 0 ? pins[i - 1] : null;
            const dist = prev ? haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: p.lat, lng: p.lng }) : 0;
            return (
              <Pressable
                key={p.id}
                onPress={onPinPress ? () => onPinPress(p) : undefined}
                className="flex-row items-start"
                style={{ paddingVertical: 10 }}>
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: meta.accent + '22' }}>
                  <Icon name={meta.icon as any} size={14} color={meta.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View className="flex-row items-baseline">
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        fontSize: 11,
                        opacity: 0.55,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}>
                      {meta.label}
                    </Text>
                    {prev && dist > 0 ? (
                      <Text
                        style={{
                          marginLeft: 6,
                          fontFamily: SERIF,
                          color: INK,
                          opacity: 0.45,
                          fontSize: 11,
                        }}>
                        · {dist > 100 ? `${Math.round(dist)} km` : `${dist.toFixed(1)} km`} from prev
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15, marginTop: 1 }}>
                    {p.label}
                  </Text>
                  {p.sublabel ? (
                    <Text
                      style={{
                        fontFamily: SERIF,
                        color: INK,
                        opacity: 0.55,
                        fontSize: 12,
                        marginTop: 1,
                      }}>
                      {p.sublabel}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </View>
      {caption ? (
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 12,
            marginTop: 6,
            fontStyle: 'italic',
          }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

// ────────── helpers reused by callers ──────────

import { airportCoord } from '@/lib/airportCoords';
import { cityCoord, offsetFromCity } from '@/lib/cityCoords';
import type { SavedActivity } from '@/utils/discoverStorage';
import type { SavedStay } from '@/lib/stayTypes';
import type { StoredOrder } from '@/utils/trackedStorage';

export function pinsFromTrip(opts: {
  order?: StoredOrder | null;
  stays?: SavedStay[];
  activities?: SavedActivity[];
}): { pins: MapPin[]; route?: MapRoute } {
  const pins: MapPin[] = [];
  let route: MapRoute | undefined;
  if (opts.order && opts.order.slices.length > 0) {
    const first = opts.order.slices[0];
    const last = opts.order.slices[opts.order.slices.length - 1];
    const origin = airportCoord(first.origin);
    const dest = airportCoord(first.destination);
    if (origin) pins.push({ id: `o-${first.origin}`, lat: origin.lat, lng: origin.lng, kind: 'flight-origin', label: first.origin, sublabel: `${first.carrierName} ${first.flightNumber}` });
    if (dest) pins.push({ id: `d-${first.destination}`, lat: dest.lat, lng: dest.lng, kind: 'flight-dest', label: first.destination });
    if (origin && dest) route = { from: origin, to: dest };
    const returnDest = airportCoord(last.destination);
    if (last.destination !== first.destination && returnDest) {
      pins.push({ id: `r-${last.destination}`, lat: returnDest.lat, lng: returnDest.lng, kind: 'flight-origin', label: last.destination, sublabel: `${last.carrierName} ${last.flightNumber}` });
    }
  }
  for (const s of opts.stays ?? []) {
    const c = cityCoord(s.cityName) ?? cityCoord(s.city);
    if (!c) continue;
    pins.push({
      id: `s-${s.id}`,
      lat: c.lat,
      lng: c.lng,
      kind: 'stay',
      label: s.name,
      sublabel: s.neighborhood ?? s.cityName,
    });
  }
  for (let i = 0; i < (opts.activities ?? []).length; i++) {
    const a = (opts.activities ?? [])[i];
    const c = cityCoord(a.city);
    if (!c) continue;
    const offset = offsetFromCity(c, i + 1, 2.2);
    pins.push({
      id: `a-${a.id}`,
      lat: offset.lat,
      lng: offset.lng,
      kind: 'activity',
      label: a.title,
      sublabel: a.area,
    });
  }
  return { pins, route };
}
