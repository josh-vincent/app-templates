import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import Header from '@/components/Header';
import Icon from '@/components/Icon';
import ThemedText from '@/components/ThemedText';
import Toast from '@/components/Toast';
import { Chip } from '@/components/Chip';
import Input from '@/components/forms/Input';
import useThemeColors from '@/contexts/ThemeColors';
import {
  ACCESSIBILITY_LABEL,
  AccessibilityNeed,
  BAG_PREFERENCE_LABEL,
  BagPreference,
  DIETARY_LABEL,
  DietaryCode,
  FrequentFlyer,
  SEAT_PREFERENCE_LABEL,
  SeatPreference,
  Title,
  Gender,
  TravelerProfile,
  emptyProfile,
  profileCompletion,
  profileDisplayName,
} from '@/lib/travelerProfileTypes';
import { INK, MOSS, MOSS_SOFT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import {
  deleteProfile,
  listProfiles,
  saveProfile,
  subscribeTravelerProfiles,
} from '@/utils/travelerProfileStorage';

// ─── helpers ─────────────────────────────────────────────────────────────────

const TITLES: Title[] = ['mr', 'mrs', 'ms', 'miss', 'dr'];
const TITLE_LABEL: Record<Title, string> = {
  mr: 'Mr',
  mrs: 'Mrs',
  ms: 'Ms',
  miss: 'Miss',
  dr: 'Dr',
};
const GENDERS: Gender[] = ['m', 'f', 'x'];
const GENDER_LABEL: Record<Gender, string> = { m: 'Male', f: 'Female', x: 'Non-binary' };

const DIETARY_KEYS = Object.keys(DIETARY_LABEL) as DietaryCode[];
const ACCESSIBILITY_KEYS = Object.keys(ACCESSIBILITY_LABEL) as AccessibilityNeed[];
const SEAT_KEYS = Object.keys(SEAT_PREFERENCE_LABEL) as SeatPreference[];
const BAG_KEYS = Object.keys(BAG_PREFERENCE_LABEL) as BagPreference[];
const CABIN_OPTIONS = ['economy', 'premium_economy', 'business', 'first'] as const;
const CABIN_LABEL: Record<typeof CABIN_OPTIONS[number], string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
};
const TIER_OPTIONS = ['standard', 'silver', 'gold', 'platinum'] as const;
type Tier = typeof TIER_OPTIONS[number];

// ─── sub-components ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ title, expanded, onToggle }: SectionHeaderProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center justify-between py-3 border-b border-black/10 dark:border-white/10 mb-4">
      <ThemedText style={{ fontFamily: SERIF, fontSize: 16, color: colors.text }}>
        {title}
      </ThemedText>
      <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={18} />
    </Pressable>
  );
}

interface ChipRowProps<T extends string> {
  options: T[];
  labelMap: Record<T, string>;
  selected: T | T[];
  onSelect: (val: T) => void;
  multi?: boolean;
}

function ChipRow<T extends string>({
  options,
  labelMap,
  selected,
  onSelect,
  multi = false,
}: ChipRowProps<T>) {
  const isSelected = (val: T) =>
    multi ? (selected as T[]).includes(val) : selected === val;
  return (
    <View className="flex-row flex-wrap gap-2 mb-4">
      {options.map((opt) => (
        <Chip
          key={opt}
          label={labelMap[opt]}
          size="sm"
          isSelected={isSelected(opt)}
          onPress={() => onSelect(opt)}
        />
      ))}
    </View>
  );
}

// ─── completion card ──────────────────────────────────────────────────────────

function CompletionCard({ profile }: { profile: TravelerProfile }) {
  const { score, required, missing } = profileCompletion(profile);
  const complete = score === required;

  const missingText =
    missing.length > 0
      ? `Add ${missing.slice(0, 2).join(' + ')}${missing.length > 2 ? ` + ${missing.length - 2} more` : ''} to be 100%`
      : '';

  return (
    <View
      className="rounded-2xl px-4 py-3 mb-6 flex-row items-center"
      style={{ backgroundColor: complete ? MOSS_SOFT : PARCHMENT_COOL }}>
      <Icon
        name={complete ? 'CheckCircle' : 'AlertCircle'}
        size={18}
        color={complete ? MOSS : INK}
      />
      <View className="ml-3 flex-1">
        <ThemedText style={{ fontWeight: '600', color: complete ? MOSS : INK, fontSize: 13 }}>
          {score} of {required} details filled
        </ThemedText>
        {!complete && missingText ? (
          <ThemedText style={{ color: INK, fontSize: 11, opacity: 0.7, marginTop: 2 }}>
            {missingText}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

// ─── frequent flyer row ───────────────────────────────────────────────────────

interface FFRowProps {
  ff: FrequentFlyer;
  index: number;
  onChange: (index: number, updated: FrequentFlyer) => void;
  onDelete: (index: number) => void;
}

function FFRow({ ff, index, onChange, onDelete }: FFRowProps) {
  return (
    <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: PARCHMENT_DEEP }}>
      <View className="flex-row items-center justify-between mb-3">
        <ThemedText style={{ fontWeight: '600', fontSize: 13 }}>
          {ff.carrierCode || 'New airline'}
        </ThemedText>
        <Pressable onPress={() => onDelete(index)} hitSlop={8}>
          <Icon name="Trash2" size={16} color="#e53e3e" />
        </Pressable>
      </View>
      <View className="flex-row gap-2 mb-2">
        <View className="flex-1">
          <Input
            label="Code"
            value={ff.carrierCode}
            onChangeText={(v) => onChange(index, { ...ff, carrierCode: v.toUpperCase() })}
            variant="classic"
            autoCapitalize="characters"
            maxLength={3}
          />
        </View>
        <View className="flex-[2]">
          <Input
            label="Airline name"
            value={ff.carrierName}
            onChangeText={(v) => onChange(index, { ...ff, carrierName: v })}
            variant="classic"
          />
        </View>
      </View>
      <Input
        label="Membership number"
        value={ff.membershipNumber}
        onChangeText={(v) => onChange(index, { ...ff, membershipNumber: v })}
        variant="classic"
      />
      <ThemedText style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Tier</ThemedText>
      <View className="flex-row flex-wrap gap-2">
        {TIER_OPTIONS.map((t) => (
          <Chip
            key={t}
            label={t.charAt(0).toUpperCase() + t.slice(1)}
            size="sm"
            isSelected={ff.tier === t}
            onPress={() => onChange(index, { ...ff, tier: t })}
          />
        ))}
      </View>
    </View>
  );
}

// ─── hotel loyalty row ───────────────────────────────────────────────────────

interface HotelRowProps {
  hotel: { chain: string; number: string };
  index: number;
  onChange: (index: number, updated: { chain: string; number: string }) => void;
  onDelete: (index: number) => void;
}

function HotelRow({ hotel, index, onChange, onDelete }: HotelRowProps) {
  return (
    <View className="rounded-2xl p-4 mb-3" style={{ backgroundColor: PARCHMENT_DEEP }}>
      <View className="flex-row items-center justify-between mb-3">
        <ThemedText style={{ fontWeight: '600', fontSize: 13 }}>
          {hotel.chain || 'Hotel chain'}
        </ThemedText>
        <Pressable onPress={() => onDelete(index)} hitSlop={8}>
          <Icon name="Trash2" size={16} color="#e53e3e" />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            label="Chain name"
            value={hotel.chain}
            onChangeText={(v) => onChange(index, { ...hotel, chain: v })}
            variant="classic"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Member number"
            value={hotel.number}
            onChangeText={(v) => onChange(index, { ...hotel, number: v })}
            variant="classic"
          />
        </View>
      </View>
    </View>
  );
}

// ─── add button ───────────────────────────────────────────────────────────────

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-2 mt-1">
      <Icon name="Plus" size={16} color={MOSS} />
      <ThemedText style={{ color: MOSS, marginLeft: 6, fontSize: 14, fontWeight: '500' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// ─── profile picker tab ───────────────────────────────────────────────────────

interface ProfileTabProps {
  profile: TravelerProfile;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

function ProfileTab({ profile, isActive, onSelect, onDelete }: ProfileTabProps) {
  return (
    <Pressable
      onPress={onSelect}
      className="flex-row items-center mr-2 rounded-full px-3 py-2"
      style={{
        backgroundColor: isActive ? INK : PARCHMENT_DEEP,
      }}>
      <ThemedText
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: isActive ? '#fff' : INK,
        }}>
        {profileDisplayName(profile)}
      </ThemedText>
      {!profile.isOwner && onDelete && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          hitSlop={8}
          className="ml-2">
          <Icon name="X" size={12} color={isActive ? '#fff' : INK} />
        </Pressable>
      )}
    </Pressable>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function TravelerDetailsScreen() {
  const colors = useThemeColors();

  // Profiles list
  const [profiles, setProfiles] = useState<TravelerProfile[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // Local draft of the currently edited profile
  const [draft, setDraft] = useState<TravelerProfile | null>(null);
  const savedRef = useRef<TravelerProfile | null>(null);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  // Accordion state — all expanded by default
  const [expanded, setExpanded] = useState({
    personal: true,
    contact: true,
    documents: true,
    loyalty: true,
    dietary: true,
    accessibility: true,
    seatBag: true,
    emergency: true,
    hotelLoyalty: true,
    notes: true,
  });

  type SectionKey = keyof typeof expanded;
  const toggleSection = (key: SectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Load profiles from storage
  const loadProfiles = useCallback(async () => {
    const all = await listProfiles();
    setProfiles(all);
    if (all.length === 0) return;
    // Keep active profile or fall back to owner
    const owner = all.find((p) => p.isOwner);
    const current = activeId ? all.find((p) => p.id === activeId) : undefined;
    const target = current ?? owner ?? all[0];
    setActiveId(target.id);
    setDraft(target);
    savedRef.current = target;
  }, [activeId]);

  useEffect(() => {
    loadProfiles();
    const unsub = subscribeTravelerProfiles(loadProfiles);
    return unsub;
  }, []);

  // Switch active profile
  const switchProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setActiveId(id);
    setDraft(p);
    savedRef.current = p;
  };

  // Field change helpers
  const patch = <K extends keyof TravelerProfile>(key: K, value: TravelerProfile[K]) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const patchPassport = <K extends keyof NonNullable<TravelerProfile['passport']>>(
    key: K,
    value: NonNullable<TravelerProfile['passport']>[K],
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        passport: {
          number: '',
          countryCode: '',
          expiresOn: '',
          ...prev.passport,
          [key]: value,
        },
      };
    });
  };

  const patchEmergency = <K extends keyof NonNullable<TravelerProfile['emergencyContact']>>(
    key: K,
    value: NonNullable<TravelerProfile['emergencyContact']>[K],
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        emergencyContact: {
          name: '',
          relation: '',
          phone: '',
          ...prev.emergencyContact,
          [key]: value,
        },
      };
    });
  };

  const toggleDietaryCode = (code: DietaryCode) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const dietary = prev.dietary.includes(code)
        ? prev.dietary.filter((c) => c !== code)
        : [...prev.dietary, code];
      return { ...prev, dietary };
    });
  };

  const toggleAccessibility = (need: AccessibilityNeed) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const accessibility = prev.accessibility.includes(need)
        ? prev.accessibility.filter((n) => n !== need)
        : [...prev.accessibility, need];
      return { ...prev, accessibility };
    });
  };

  const updateFF = (index: number, updated: FrequentFlyer) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const frequentFlyers = [...prev.frequentFlyers];
      frequentFlyers[index] = updated;
      return { ...prev, frequentFlyers };
    });
  };

  const deleteFF = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const frequentFlyers = prev.frequentFlyers.filter((_, i) => i !== index);
      return { ...prev, frequentFlyers };
    });
  };

  const addFF = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        frequentFlyers: [
          ...prev.frequentFlyers,
          { carrierCode: '', carrierName: '', membershipNumber: '', tier: 'standard' },
        ],
      };
    });
  };

  const updateHotel = (index: number, updated: { chain: string; number: string }) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const hotelLoyalty = [...(prev.hotelLoyalty ?? [])];
      hotelLoyalty[index] = updated;
      return { ...prev, hotelLoyalty };
    });
  };

  const deleteHotel = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const hotelLoyalty = (prev.hotelLoyalty ?? []).filter((_, i) => i !== index);
      return { ...prev, hotelLoyalty };
    });
  };

  const addHotel = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hotelLoyalty: [...(prev.hotelLoyalty ?? []), { chain: '', number: '' }],
      };
    });
  };

  // Dirty check
  const isDirty =
    draft !== null &&
    savedRef.current !== null &&
    JSON.stringify(draft) !== JSON.stringify(savedRef.current);

  // Save
  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const saved = await saveProfile(draft);
      savedRef.current = saved;
      setDraft(saved);
      setToast({ visible: true, message: 'Profile saved', type: 'success' });
    } catch {
      setToast({ visible: true, message: 'Could not save profile', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Add companion
  const handleAddCompanion = async () => {
    const newP = emptyProfile({ isOwner: false, nickname: 'New companion' });
    await saveProfile(newP);
    setActiveId(newP.id);
  };

  // Delete companion
  const handleDeleteCompanion = (id: string) => {
    Alert.alert('Remove companion?', 'This traveler profile will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteProfile(id);
          // Switch to owner after deletion
          const owner = profiles.find((p) => p.isOwner);
          if (owner) setActiveId(owner.id);
        },
      },
    ]);
  };

  if (!draft) {
    return (
      <View className="flex-1 bg-light-primary dark:bg-dark-primary">
        <Header title="Traveler details" showBackButton />
        <View className="flex-1 items-center justify-center">
          <ThemedText style={{ opacity: 0.5 }}>Loading profiles…</ThemedText>
        </View>
      </View>
    );
  }

  const hotelLoyalty = draft.hotelLoyalty ?? [];

  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary">
      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.visible}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <Header title="Traveler details" showBackButton />

      {/* Profile picker row */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingRight: 8 }}>
          {profiles.map((p) => (
            <ProfileTab
              key={p.id}
              profile={p}
              isActive={p.id === activeId}
              onSelect={() => switchProfile(p.id)}
              onDelete={!p.isOwner ? () => handleDeleteCompanion(p.id) : undefined}
            />
          ))}
          {/* Add companion */}
          <Pressable
            onPress={handleAddCompanion}
            className="flex-row items-center rounded-full px-3 py-2 ml-1"
            style={{ borderWidth: 1, borderColor: MOSS, borderStyle: 'dashed' }}>
            <Icon name="Plus" size={13} color={MOSS} />
            <ThemedText style={{ fontSize: 13, color: MOSS, marginLeft: 4 }}>
              Add companion
            </ThemedText>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main scroll area */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Completion card */}
        <CompletionCard profile={draft} />

        {/* ── Personal ─────────────────────────────── */}
        <SectionHeader
          title="Personal"
          expanded={expanded.personal}
          onToggle={() => toggleSection('personal')}
        />
        {expanded.personal && (
          <View>
            <ThemedText style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Title</ThemedText>
            <ChipRow
              options={TITLES}
              labelMap={TITLE_LABEL}
              selected={draft.title}
              onSelect={(v) => patch('title', v)}
            />
            {draft.nickname !== undefined && !draft.isOwner && (
              <Input
                label="Nickname / display name"
                value={draft.nickname ?? ''}
                onChangeText={(v) => patch('nickname', v)}
                variant="classic"
              />
            )}
            <Input
              label="Given name"
              value={draft.givenName}
              onChangeText={(v) => patch('givenName', v)}
              variant="classic"
              autoCapitalize="words"
            />
            <Input
              label="Middle name (optional)"
              value={draft.middleName ?? ''}
              onChangeText={(v) => patch('middleName', v || undefined)}
              variant="classic"
              autoCapitalize="words"
            />
            <Input
              label="Family name"
              value={draft.familyName}
              onChangeText={(v) => patch('familyName', v)}
              variant="classic"
              autoCapitalize="words"
            />
            <Input
              label="Date of birth (YYYY-MM-DD)"
              value={draft.bornOn}
              onChangeText={(v) => patch('bornOn', v)}
              variant="classic"
              keyboardType="numbers-and-punctuation"
              placeholder="1990-06-15"
            />
            <ThemedText style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Gender</ThemedText>
            <ChipRow
              options={GENDERS}
              labelMap={GENDER_LABEL}
              selected={draft.gender}
              onSelect={(v) => patch('gender', v)}
            />
          </View>
        )}

        {/* ── Contact ──────────────────────────────── */}
        <SectionHeader
          title="Contact"
          expanded={expanded.contact}
          onToggle={() => toggleSection('contact')}
        />
        {expanded.contact && (
          <View>
            <Input
              label="Email"
              value={draft.email}
              onChangeText={(v) => patch('email', v)}
              variant="classic"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Input
              label="Phone (+E.164)"
              value={draft.phoneNumber}
              onChangeText={(v) => patch('phoneNumber', v)}
              variant="classic"
              keyboardType="phone-pad"
              placeholder="+12025550147"
            />
            <Input
              label="Secondary email (optional)"
              value={draft.secondaryEmail ?? ''}
              onChangeText={(v) => patch('secondaryEmail', v || undefined)}
              variant="classic"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* ── Travel documents ─────────────────────── */}
        <SectionHeader
          title="Travel documents"
          expanded={expanded.documents}
          onToggle={() => toggleSection('documents')}
        />
        {expanded.documents && (
          <View>
            <Input
              label="Passport number"
              value={draft.passport?.number ?? ''}
              onChangeText={(v) => patchPassport('number', v)}
              variant="classic"
              autoCapitalize="characters"
            />
            <Input
              label="Passport country (2-letter code)"
              value={draft.passport?.countryCode ?? ''}
              onChangeText={(v) => patchPassport('countryCode', v.toUpperCase())}
              variant="classic"
              maxLength={2}
              autoCapitalize="characters"
              placeholder="US"
            />
            <Input
              label="Issued on (YYYY-MM-DD)"
              value={draft.passport?.issuedOn ?? ''}
              onChangeText={(v) => patchPassport('issuedOn', v || undefined)}
              variant="classic"
              keyboardType="numbers-and-punctuation"
              placeholder="2018-03-01"
            />
            <Input
              label="Expires on (YYYY-MM-DD)"
              value={draft.passport?.expiresOn ?? ''}
              onChangeText={(v) => patchPassport('expiresOn', v)}
              variant="classic"
              keyboardType="numbers-and-punctuation"
              placeholder="2028-03-01"
            />
            <Input
              label="Known Traveller Number (TSA PreCheck / Global Entry)"
              value={draft.knownTravellerNumber ?? ''}
              onChangeText={(v) => patch('knownTravellerNumber', v || undefined)}
              variant="classic"
            />
            <Input
              label="Redress Number (optional)"
              value={draft.redressNumber ?? ''}
              onChangeText={(v) => patch('redressNumber', v || undefined)}
              variant="classic"
            />
          </View>
        )}

        {/* ── Loyalty (frequent flyer) ─────────────── */}
        <SectionHeader
          title="Frequent flyer programmes"
          expanded={expanded.loyalty}
          onToggle={() => toggleSection('loyalty')}
        />
        {expanded.loyalty && (
          <View>
            {draft.frequentFlyers.map((ff, i) => (
              <FFRow key={i} ff={ff} index={i} onChange={updateFF} onDelete={deleteFF} />
            ))}
            <AddButton label="Add frequent flyer" onPress={addFF} />
          </View>
        )}

        {/* ── Dietary ──────────────────────────────── */}
        <SectionHeader
          title="Dietary requirements"
          expanded={expanded.dietary}
          onToggle={() => toggleSection('dietary')}
        />
        {expanded.dietary && (
          <View>
            <ChipRow
              options={DIETARY_KEYS}
              labelMap={DIETARY_LABEL}
              selected={draft.dietary}
              onSelect={toggleDietaryCode}
              multi
            />
          </View>
        )}

        {/* ── Accessibility ─────────────────────────── */}
        <SectionHeader
          title="Accessibility needs"
          expanded={expanded.accessibility}
          onToggle={() => toggleSection('accessibility')}
        />
        {expanded.accessibility && (
          <View>
            <ChipRow
              options={ACCESSIBILITY_KEYS}
              labelMap={ACCESSIBILITY_LABEL}
              selected={draft.accessibility}
              onSelect={toggleAccessibility}
              multi
            />
          </View>
        )}

        {/* ── Seat & bag preferences ───────────────── */}
        <SectionHeader
          title="Seat & bag preferences"
          expanded={expanded.seatBag}
          onToggle={() => toggleSection('seatBag')}
        />
        {expanded.seatBag && (
          <View>
            <ThemedText style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Seat</ThemedText>
            <ChipRow
              options={SEAT_KEYS}
              labelMap={SEAT_PREFERENCE_LABEL}
              selected={draft.seatPreference}
              onSelect={(v) => patch('seatPreference', v)}
            />
            <ThemedText style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Bags</ThemedText>
            <ChipRow
              options={BAG_KEYS}
              labelMap={BAG_PREFERENCE_LABEL}
              selected={draft.bagPreference}
              onSelect={(v) => patch('bagPreference', v)}
            />
            <ThemedText style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
              Preferred cabin
            </ThemedText>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {CABIN_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={CABIN_LABEL[opt]}
                  size="sm"
                  isSelected={draft.preferredCabin === opt}
                  onPress={() =>
                    patch('preferredCabin', draft.preferredCabin === opt ? undefined : opt)
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Emergency contact ─────────────────────── */}
        <SectionHeader
          title="Emergency contact"
          expanded={expanded.emergency}
          onToggle={() => toggleSection('emergency')}
        />
        {expanded.emergency && (
          <View>
            <Input
              label="Name"
              value={draft.emergencyContact?.name ?? ''}
              onChangeText={(v) => patchEmergency('name', v)}
              variant="classic"
              autoCapitalize="words"
            />
            <Input
              label="Relation (e.g. Spouse)"
              value={draft.emergencyContact?.relation ?? ''}
              onChangeText={(v) => patchEmergency('relation', v)}
              variant="classic"
              autoCapitalize="words"
            />
            <Input
              label="Phone (+E.164)"
              value={draft.emergencyContact?.phone ?? ''}
              onChangeText={(v) => patchEmergency('phone', v)}
              variant="classic"
              keyboardType="phone-pad"
            />
            <Input
              label="Email (optional)"
              value={draft.emergencyContact?.email ?? ''}
              onChangeText={(v) => patchEmergency('email', v || undefined)}
              variant="classic"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* ── Hotel loyalty ─────────────────────────── */}
        <SectionHeader
          title="Hotel loyalty"
          expanded={expanded.hotelLoyalty}
          onToggle={() => toggleSection('hotelLoyalty')}
        />
        {expanded.hotelLoyalty && (
          <View>
            {hotelLoyalty.map((h, i) => (
              <HotelRow key={i} hotel={h} index={i} onChange={updateHotel} onDelete={deleteHotel} />
            ))}
            <AddButton label="Add hotel loyalty" onPress={addHotel} />
          </View>
        )}

        {/* ── Notes ────────────────────────────────── */}
        <SectionHeader
          title="Notes"
          expanded={expanded.notes}
          onToggle={() => toggleSection('notes')}
        />
        {expanded.notes && (
          <View
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: PARCHMENT_DEEP, marginBottom: 8 }}>
            <TextInput
              value={draft.notes ?? ''}
              onChangeText={(v) => patch('notes', v || undefined)}
              placeholder="Anything else the booking agent should know…"
              placeholderTextColor={colors.placeholder}
              multiline
              style={{
                minHeight: 120,
                padding: 16,
                color: colors.text,
                fontSize: 14,
                textAlignVertical: 'top',
              }}
            />
          </View>
        )}

        {/* Companion remove button */}
        {!draft.isOwner && (
          <Pressable
            onPress={() => handleDeleteCompanion(draft.id)}
            className="flex-row items-center justify-center py-3 mt-4 rounded-2xl"
            style={{ borderWidth: 1, borderColor: '#e53e3e' }}>
            <Icon name="Trash2" size={15} color="#e53e3e" />
            <ThemedText style={{ color: '#e53e3e', marginLeft: 6, fontWeight: '500' }}>
              Remove companion
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>

      {/* Sticky save button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-4"
        style={{
          backgroundColor: colors.bg,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: -3 },
          shadowRadius: 12,
          elevation: 8,
        }}>
        <Pressable
          onPress={handleSave}
          disabled={!isDirty || isSaving}
          className="rounded-2xl py-4 items-center justify-center"
          style={{
            backgroundColor: isDirty && !isSaving ? INK : '#ccc',
          }}>
          <ThemedText style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
