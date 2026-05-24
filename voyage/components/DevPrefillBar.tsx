/**
 * DevPrefillBar — __DEV__-only floating pill bar that prefills form-heavy screens.
 * Renders null in production builds and when the fields array is empty.
 *
 * Usage: drop above your form's scroll area and wire each field's callback to
 * the relevant form setter. No consumer integration is done here.
 */

import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';

import type { TravelerProfile, Passport } from '@/lib/travelerProfileTypes';
import { INK, PARCHMENT, PARCHMENT_DEEP, BRICK, SERIF } from '@/lib/theme';
import { getOwnerProfile, listCompanions } from '@/utils/travelerProfileStorage';
import {
  listPaymentMethods,
  type PaymentMethod,
} from '@/utils/paymentMethodsStorage';

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

type PassengerField = {
  key: 'passenger';
  onUseProfile: (profile: TravelerProfile) => void;
  label?: string;
};

type PassportField = {
  key: 'passport';
  onUsePassport: (passport: Passport) => void;
  label?: string;
};

type CardField = {
  key: 'card';
  onUseCard: (last4: string, holderName: string) => void;
  label?: string;
};

type MockField = {
  key: 'mock';
  onFillMock: () => void;
  label?: string;
};

type CompanionField = {
  key: 'companion';
  onUseCompanion: (profile: TravelerProfile) => void;
  label?: string;
};

type ClearField = {
  key: 'clear';
  onClear: () => void;
  label?: string;
};

export type DevPrefillBarField =
  | PassengerField
  | PassportField
  | CardField
  | MockField
  | CompanionField
  | ClearField;

export type DevPrefillBarProps = {
  /** Fields to expose buttons for. Order is preserved. */
  fields: DevPrefillBarField[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function brandLabel(brand: PaymentMethod['brand']): string {
  switch (brand) {
    case 'visa':
      return 'Visa';
    case 'mastercard':
      return 'MC';
    case 'amex':
      return 'Amex';
    case 'discover':
      return 'Discover';
    default:
      return 'Card';
  }
}

/** Short first name: "Alex Morgan" → "Alex" */
function shortName(p: TravelerProfile): string {
  return p.nickname ?? (p.givenName || p.familyName || 'Traveler');
}

// ---------------------------------------------------------------------------
// Chip sub-component
// ---------------------------------------------------------------------------

type ChipConfig = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

function PrefillChip({ label, onPress, disabled = false }: ChipConfig) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      style={[styles.chip, disabled && styles.chipDisabled]}
    >
      <Text style={[styles.chipText, disabled && styles.chipTextDisabled]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DevPrefillBar({ fields }: DevPrefillBarProps) {
  // Return null immediately in production or when there's nothing to render.
  if (!__DEV__) return null;
  if (!fields || fields.length === 0) return null;

  return <DevPrefillBarInner fields={fields} />;
}

/**
 * Inner component so the hook calls are never placed after early returns
 * (which would violate Rules of Hooks).
 */
function DevPrefillBarInner({ fields }: DevPrefillBarProps) {
  const [owner, setOwner] = useState<TravelerProfile | null>(null);
  const [companions, setCompanions] = useState<TravelerProfile[]>([]);
  const [defaultCard, setDefaultCard] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [ownerResult, companionResult, cardResult] = await Promise.all([
          getOwnerProfile(),
          listCompanions(),
          listPaymentMethods(),
        ]);
        if (cancelled) return;
        setOwner(ownerResult);
        setCompanions(companionResult);
        const def = cardResult.find((m) => m.isDefault) ?? cardResult[0] ?? null;
        setDefaultCard(def);
      } catch {
        // Storage errors should never crash the dev bar — just leave state null/empty.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the ordered list of chips from the fields spec.
  const chips: ChipConfig[] = [];

  for (const field of fields) {
    switch (field.key) {
      case 'passenger': {
        if (owner) {
          chips.push({
            label: field.label ?? `Fill: ${shortName(owner)} (you)`,
            onPress: () => field.onUseProfile(owner),
          });
        } else {
          // Not yet loaded — show a placeholder disabled chip.
          chips.push({ label: 'Fill: loading…', disabled: true });
        }
        break;
      }

      case 'passport': {
        const passport = owner?.passport;
        if (passport) {
          chips.push({
            label: field.label ?? `+ Passport: ${passport.number}`,
            onPress: () => field.onUsePassport(passport),
          });
        } else {
          chips.push({
            label: field.label ?? '+ Passport: none',
            disabled: true,
          });
        }
        break;
      }

      case 'card': {
        if (defaultCard) {
          chips.push({
            label:
              field.label ??
              `+ Card: ${brandLabel(defaultCard.brand)} •${defaultCard.cardLast4}`,
            onPress: () =>
              field.onUseCard(defaultCard.cardLast4, defaultCard.cardHolder),
          });
        } else {
          chips.push({
            label: field.label ?? '+ Card: none',
            disabled: true,
          });
        }
        break;
      }

      case 'mock': {
        chips.push({
          label: field.label ?? '+ Random data',
          onPress: () => field.onFillMock(),
        });
        break;
      }

      case 'companion': {
        if (companions.length === 0) {
          chips.push({ label: 'Fill companion: none', disabled: true });
        } else {
          for (const companion of companions) {
            chips.push({
              label: field.label
                ? `${field.label}: ${shortName(companion)}`
                : `Fill: ${shortName(companion)}`,
              onPress: () => field.onUseCompanion(companion),
            });
          }
        }
        break;
      }

      case 'clear': {
        chips.push({
          label: field.label ?? 'Clear all',
          onPress: () => field.onClear(),
        });
        break;
      }
    }
  }

  return (
    <View style={styles.wrapper}>
      {/* Left accent + DEV badge */}
      <View style={styles.accentBar} />
      <View style={styles.devBadge}>
        <Text style={styles.devBadgeText}>DEV</Text>
      </View>

      {/* Scrollable pill row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {chips.map((chip, i) => (
          <PrefillChip key={`${chip.label}-${i}`} {...chip} />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PARCHMENT,
    borderTopWidth: 1,
    borderTopColor: PARCHMENT_DEEP,
    // Subtle shadow so it floats above the form.
    shadowColor: INK,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: BRICK,
  },
  devBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 6,
    backgroundColor: BRICK,
    borderRadius: 4,
  },
  devBadgeText: {
    fontFamily: SERIF,
    fontSize: 9,
    color: PARCHMENT,
    letterSpacing: 0.5,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    backgroundColor: PARCHMENT_DEEP,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontFamily: SERIF,
    fontSize: 12,
    color: INK,
    lineHeight: 16,
  },
  chipTextDisabled: {
    // Inherits reduced opacity from chipDisabled; no additional change needed.
  },
});
