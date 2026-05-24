import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Input from '@/components/forms/Input';
import MultiStep, { Step } from '@/components/MultiStep';
import Section from '@/components/layout/Section';
import ThemedText from '@/components/ThemedText';
import { Chip } from '@/components/Chip';
import Icon from '@/components/Icon';
import type { BookedPassenger, FlightOffer } from '@/lib/flightTypes';
import { api } from '@/lib/apiBase';
import { getStayById } from '@/lib/stays';
import type { StayOffer, SavedStay } from '@/lib/stayTypes';
import { findAirport } from '@/lib/airports';
import { listTrips, linkStayToTrip, saveTrip } from '@/utils/tripStorage';
import type { Trip } from '@/lib/tripTypes';
import { saveOrder, markTrackedBooked, type StoredOrder } from '@/utils/trackedStorage';
import { saveStay as persistStay } from '@/utils/staysStorage';
import { getOwnerProfile, listProfiles } from '@/utils/travelerProfileStorage';
import type { TravelerProfile, DietaryCode, Passport, FrequentFlyer } from '@/lib/travelerProfileTypes';
import { DIETARY_LABEL, SEAT_PREFERENCE_LABEL, BAG_PREFERENCE_LABEL } from '@/lib/travelerProfileTypes';
import {
  BAG_OPTIONS,
  SEAT_OPTIONS,
  MEAL_OPTIONS,
  EXTRA_OPTIONS,
  type AncillaryPicks,
  type BagOption,
  type SeatOption,
  type MealOption,
  type ExtraOption,
  ancillariesTotalUSD,
  emptyPicks,
  defaultBagIdsForPreference,
  defaultSeatIdForPreference,
  defaultMealIdsForDietary,
} from '@/lib/duffelAncillaries';
import { addNotification } from '@/utils/notificationsStorage';
import { INK, BRICK, MOSS, PARCHMENT, SERIF } from '@/lib/theme';

type CheckoutKind = 'flight' | 'stay';

export default function Checkout() {
  const params = useLocalSearchParams<{
    kind?: CheckoutKind;
    offerId?: string;
    trackedId?: string;
    stayId?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    rooms?: string;
    tripId?: string;
  }>();
  const kind: CheckoutKind = params.kind === 'stay' || params.stayId ? 'stay' : 'flight';
  if (kind === 'stay' && params.stayId) {
    return (
      <StayCheckout
        stayId={String(params.stayId)}
        checkIn={String(params.checkIn ?? '')}
        checkOut={String(params.checkOut ?? '')}
        guests={params.guests ? Number(params.guests) : 2}
        rooms={params.rooms ? Number(params.rooms) : 1}
        tripIdHint={params.tripId ? String(params.tripId) : undefined}
      />
    );
  }
  return (
    <FlightCheckout
      offerId={String(params.offerId ?? '')}
      trackedId={params.trackedId ? String(params.trackedId) : undefined}
    />
  );
}

// ─── Flight checkout ───────────────────────────────────────────────────────────

type PassengerForm = Omit<BookedPassenger, 'id'> & {
  id?: string;
  // Extended fields (local-only; Duffel test-mode ignores them)
  passport?: Passport;
  frequentFlyers?: FrequentFlyer[];
  dietary?: DietaryCode[];
  seatPreference?: string;
  bagPreference?: string;
  knownTravellerNumber?: string;
};

async function fetchOffer(id: string): Promise<FlightOffer> {
  const res = await fetch(api('/api/flights/offer'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Could not load offer');
  return (await res.json()).offer;
}

async function createOrder(body: unknown) {
  const res = await fetch(api('/api/flights/order'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Order creation failed');
  return data.order;
}

const emptyPassenger = (): PassengerForm => ({
  type: 'adult',
  title: 'mr',
  given_name: '',
  family_name: '',
  born_on: '',
  email: '',
  phone_number: '',
  gender: 'm',
});

// ─── Quick-fill helpers ───────────────────────────────────────────────────────

function profileChipLabel(p: TravelerProfile): string {
  const name = p.givenName || p.familyName ? `${p.givenName} ${p.familyName}`.trim() : 'Unknown';
  if (p.isOwner) return `✦ Use ${name} (you)`;
  return p.nickname ? `Use ${p.nickname}` : `Use ${name}`;
}

function passengerFromProfile(p: TravelerProfile): PassengerForm {
  return {
    type: 'adult',
    title: p.title,
    given_name: p.givenName,
    family_name: p.familyName,
    born_on: p.bornOn,
    email: p.email,
    phone_number: p.phoneNumber,
    // BookedPassenger only accepts 'm' | 'f'; map 'x' (non-binary) to 'm' as Duffel test-mode best effort
    gender: p.gender === 'x' ? 'm' : p.gender,
    passport: p.passport,
    frequentFlyers: p.frequentFlyers.length ? p.frequentFlyers : undefined,
    dietary: p.dietary.length ? [...p.dietary] : undefined,
    seatPreference: p.seatPreference,
    bagPreference: p.bagPreference,
    knownTravellerNumber: p.knownTravellerNumber,
  };
}

// ─── Ancillary row sub-components ─────────────────────────────────────────────

function BagRow({
  option,
  selected,
  onToggle,
}: {
  option: BagOption;
  selected: boolean;
  onToggle: () => void;
}) {
  const iconName = option.kind === 'carry_on' ? 'Briefcase' : option.kind === 'pet' ? 'PawPrint' : 'Luggage';
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.75}
      className={`flex-row items-center p-3 mb-2 rounded-2xl border ${selected ? 'border-moss bg-moss/10' : 'border-light-secondary dark:border-dark-secondary bg-light-primary dark:bg-dark-secondary'}`}
    >
      <View className="mr-3">
        <Icon name={iconName as any} size={20} color={selected ? MOSS : undefined} />
      </View>
      <View className="flex-1">
        <ThemedText className={`font-semibold text-sm ${selected ? 'text-moss' : ''}`}>
          {option.label}
        </ThemedText>
        <ThemedText className="text-xs opacity-60 mt-0.5">{option.description}</ThemedText>
        <ThemedText className="text-xs opacity-50 mt-0.5">{option.weightKg} kg</ThemedText>
      </View>
      <ThemedText className={`font-bold text-sm ml-2 ${selected ? 'text-moss' : ''}`}>
        {option.priceUSD === 0 ? 'Free' : `$${option.priceUSD}`}
      </ThemedText>
    </TouchableOpacity>
  );
}

function ExtraRow({
  option,
  selected,
  onToggle,
}: {
  option: ExtraOption;
  selected: boolean;
  onToggle: () => void;
}) {
  const iconMap: Record<ExtraOption['kind'], string> = {
    priority_boarding: 'ArrowUpToLine',
    lounge: 'Armchair',
    fast_track: 'Zap',
    wifi: 'Wifi',
    travel_insurance: 'ShieldCheck',
    carbon_offset: 'Leaf',
  };
  const iconName = iconMap[option.kind] ?? 'Star';
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.75}
      className={`flex-row items-center p-3 mb-2 rounded-2xl border ${selected ? 'border-moss bg-moss/10' : 'border-light-secondary dark:border-dark-secondary bg-light-primary dark:bg-dark-secondary'}`}
    >
      <View className="mr-3">
        <Icon name={iconName as any} size={20} color={selected ? MOSS : undefined} />
      </View>
      <View className="flex-1">
        <ThemedText className={`font-semibold text-sm ${selected ? 'text-moss' : ''}`}>
          {option.label}
        </ThemedText>
        <ThemedText className="text-xs opacity-60 mt-0.5">{option.description}</ThemedText>
      </View>
      <ThemedText className={`font-bold text-sm ml-2 ${selected ? 'text-moss' : ''}`}>
        {option.priceUSD === 0 ? 'Free' : `$${option.priceUSD}`}
      </ThemedText>
    </TouchableOpacity>
  );
}

// ─── FlightCheckout component ─────────────────────────────────────────────────

function FlightCheckout({ offerId, trackedId }: { offerId: string; trackedId?: string }) {
  const q = useQuery({
    queryKey: ['offer', offerId],
    queryFn: () => fetchOffer(offerId),
    enabled: !!offerId,
  });
  const [passenger, setPassenger] = useState<PassengerForm>(emptyPassenger);
  const [picks, setPicks] = useState<AncillaryPicks>(emptyPicks());
  const [submitting, setSubmitting] = useState(false);

  // Profile quick-fill state
  const [profiles, setProfiles] = useState<TravelerProfile[]>([]);
  const [showPassport, setShowPassport] = useState(false);
  const [showFrequentFlyer, setShowFrequentFlyer] = useState(false);
  const [showDietary, setShowDietary] = useState(false);
  const [showKTN, setShowKTN] = useState(false);

  const offer = q.data;
  const passengerIds = useMemo(() => offer?.passengerIds ?? [], [offer]);

  // Load profiles once
  useEffect(() => {
    (async () => {
      const all = await listProfiles();
      // Put owner first
      setProfiles([...all.filter((p) => p.isOwner), ...all.filter((p) => !p.isOwner)]);
    })();
  }, []);

  if (q.isLoading || !offer) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const updateField = <K extends keyof PassengerForm>(k: K, v: PassengerForm[K]) =>
    setPassenger((p) => ({ ...p, [k]: v }));

  const applyProfile = (profile: TravelerProfile) => {
    setPassenger(passengerFromProfile(profile));
    // Auto-show sub-sections that have data
    if (profile.passport?.number) setShowPassport(true);
    if (profile.frequentFlyers.length) setShowFrequentFlyer(true);
    if (profile.dietary.length) setShowDietary(true);
    if (profile.knownTravellerNumber) setShowKTN(true);
    // Pre-fill ancillary picks from profile preferences
    setPicks((prev) => ({
      ...prev,
      bagIds: defaultBagIdsForPreference(profile.bagPreference),
      seatIds: defaultSeatIdForPreference(profile.seatPreference),
      mealIds: defaultMealIdsForDietary(profile.dietary),
    }));
  };

  const toggleBag = (id: string) => {
    setPicks((p) => ({
      ...p,
      bagIds: p.bagIds.includes(id) ? p.bagIds.filter((x) => x !== id) : [...p.bagIds, id],
    }));
  };

  const selectSeat = (id: string) => {
    setPicks((p) => ({ ...p, seatIds: [id] }));
  };

  const toggleMeal = (id: string) => {
    setPicks((p) => ({
      ...p,
      mealIds: p.mealIds.includes(id) ? p.mealIds.filter((x) => x !== id) : [...p.mealIds, id],
    }));
  };

  const toggleExtra = (id: string) => {
    setPicks((p) => ({
      ...p,
      extraIds: p.extraIds.includes(id) ? p.extraIds.filter((x) => x !== id) : [...p.extraIds, id],
    }));
  };

  const bagSubtotal = picks.bagIds.reduce((s, id) => {
    const opt = BAG_OPTIONS.find((b) => b.id === id);
    return s + (opt?.priceUSD ?? 0);
  }, 0);

  const ancillaryTotal = ancillariesTotalUSD(picks);
  const baseAmount = parseFloat(offer.totalAmount || '0');
  const grandTotal = baseAmount + ancillaryTotal;

  const selectedSeat = SEAT_OPTIONS.find((s) => picks.seatIds.includes(s.id));
  const selectedBags = BAG_OPTIONS.filter((b) => picks.bagIds.includes(b.id));
  const selectedMeals = MEAL_OPTIONS.filter((m) => picks.mealIds.includes(m.id));
  const selectedExtras = EXTRA_OPTIONS.filter((e) => picks.extraIds.includes(e.id));

  const onComplete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const passengers = passengerIds.map((pid) => ({
        ...passenger,
        id: pid,
        // Strip extended fields that Duffel doesn't accept
        passport: undefined,
        frequentFlyers: undefined,
        dietary: undefined,
        seatPreference: undefined,
        bagPreference: undefined,
        knownTravellerNumber: undefined,
      })) as BookedPassenger[];
      const order = await createOrder({
        offerId: offer.id,
        amount: offer.totalAmount,
        currency: offer.totalCurrency,
        passengers,
      });
      const stored: StoredOrder = {
        id: order.id,
        bookingReference: order.booking_reference,
        totalAmount: offer.totalAmount,
        totalCurrency: offer.totalCurrency,
        passengerName: `${passenger.given_name} ${passenger.family_name}`.trim(),
        slices: offer.slices.flatMap((s) =>
          s.segments.map((seg) => ({
            origin: seg.origin,
            destination: seg.destination,
            departing_at: seg.departing_at,
            arriving_at: seg.arriving_at,
            carrierName: seg.marketingCarrierName,
            flightNumber: seg.flightNumber,
            carrierCode: seg.marketingCarrier,
          })),
        ),
        createdAt: Date.now(),
        trackedId: trackedId,
      };
      await saveOrder(stored);
      if (trackedId) await markTrackedBooked(trackedId, stored.id);

      // Persist ancillary picks alongside the order under a sibling key
      const extrasKey = '@voyage/order-extras';
      const extrasRaw = await AsyncStorage.getItem(extrasKey);
      const extrasAll: Array<{ orderId: string; picks: AncillaryPicks }> = extrasRaw
        ? JSON.parse(extrasRaw)
        : [];
      extrasAll.unshift({ orderId: stored.id, picks });
      await AsyncStorage.setItem(extrasKey, JSON.stringify(extrasAll));

      // Notification with ancillary summary
      const bagSummary = selectedBags.length
        ? selectedBags.map((b) => b.label).join(', ')
        : 'None';
      const seatSummary = selectedSeat ? selectedSeat.label : 'Standard (assigned at check-in)';
      const mealSummary = selectedMeals.length
        ? selectedMeals.map((m) => m.label).join(', ')
        : 'Standard';
      await addNotification({
        type: 'booking',
        title: 'Booked + ancillaries',
        message: `Bags: ${bagSummary}. Seat: ${seatSummary}. Meals: ${mealSummary}.`,
        time: new Date().toISOString(),
        icon: 'PlaneTakeoff',
        refs: { orderId: stored.id },
      });

      // Trip umbrella
      try {
        const { upsertTripFromOrder } = await import('@/utils/tripStorage');
        await upsertTripFromOrder(stored);
      } catch {
        // trip layer is best-effort
      }
      router.replace({ pathname: '/screens/order-detail', params: { id: stored.id } });
    } catch (e: any) {
      Alert.alert('Booking failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MultiStep onComplete={onComplete} onClose={() => router.back()} showHeader>
      {/* ── Step 1: Passenger ── */}
      <Step title="Passenger">
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          <Section title="Passenger details" titleSize="2xl" subtitle="Matches Duffel test-mode format" className="mt-2 mb-4" />

          {/* Quick fill bar */}
          {profiles.length > 0 && (
            <View className="mb-4">
              <ThemedText className="text-xs font-semibold opacity-50 mb-2 uppercase tracking-wide">
                Quick fill
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {profiles.map((p) => (
                  <View key={p.id} className="mr-2">
                    <Chip
                      label={profileChipLabel(p)}
                      onPress={() => applyProfile(p)}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <Input label="First name" value={passenger.given_name} onChangeText={(v: string) => updateField('given_name', v)} />
          <Input label="Last name" value={passenger.family_name} onChangeText={(v: string) => updateField('family_name', v)} />
          <Input label="Date of birth (YYYY-MM-DD)" value={passenger.born_on} onChangeText={(v: string) => updateField('born_on', v)} />
          <Input label="Email" keyboardType="email-address" value={passenger.email} onChangeText={(v: string) => updateField('email', v)} />
          <Input label="Phone number (+E.164)" keyboardType="phone-pad" value={passenger.phone_number} onChangeText={(v: string) => updateField('phone_number', v)} />

          {/* Optional sub-section toggles */}
          <View className="flex-row flex-wrap gap-2 mt-4 mb-2">
            <Chip
              label={showPassport ? '− Passport' : '+ Passport'}
              isSelected={showPassport}
              onPress={() => setShowPassport((v) => !v)}
              size="sm"
            />
            <Chip
              label={showFrequentFlyer ? '− Frequent flyer' : '+ Frequent flyer'}
              isSelected={showFrequentFlyer}
              onPress={() => setShowFrequentFlyer((v) => !v)}
              size="sm"
            />
            <Chip
              label={showDietary ? '− Dietary' : '+ Dietary'}
              isSelected={showDietary}
              onPress={() => setShowDietary((v) => !v)}
              size="sm"
            />
            <Chip
              label={showKTN ? '− Known Traveller' : '+ Known Traveller Number'}
              isSelected={showKTN}
              onPress={() => setShowKTN((v) => !v)}
              size="sm"
            />
          </View>

          {/* Passport sub-section */}
          {showPassport && (
            <View className="mt-2 p-3 rounded-2xl bg-light-secondary dark:bg-dark-secondary mb-2">
              <ThemedText className="font-semibold text-sm mb-2">Passport</ThemedText>
              <Input
                label="Passport number"
                value={passenger.passport?.number ?? ''}
                onChangeText={(v: string) =>
                  updateField('passport', { ...(passenger.passport ?? { countryCode: '', expiresOn: '' }), number: v })
                }
              />
              <Input
                label="Country code (e.g. US)"
                value={passenger.passport?.countryCode ?? ''}
                onChangeText={(v: string) =>
                  updateField('passport', { ...(passenger.passport ?? { number: '', expiresOn: '' }), countryCode: v })
                }
              />
              <Input
                label="Expiry (YYYY-MM-DD)"
                value={passenger.passport?.expiresOn ?? ''}
                onChangeText={(v: string) =>
                  updateField('passport', { ...(passenger.passport ?? { number: '', countryCode: '' }), expiresOn: v })
                }
              />
            </View>
          )}

          {/* Frequent flyer sub-section */}
          {showFrequentFlyer && (
            <View className="mt-2 p-3 rounded-2xl bg-light-secondary dark:bg-dark-secondary mb-2">
              <ThemedText className="font-semibold text-sm mb-2">Frequent flyer</ThemedText>
              {(passenger.frequentFlyers ?? []).map((ff, idx) => (
                <View key={idx} className="mb-2">
                  <ThemedText className="text-xs opacity-60 mb-1">{ff.carrierName} ({ff.carrierCode})</ThemedText>
                  <Input
                    label="Membership number"
                    value={ff.membershipNumber}
                    onChangeText={(v: string) => {
                      const updated = [...(passenger.frequentFlyers ?? [])];
                      updated[idx] = { ...ff, membershipNumber: v };
                      updateField('frequentFlyers', updated);
                    }}
                  />
                </View>
              ))}
              {(!passenger.frequentFlyers || passenger.frequentFlyers.length === 0) && (
                <ThemedText className="text-xs opacity-50 italic">
                  No frequent flyer numbers saved. Add them in your traveler profile.
                </ThemedText>
              )}
            </View>
          )}

          {/* Dietary sub-section */}
          {showDietary && (
            <View className="mt-2 p-3 rounded-2xl bg-light-secondary dark:bg-dark-secondary mb-2">
              <ThemedText className="font-semibold text-sm mb-2">Dietary preferences</ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {(Object.keys(DIETARY_LABEL) as DietaryCode[]).map((code) => (
                  <Chip
                    key={code}
                    label={DIETARY_LABEL[code]}
                    isSelected={passenger.dietary?.includes(code) ?? false}
                    onPress={() => {
                      const current = passenger.dietary ?? [];
                      const next = current.includes(code)
                        ? current.filter((c) => c !== code)
                        : [...current, code];
                      updateField('dietary', next);
                    }}
                    size="sm"
                  />
                ))}
              </View>
            </View>
          )}

          {/* Known Traveller Number */}
          {showKTN && (
            <View className="mt-2 mb-2">
              <Input
                label="Known Traveller Number (TSA PreCheck / Global Entry)"
                value={passenger.knownTravellerNumber ?? ''}
                onChangeText={(v: string) => updateField('knownTravellerNumber', v)}
              />
            </View>
          )}
        </ScrollView>
      </Step>

      {/* ── Step 2: Bags ── */}
      <Step title="Bags">
        <ScrollView className="flex-1 p-4">
          <View className="flex-row items-center justify-between mt-2 mb-4">
            <Section title="Baggage" titleSize="2xl" subtitle="Select bags for your trip" className="flex-1" />
            <ThemedText className="text-sm font-bold opacity-70">
              Subtotal: {bagSubtotal === 0 ? 'Free' : `$${bagSubtotal}`}
            </ThemedText>
          </View>
          {BAG_OPTIONS.map((opt) => (
            <BagRow
              key={opt.id}
              option={opt}
              selected={picks.bagIds.includes(opt.id)}
              onToggle={() => toggleBag(opt.id)}
            />
          ))}
        </ScrollView>
      </Step>

      {/* ── Step 3: Seats ── */}
      <Step title="Seats">
        <ScrollView className="flex-1 p-4">
          <Section title="Seat preference" titleSize="2xl" subtitle="One seat selection for your trip" className="mt-2 mb-4" />
          <View className="flex-row flex-wrap gap-2">
            {SEAT_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                label={opt.priceUSD === 0 ? opt.label : `${opt.label} · $${opt.priceUSD}`}
                isSelected={picks.seatIds.includes(opt.id)}
                onPress={() => selectSeat(opt.id)}
              />
            ))}
          </View>
          {selectedSeat && (
            <View className="mt-4 p-3 rounded-2xl bg-light-secondary dark:bg-dark-secondary">
              <ThemedText className="font-semibold text-sm">{selectedSeat.label}</ThemedText>
              <ThemedText className="text-xs opacity-60 mt-1">{selectedSeat.description}</ThemedText>
            </View>
          )}
        </ScrollView>
      </Step>

      {/* ── Step 4: Meals ── */}
      <Step title="Meals">
        <ScrollView className="flex-1 p-4">
          <Section title="Meal preference" titleSize="2xl" subtitle="Special service request (SSR) codes" className="mt-2 mb-4" />
          <View className="flex-row flex-wrap gap-2">
            {MEAL_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                label={opt.priceUSD === 0 ? opt.label : `${opt.label} · $${opt.priceUSD}`}
                isSelected={picks.mealIds.includes(opt.id)}
                onPress={() => toggleMeal(opt.id)}
              />
            ))}
          </View>
          {selectedMeals.length > 0 && (
            <View className="mt-4 p-3 rounded-2xl bg-light-secondary dark:bg-dark-secondary">
              {selectedMeals.map((m) => (
                <View key={m.id} className="mb-1">
                  <ThemedText className="font-semibold text-sm">{m.label} ({m.code})</ThemedText>
                  <ThemedText className="text-xs opacity-60">{m.description}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Step>

      {/* ── Step 5: Extras ── */}
      <Step title="Extras">
        <ScrollView className="flex-1 p-4">
          <Section title="Extras" titleSize="2xl" subtitle="Priority, lounge, insurance & more" className="mt-2 mb-4" />
          {EXTRA_OPTIONS.map((opt) => (
            <ExtraRow
              key={opt.id}
              option={opt}
              selected={picks.extraIds.includes(opt.id)}
              onToggle={() => toggleExtra(opt.id)}
            />
          ))}
        </ScrollView>
      </Step>

      {/* ── Step 6: Review ── */}
      <Step title="Review">
        <ScrollView className="flex-1 p-4">
          <Section title="Review" titleSize="2xl" subtitle="Double-check your flight & add-ons" className="mt-2 mb-4" />

          {/* Passenger summary */}
          <View className="bg-light-primary dark:bg-dark-secondary rounded-2xl p-4 mb-3">
            <ThemedText className="font-bold mb-1">Passenger</ThemedText>
            <ThemedText className="text-sm opacity-70">
              {passenger.given_name} {passenger.family_name}
            </ThemedText>
            {passenger.email ? (
              <ThemedText className="text-sm opacity-70">{passenger.email}</ThemedText>
            ) : null}
          </View>

          {/* Flight slices */}
          {offer.slices.map((s, i) => (
            <View key={i} className="bg-light-primary dark:bg-dark-secondary rounded-2xl p-4 mb-3">
              <ThemedText className="font-bold mb-1">
                {s.origin} → {s.destination}
              </ThemedText>
              {s.segments.map((seg, j) => (
                <ThemedText key={j} className="text-sm opacity-70">
                  {seg.marketingCarrierName} {seg.flightNumber} · {seg.departing_at.slice(0, 16).replace('T', ' ')}
                </ThemedText>
              ))}
            </View>
          ))}

          {/* Ancillary summary */}
          <View className="bg-light-primary dark:bg-dark-secondary rounded-2xl p-4 mb-3">
            <ThemedText className="font-bold mb-2">Add-ons</ThemedText>
            <View className="flex-row justify-between mb-1">
              <ThemedText className="text-sm opacity-70">
                Bags: {selectedBags.length ? selectedBags.map((b) => b.label).join(', ') : 'None'}
              </ThemedText>
            </View>
            <View className="flex-row justify-between mb-1">
              <ThemedText className="text-sm opacity-70">
                Seat: {selectedSeat ? selectedSeat.label : 'Standard'}
              </ThemedText>
            </View>
            <View className="flex-row justify-between mb-1">
              <ThemedText className="text-sm opacity-70">
                Meals: {selectedMeals.length ? selectedMeals.map((m) => m.label).join(', ') : 'Standard'}
              </ThemedText>
            </View>
            <View className="flex-row justify-between">
              <ThemedText className="text-sm opacity-70">
                Extras: {selectedExtras.length ? selectedExtras.map((e) => e.label).join(', ') : 'None'}
              </ThemedText>
            </View>
          </View>

          {/* Pricing */}
          <View className="mt-2">
            <View className="flex-row justify-between mb-1">
              <ThemedText className="opacity-70">Base fare</ThemedText>
              <ThemedText className="opacity-70">
                {offer.totalCurrency} {Math.round(baseAmount)}
              </ThemedText>
            </View>
            {ancillaryTotal > 0 && (
              <View className="flex-row justify-between mb-1">
                <ThemedText className="opacity-70">Ancillaries</ThemedText>
                <ThemedText className="opacity-70">${ancillaryTotal}</ThemedText>
              </View>
            )}
            <View className="flex-row justify-between mt-2 pt-2 border-t border-light-secondary dark:border-dark-secondary">
              <ThemedText className="font-bold">Total</ThemedText>
              <ThemedText className="font-bold">
                {offer.totalCurrency} {Math.round(grandTotal)}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </Step>

      {/* ── Step 7: Confirm ── */}
      <Step title="Confirm">
        <View className="flex-1 items-center justify-center p-6">
          {submitting ? (
            <>
              <ActivityIndicator />
              <ThemedText className="mt-3">Booking with Duffel test-mode…</ThemedText>
            </>
          ) : (
            <>
              <ThemedText className="text-xl font-bold text-center mb-2">Ready to book</ThemedText>
              <ThemedText className="opacity-70 text-center mb-6">
                Test-mode uses a balance payment. No real money is charged. Tap Complete to confirm.
              </ThemedText>
              <View className="w-full bg-light-secondary dark:bg-dark-secondary rounded-2xl p-4">
                <View className="flex-row justify-between mb-1">
                  <ThemedText className="text-sm opacity-70">Base fare</ThemedText>
                  <ThemedText className="text-sm opacity-70">
                    {offer.totalCurrency} {Math.round(baseAmount)}
                  </ThemedText>
                </View>
                {ancillaryTotal > 0 && (
                  <View className="flex-row justify-between mb-1">
                    <ThemedText className="text-sm opacity-70">Ancillaries</ThemedText>
                    <ThemedText className="text-sm opacity-70">${ancillaryTotal}</ThemedText>
                  </View>
                )}
                <View className="flex-row justify-between mt-2 pt-2 border-t border-light-secondary dark:border-dark-secondary">
                  <ThemedText className="font-bold">Grand total</ThemedText>
                  <ThemedText className="font-bold">
                    {offer.totalCurrency} {Math.round(grandTotal)}
                  </ThemedText>
                </View>
              </View>
            </>
          )}
        </View>
      </Step>
    </MultiStep>
  );
}

// ─── Stay checkout ─────────────────────────────────────────────────────────────

const BED_PREFERENCES = ['Any bed', 'King', 'Twin', 'Two beds'];
const ROOM_PREFERENCES: { key: string; label: string }[] = [
  { key: 'high_floor', label: 'High floor' },
  { key: 'quiet', label: 'Quiet side' },
  { key: 'early_checkin', label: 'Early check-in' },
  { key: 'accessibility', label: 'Step-free access' },
  { key: 'connecting', label: 'Connecting rooms' },
  { key: 'pet', label: 'Pet friendly' },
];

function StayCheckout({
  stayId,
  checkIn,
  checkOut,
  guests,
  rooms,
  tripIdHint,
}: {
  stayId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  tripIdHint?: string;
}) {
  const q = useQuery<StayOffer | null>({
    queryKey: ['stay', stayId],
    queryFn: () => getStayById(stayId),
    enabled: !!stayId,
  });
  const [lead, setLead] = useState({
    given_name: '',
    family_name: '',
    email: '',
    phone_number: '',
    born_on: '',
  });
  const [bed, setBed] = useState<string>('Any bed');
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [tripChoice, setTripChoice] = useState<string | null>(tripIdHint ?? null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ ref: string; name: string; orderId: string } | null>(null);

  // Profile quick-fill
  const [profiles, setProfiles] = useState<TravelerProfile[]>([]);

  useEffect(() => {
    (async () => {
      const all = await listProfiles();
      setProfiles([...all.filter((p) => p.isOwner), ...all.filter((p) => !p.isOwner)]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const all = await listTrips();
      setTrips(all);
      if (!tripChoice && q.data) {
        const match = all.find(
          (t) => t.primaryDestination === q.data?.city || t.primaryDestinationName === q.data?.cityName,
        );
        if (match) setTripChoice(match.id);
      }
    })();
  }, [q.data, tripChoice]);

  const offer = q.data;
  if (q.isLoading || !offer) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const nights = (() => {
    const a = Date.parse(checkIn);
    const b = Date.parse(checkOut);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return offer.nights;
    return Math.max(1, Math.round((b - a) / 86_400_000));
  })();
  const total = offer.pricePerNight * nights;

  const applyProfileToLead = (profile: TravelerProfile) => {
    setLead({
      given_name: profile.givenName,
      family_name: profile.familyName,
      email: profile.email,
      phone_number: profile.phoneNumber,
      born_on: profile.bornOn,
    });
  };

  const onComplete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const ref = `VST${Math.floor(Math.random() * 9000 + 1000)}`;
      const composite = [
        offer.city,
        checkIn,
        checkOut,
        guests,
        rooms,
        offer.id,
      ].join('|');
      const saved: SavedStay = {
        id: composite,
        offerId: offer.id,
        name: offer.name,
        city: offer.city,
        cityName: offer.cityName,
        neighborhood: offer.neighborhood,
        checkIn,
        checkOut,
        guests,
        rooms,
        totalAmount: total,
        pricePerNight: offer.pricePerNight,
        currency: offer.currency,
        rating: offer.rating,
        propertyType: offer.propertyType,
        amenities: offer.amenities,
        cancellation: offer.cancellation,
        savedAt: Date.now(),
        status: 'booked',
        bookingReference: ref,
        leadGuestName: `${lead.given_name} ${lead.family_name}`.trim(),
        bookedAt: Date.now(),
        tripId: tripChoice ?? undefined,
      };
      // Use the same storage helper that handles dedupe.
      await persistStay(offer as any, { checkIn, checkOut, guests, rooms, tripId: tripChoice ?? undefined });
      // The helper writes a fresh record; we also need the booked flags
      // to persist. Re-save directly so status + bookingReference land.
      const { listSavedStays } = await import('@/utils/staysStorage');
      const LocalAsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const all = await listSavedStays();
      const idx = all.findIndex((s) => s.id === composite);
      if (idx >= 0) all[idx] = saved;
      else all.unshift(saved);
      await LocalAsyncStorage.setItem('@voyage/saved-stays', JSON.stringify(all));

      if (tripChoice) {
        await linkStayToTrip(tripChoice, saved.id);
      } else {
        // No trip selected — create a lightweight planning trip rooted at this stay.
        const now = Date.now();
        const tripId = `trip-stay-${ref.toLowerCase()}`;
        await saveTrip({
          id: tripId,
          title: `${offer.cityName} · ${new Date(checkIn).toLocaleDateString(undefined, { month: 'long' })}`,
          primaryDestination: offer.city,
          primaryDestinationName: offer.cityName,
          startDate: checkIn,
          endDate: checkOut,
          status: 'booked',
          orderIds: [],
          stayIds: [saved.id],
          activityIds: [],
          itineraryDays: [],
          coverGlyphIata: offer.city,
          createdAt: now,
          updatedAt: now,
        });
        await linkStayToTrip(tripId, saved.id);
      }
      const navigateTripId = tripChoice ?? `trip-stay-${ref.toLowerCase()}`;
      setConfirmed({ ref, name: offer.name, orderId: navigateTripId });
    } catch (e: any) {
      Alert.alert('Booking failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k: keyof typeof lead, v: string) => setLead((p) => ({ ...p, [k]: v }));

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  const cancellationUntil = (() => {
    if ((offer as any).cancellation && typeof (offer as any).cancellation === 'string') {
      return (offer as any).cancellation;
    }
    try {
      const d = new Date(checkIn);
      d.setDate(d.getDate() - 1);
      return fmtDate(d.toISOString());
    } catch {
      return null;
    }
  })();

  return (
    <>
      {/* Fix 2 — INK confirmation modal */}
      <Modal visible={!!confirmed} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: PARCHMENT, borderRadius: 24, padding: 28, width: '100%', maxWidth: 380 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 26, color: INK, marginBottom: 12 }}>Stay reserved</Text>
            {/* INK pill reference */}
            <View style={{ backgroundColor: INK, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 }}>
              <Text style={{ color: PARCHMENT, fontFamily: 'Courier', fontSize: 13, letterSpacing: 1 }}>
                {confirmed?.ref ?? ''}
              </Text>
            </View>
            <Text style={{ fontFamily: SERIF, fontSize: 16, color: INK, fontStyle: 'italic', marginBottom: 20, opacity: 0.8 }}>
              {confirmed?.name ?? ''}
            </Text>
            <Pressable
              onPress={() => {
                const id = confirmed?.orderId ?? '';
                setConfirmed(null);
                router.replace({ pathname: '/screens/trip-detail', params: { id } });
              }}
              style={{ backgroundColor: MOSS, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 16 }}>View trip →</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setConfirmed(null);
                router.replace('/(tabs)/trips');
              }}
              style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: INK }}>
              <Text style={{ color: INK, fontSize: 15 }}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <MultiStep onComplete={onComplete} onClose={() => router.back()} showHeader>
        <Step title="Lead guest">
          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            <Section
              title="Lead guest"
              titleSize="2xl"
              subtitle={`${offer.name} · ${nights} night${nights === 1 ? '' : 's'}`}
              className="mt-2 mb-4"
            />

            {/* Quick fill bar */}
            {profiles.length > 0 && (
              <View className="mb-4">
                <ThemedText className="text-xs font-semibold opacity-50 mb-2 uppercase tracking-wide">
                  Quick fill
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {profiles.map((p) => (
                    <View key={p.id} className="mr-2">
                      <Chip
                        label={profileChipLabel(p)}
                        onPress={() => applyProfileToLead(p)}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Input label="First name" value={lead.given_name} onChangeText={(v: string) => update('given_name', v)} />
            <Input label="Last name" value={lead.family_name} onChangeText={(v: string) => update('family_name', v)} />
            <Input label="Email" keyboardType="email-address" value={lead.email} onChangeText={(v: string) => update('email', v)} />
            <Input label="Phone number (+E.164)" keyboardType="phone-pad" value={lead.phone_number} onChangeText={(v: string) => update('phone_number', v)} />
            <Input label="Date of birth (YYYY-MM-DD)" value={lead.born_on} onChangeText={(v: string) => update('born_on', v)} />
          </ScrollView>
        </Step>

        <Step title="Room">
          <ScrollView className="flex-1 p-4">
            <Section title="Room preferences" titleSize="2xl" subtitle="Best effort — host will try to honour." className="mt-2 mb-6" />
            <ThemedText className="font-semibold mb-2">Bed setup</ThemedText>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {BED_PREFERENCES.map((b) => (
                <Chip key={b} label={b} isSelected={bed === b} onPress={() => setBed(b)} />
              ))}
            </View>
            <ThemedText className="font-semibold mb-2">Anything else?</ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {ROOM_PREFERENCES.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  isSelected={!!prefs[p.key]}
                  onPress={() => setPrefs((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
                />
              ))}
            </View>

            <Section title="Attach to trip" titleSize="lg" className="mt-8 mb-3" />
            {trips.length === 0 ? (
              <ThemedText className="opacity-60 text-sm italic">
                No saved trips yet — I'll create one rooted at this stay.
              </ThemedText>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="New trip"
                  isSelected={tripChoice === null}
                  onPress={() => setTripChoice(null)}
                />
                {trips.map((t) => (
                  <Chip
                    key={t.id}
                    label={t.title}
                    isSelected={tripChoice === t.id}
                    onPress={() => setTripChoice(t.id)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </Step>

        {/* Fix 3 — enriched Review step */}
        <Step title="Review">
          <ScrollView className="flex-1 p-4">
            <Section title="Review" titleSize="2xl" subtitle="Confirm and book the room." className="mt-2 mb-4" />
            <View className="bg-light-primary dark:bg-dark-secondary rounded-2xl overflow-hidden mb-3">
              {/* Picsum thumbnail */}
              <Image
                source={{ uri: `https://picsum.photos/seed/${offer.id}/600/300` }}
                style={{ height: 120 }}
                contentFit="cover"
              />
              <View style={{ padding: 16 }}>
                <ThemedText style={{ fontFamily: SERIF, fontSize: 18 }} className="mb-1">{offer.name}</ThemedText>
                <ThemedText className="text-sm opacity-70">
                  {offer.neighborhood ?? offer.cityName} · {offer.propertyType}
                </ThemedText>
                {/* Formatted dates */}
                <ThemedText className="text-sm opacity-70 mt-1">
                  {fmtDate(checkIn)} – {fmtDate(checkOut)} · {guests} guest{guests === 1 ? '' : 's'} · {rooms} room{rooms === 1 ? '' : 's'}
                </ThemedText>
                <ThemedText className="text-sm opacity-70 mt-1">Bed: {bed}</ThemedText>
                {/* Per-night breakdown */}
                <View className="flex-row justify-between mt-3 pt-3 border-t border-light-secondary dark:border-dark-secondary">
                  <ThemedText className="text-sm opacity-70">
                    {offer.currency} {offer.pricePerNight.toFixed(0)} × {nights} night{nights === 1 ? '' : 's'}
                  </ThemedText>
                  <ThemedText className="text-sm opacity-70">
                    {offer.currency} {Math.round(total)}
                  </ThemedText>
                </View>
                {/* Cancellation policy */}
                {cancellationUntil && (
                  <Text style={{ fontFamily: SERIF, fontStyle: 'italic', color: MOSS, fontSize: 13, marginTop: 8 }}>
                    Free cancellation until {cancellationUntil}
                  </Text>
                )}
              </View>
            </View>
            <View className="flex-row justify-between mt-2 px-1">
              <ThemedText className="font-bold">Total</ThemedText>
              <ThemedText className="font-bold">
                {offer.currency} {Math.round(total)}
              </ThemedText>
            </View>
          </ScrollView>
        </Step>

        {/* Fix 5 — enriched Confirm step */}
        <Step title="Confirm">
          <View className="flex-1 p-6">
            {submitting ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
                <ThemedText className="mt-3">Reserving with the host…</ThemedText>
              </View>
            ) : (
              <>
                <Text style={{ fontFamily: SERIF, fontSize: 24, color: INK, textAlign: 'center', marginBottom: 20 }}>
                  Ready to reserve
                </Text>
                {/* Compact summary card */}
                <View style={{ backgroundColor: PARCHMENT, borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
                  <Image
                    source={{ uri: `https://picsum.photos/seed/${offer.id}/600/300` }}
                    style={{ height: 100 }}
                    contentFit="cover"
                  />
                  <View style={{ padding: 14 }}>
                    <Text style={{ fontFamily: SERIF, fontSize: 17, color: INK, marginBottom: 4 }}>{offer.name}</Text>
                    <Text style={{ color: INK, opacity: 0.7, fontSize: 13 }}>
                      {fmtDate(checkIn)} – {fmtDate(checkOut)}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(19,26,42,0.12)' }}>
                      <Text style={{ color: INK, fontSize: 13, opacity: 0.7 }}>Total</Text>
                      <Text style={{ color: INK, fontWeight: '700', fontSize: 14 }}>
                        {offer.currency} {Math.round(total)}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Local-save badge */}
                <View style={{ backgroundColor: MOSS + '18', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Icon name="HardDrive" size={16} color={MOSS} />
                  <Text style={{ color: MOSS, fontSize: 13, marginLeft: 8 }}>
                    Local save · Your reservation is saved on this device
                  </Text>
                </View>
                <ThemedText className="opacity-60 text-center text-sm">
                  Tap Complete to confirm your reservation.
                </ThemedText>
              </>
            )}
          </View>
        </Step>
      </MultiStep>
    </>
  );
}
