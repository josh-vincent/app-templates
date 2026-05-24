import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Bundle,
  BundleItemRef,
  Deal,
  DealActivityLine,
  DealFlightLine,
  DealLine,
  DealStayLine,
  DealStrategy,
} from '@/lib/bundleTypes';
import { listSavedActivities, type SavedActivity } from '@/utils/discoverStorage';
import { listSavedStays } from '@/utils/staysStorage';
import { listTracked, type TrackedRoute } from '@/utils/trackedStorage';
import type { SavedStay } from '@/lib/stayTypes';

const KEY = '@voyage/bundles';

// ─── id helpers ────────────────────────────────────────────────────────────

function newBundleId(): string {
  return `bundle_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sameRef(a: BundleItemRef, b: BundleItemRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'stay' && b.kind === 'stay') return a.savedStayId === b.savedStayId;
  if (a.kind === 'activity' && b.kind === 'activity')
    return a.savedActivityId === b.savedActivityId;
  if (a.kind === 'flight' && b.kind === 'flight') return a.trackedRouteId === b.trackedRouteId;
  return false;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function listBundles(): Promise<Bundle[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bundle[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function writeAll(bundles: Bundle[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(bundles));
}

export async function getBundleById(id: string): Promise<Bundle | null> {
  const all = await listBundles();
  return all.find((b) => b.id === id) ?? null;
}

export async function createBundle(input: {
  name: string;
  dateRange?: { from: string; to: string };
  cities?: string[];
  notes?: string;
  coverPhoto?: string;
}): Promise<Bundle> {
  const all = await listBundles();
  const now = Date.now();
  const bundle: Bundle = {
    id: newBundleId(),
    name: input.name.trim() || 'New bundle',
    createdAt: now,
    updatedAt: now,
    dateRange: input.dateRange,
    cities: input.cities,
    items: [],
    notes: input.notes,
    coverPhoto: input.coverPhoto,
  };
  await writeAll([bundle, ...all]);
  return bundle;
}

export async function updateBundle(
  id: string,
  patch: Partial<Omit<Bundle, 'id' | 'createdAt'>>,
): Promise<Bundle | null> {
  const all = await listBundles();
  const idx = all.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  const updated: Bundle = { ...all[idx], ...patch, updatedAt: Date.now() };
  const next = [...all.slice(0, idx), updated, ...all.slice(idx + 1)];
  await writeAll(next);
  return updated;
}

export async function deleteBundle(id: string): Promise<void> {
  const all = await listBundles();
  await writeAll(all.filter((b) => b.id !== id));
}

export async function addToBundle(id: string, ref: BundleItemRef): Promise<Bundle | null> {
  const b = await getBundleById(id);
  if (!b) return null;
  if (b.items.some((r) => sameRef(r, ref))) return b;
  return updateBundle(id, { items: [...b.items, ref] });
}

export async function removeFromBundle(id: string, ref: BundleItemRef): Promise<Bundle | null> {
  const b = await getBundleById(id);
  if (!b) return null;
  return updateBundle(id, { items: b.items.filter((r) => !sameRef(r, ref)) });
}

export async function bundlesContaining(ref: BundleItemRef): Promise<Bundle[]> {
  const all = await listBundles();
  return all.filter((b) => b.items.some((r) => sameRef(r, ref)));
}

// ─── resolution + deal scoring ─────────────────────────────────────────────

type Resolved = {
  stays: Array<{ ref: BundleItemRef; record: SavedStay }>;
  activities: Array<{ ref: BundleItemRef; record: SavedActivity }>;
  flights: Array<{ ref: BundleItemRef; record: TrackedRoute }>;
};

async function resolveBundle(b: Bundle): Promise<Resolved> {
  const [savedStays, savedActivities, tracked] = await Promise.all([
    listSavedStays(),
    listSavedActivities(),
    listTracked(),
  ]);
  const out: Resolved = { stays: [], activities: [], flights: [] };
  for (const ref of b.items) {
    if (ref.kind === 'stay') {
      const rec = savedStays.find((s) => s.id === ref.savedStayId);
      if (rec) out.stays.push({ ref, record: rec });
    } else if (ref.kind === 'activity') {
      const rec = savedActivities.find((a) => a.id === ref.savedActivityId);
      if (rec) out.activities.push({ ref, record: rec });
    } else if (ref.kind === 'flight') {
      const rec = tracked.find((t) => t.id === ref.trackedRouteId);
      if (rec) out.flights.push({ ref, record: rec });
    }
  }
  return out;
}

function nightsForBundle(b: Bundle, fallbackFromStay: SavedStay | undefined): number {
  if (b.dateRange) {
    const from = Date.parse(b.dateRange.from);
    const to = Date.parse(b.dateRange.to);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      return Math.max(1, Math.round((to - from) / 86_400_000));
    }
  }
  if (fallbackFromStay) {
    const from = Date.parse(fallbackFromStay.checkIn);
    const to = Date.parse(fallbackFromStay.checkOut);
    if (Number.isFinite(from) && Number.isFinite(to)) {
      return Math.max(1, Math.round((to - from) / 86_400_000));
    }
  }
  return 3;
}

function stayLine(s: SavedStay, nights: number): DealStayLine {
  const pricePerNight = s.pricePerNight;
  const totalAmount = Math.round(pricePerNight * nights);
  return {
    kind: 'stay',
    savedStayId: s.id,
    name: s.name,
    cityName: s.cityName,
    rating: s.rating,
    reviewCount: 0, // SavedStay doesn't denormalize reviewCount; treat as 0 for the deal scoring
    pricePerNight,
    totalAmount,
    currency: s.currency,
    nights,
    coverPhoto: s.coverPhoto,
  };
}

function activityLine(a: SavedActivity): DealActivityLine {
  return {
    kind: 'activity',
    savedActivityId: a.id,
    title: a.title,
    area: a.area,
    priceLevel: a.priceLevel,
    photo: a.photo,
  };
}

function flightLine(t: TrackedRoute): DealFlightLine {
  return {
    kind: 'flight',
    trackedRouteId: t.id,
    origin: t.origin,
    destination: t.destination,
    lastPrice: Math.round(t.lastPrice),
    lowestPrice: Math.round(t.lowestPrice ?? t.lastPrice),
    currency: t.currency,
  };
}

function ACTIVITY_PROXY_COST(level: 1 | 2 | 3): number {
  // Activities don't have a real price field — proxy via priceLevel * $25.
  return level * 25;
}

function dealSummary(lines: DealLine[]): {
  totalUSD: number;
  averageRating: number;
  totalReviews: number;
  nights: number;
  stayCount: number;
  activityCount: number;
  flightCount: number;
} {
  let totalUSD = 0;
  let ratingSum = 0;
  let ratingN = 0;
  let totalReviews = 0;
  let nights = 0;
  let stayCount = 0;
  let activityCount = 0;
  let flightCount = 0;
  for (const ln of lines) {
    if (ln.kind === 'stay') {
      totalUSD += ln.totalAmount;
      ratingSum += ln.rating;
      ratingN += 1;
      totalReviews += ln.reviewCount;
      nights = Math.max(nights, ln.nights);
      stayCount += 1;
    } else if (ln.kind === 'activity') {
      totalUSD += ACTIVITY_PROXY_COST(ln.priceLevel);
      activityCount += 1;
    } else if (ln.kind === 'flight') {
      totalUSD += ln.lastPrice;
      flightCount += 1;
    }
  }
  return {
    totalUSD: Math.round(totalUSD),
    averageRating: ratingN > 0 ? Math.round((ratingSum / ratingN) * 10) / 10 : 0,
    totalReviews,
    nights,
    stayCount,
    activityCount,
    flightCount,
  };
}

function captionFor(strategy: DealStrategy, s: ReturnType<typeof dealSummary>): string {
  const bits: string[] = [];
  if (s.flightCount > 0) bits.push(`${s.flightCount} flight${s.flightCount > 1 ? 's' : ''}`);
  if (s.stayCount > 0) bits.push(`${s.nights || 1} night${(s.nights || 1) > 1 ? 's' : ''}`);
  if (s.activityCount > 0)
    bits.push(`${s.activityCount} thing${s.activityCount > 1 ? 's' : ''} to do`);
  const itinerary = bits.length > 0 ? bits.join(' + ') : 'empty';

  const headline =
    strategy === 'cheapest'
      ? 'Cheapest combo'
      : strategy === 'best_rated'
        ? 'Highest rated'
        : strategy === 'most_reviewed'
          ? 'Most reviewed'
          : 'Best balanced';
  return `${headline} · ${itinerary} · $${s.totalUSD.toLocaleString()}`;
}

// ─── strategy pickers ──────────────────────────────────────────────────────
// Each strategy picks ONE stay (if any), ONE flight (if any — the cheapest
// tracked-route is the natural pick), and all activities (they're additive,
// the user wants to do everything they favourited).

function pickStayBy(stays: SavedStay[], strategy: DealStrategy): SavedStay | undefined {
  if (stays.length === 0) return undefined;
  const sorted = [...stays];
  if (strategy === 'cheapest') sorted.sort((a, b) => a.pricePerNight - b.pricePerNight);
  else if (strategy === 'best_rated') sorted.sort((a, b) => b.rating - a.rating);
  else if (strategy === 'most_reviewed')
    // SavedStay doesn't carry reviewCount; fall back to rating as a proxy
    sorted.sort((a, b) => b.rating - a.rating);
  else if (strategy === 'balanced') {
    // Normalize price (lower better) + rating (higher better) then combine
    const minP = Math.min(...stays.map((s) => s.pricePerNight));
    const maxP = Math.max(...stays.map((s) => s.pricePerNight));
    const range = Math.max(1, maxP - minP);
    sorted.sort((a, b) => {
      const sa = a.rating / 5 - (a.pricePerNight - minP) / range;
      const sb = b.rating / 5 - (b.pricePerNight - minP) / range;
      return sb - sa;
    });
  }
  return sorted[0];
}

function pickFlightBy(flights: TrackedRoute[]): TrackedRoute | undefined {
  if (flights.length === 0) return undefined;
  // The flight is essentially a date-constrained leg; pick the lowest current price.
  return [...flights].sort((a, b) => a.lastPrice - b.lastPrice)[0];
}

// ─── public deal evaluation ────────────────────────────────────────────────

export async function evaluateBundle(id: string): Promise<{
  bundle: Bundle | null;
  deals: Deal[];
}> {
  const bundle = await getBundleById(id);
  if (!bundle) return { bundle: null, deals: [] };
  const resolved = await resolveBundle(bundle);

  const stays = resolved.stays.map((r) => r.record);
  const activities = resolved.activities.map((r) => r.record);
  const flights = resolved.flights.map((r) => r.record);

  if (stays.length + activities.length + flights.length === 0) {
    return { bundle, deals: [] };
  }

  const strategies: DealStrategy[] = ['cheapest', 'best_rated', 'most_reviewed', 'balanced'];
  const deals: Deal[] = strategies.map((strategy) => {
    const stayPick = pickStayBy(stays, strategy);
    const flightPick = pickFlightBy(flights);
    const nights = nightsForBundle(bundle, stayPick);

    const lines: DealLine[] = [];
    if (flightPick) lines.push(flightLine(flightPick));
    if (stayPick) lines.push(stayLine(stayPick, nights));
    for (const a of activities) lines.push(activityLine(a));

    const summary = dealSummary(lines);

    return {
      bundleId: bundle.id,
      strategy,
      lines,
      totalUSD: summary.totalUSD,
      averageRating: summary.averageRating,
      totalReviews: summary.totalReviews,
      caption: captionFor(strategy, summary),
    };
  });

  return { bundle, deals };
}

// ─── helpers exposed for UI ────────────────────────────────────────────────

export async function countItems(b: Bundle): Promise<{
  stays: number;
  activities: number;
  flights: number;
}> {
  let stays = 0;
  let activities = 0;
  let flights = 0;
  for (const r of b.items) {
    if (r.kind === 'stay') stays++;
    else if (r.kind === 'activity') activities++;
    else if (r.kind === 'flight') flights++;
  }
  return { stays, activities, flights };
}
