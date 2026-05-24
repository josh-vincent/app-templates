import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { PARCHMENT, INK } from '@/lib/theme';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';

import ThemedText from '@/components/ThemedText';
import ThemedScroller from '@/components/ThemeScroller';
import ThemeFooter from '@/components/ThemeFooter';
import Header from '@/components/Header';
import Section from '@/components/layout/Section';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import Slider from '@/components/forms/Slider';
import { TimePicker } from '@/components/forms/TimePicker';

import {
  defaultFilters,
  listFilters,
  saveFilters,
  filtersAreEmpty,
  type StoredFlightFilters,
} from '@/lib/flightFilters';

// --- helpers ---

/** Convert a Date to 'HH:MM' 24h string */
function dateToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Convert 'HH:MM' to a Date object (today's date, for TimePicker) */
function hhmmToDate(hhmm: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return d;
}

type StopOption = { label: string; value: 0 | 1 | 2 | undefined };
const STOP_OPTIONS: StopOption[] = [
  { label: 'Nonstop', value: 0 },
  { label: '1 stop', value: 1 },
  { label: 'Up to 2', value: 2 },
  { label: 'Any', value: undefined },
];

type CabinKey = 'economy' | 'premium_economy' | 'business' | 'first';
const CABIN_OPTIONS: { label: string; value: CabinKey }[] = [
  { label: 'Economy', value: 'economy' },
  { label: 'Premium Economy', value: 'premium_economy' },
  { label: 'Business', value: 'business' },
  { label: 'First', value: 'first' },
];

const MAX_PRICE = 5000;
const PRICE_STEP = 50;
const MAX_DURATION_HOURS = 24;

export default function FiltersScreen() {
  const router = useRouter();

  const [filters, setFilters] = useState<StoredFlightFilters>(defaultFilters());
  const [loaded, setLoaded] = useState(false);

  // Load saved filters on mount / focus
  useFocusEffect(
    useCallback(() => {
      listFilters().then((f) => {
        setFilters(f);
        setLoaded(true);
      });
    }, []),
  );

  // ---- derived state helpers ----

  const maxPrice = filters.maxPrice;
  const maxStops = filters.maxStops;
  const cabins = filters.cabins ?? [];
  const earliestDepart = filters.earliestDepart
    ? hhmmToDate(filters.earliestDepart)
    : undefined;
  const latestDepart = filters.latestDepart
    ? hhmmToDate(filters.latestDepart)
    : undefined;
  const maxDurationMinutes = filters.maxDurationMinutes;

  const patch = (partial: Partial<StoredFlightFilters>) =>
    setFilters((prev) => ({ ...prev, ...partial }));

  // ---- handlers ----

  const toggleCabin = (cabin: CabinKey) => {
    const next = cabins.includes(cabin)
      ? cabins.filter((c) => c !== cabin)
      : [...cabins, cabin];
    patch({ cabins: next.length ? next : undefined });
  };

  const handleApply = async () => {
    await saveFilters(filters);
    router.back();
  };

  const handleReset = () => {
    setFilters(defaultFilters());
  };

  if (!loaded) return null;

  const isEmpty = filtersAreEmpty(filters);

  return (
    <>
      <Header showBackButton title="Filters" />
      <ThemedScroller className="flex-1 dark:bg-dark-primary" style={{ backgroundColor: PARCHMENT }}>
        {/* Active filter badge */}
        <View className="flex-row mb-4">
          <View
            className={`px-3 py-1 rounded-full ${isEmpty ? 'bg-light-secondary dark:bg-dark-secondary' : 'bg-highlight'}`}
          >
            <ThemedText
              className={`text-xs font-semibold ${isEmpty ? '' : 'text-white'}`}
            >
              {isEmpty ? 'All offers' : 'Filters active'}
            </ThemedText>
          </View>
        </View>

        {/* Price */}
        <Section
          className="mb-7 pb-7 border-b border-light-secondary dark:border-dark-secondary"
          title="Max price"
          subtitle={
            maxPrice !== undefined ? `Up to $${maxPrice}` : 'Any price'
          }
        >
          <Slider
            minValue={0}
            maxValue={MAX_PRICE}
            step={PRICE_STEP}
            value={maxPrice ?? MAX_PRICE}
            onValueChange={(v) =>
              patch({ maxPrice: v >= MAX_PRICE ? undefined : Math.round(v) })
            }
            size="m"
          />
          <View className="flex-row justify-between mt-1">
            <ThemedText className="text-xs opacity-50">$0</ThemedText>
            <ThemedText className="text-xs opacity-50">$5,000+</ThemedText>
          </View>
        </Section>

        {/* Stops */}
        <Section
          className="mb-7 pb-7 border-b border-light-secondary dark:border-dark-secondary"
          title="Stops"
        >
          <View className="flex-row flex-wrap gap-2 mt-2">
            {STOP_OPTIONS.map((opt) => (
              <Chip
                key={String(opt.value)}
                label={opt.label}
                size="lg"
                isSelected={maxStops === opt.value}
                onPress={() => patch({ maxStops: opt.value })}
              />
            ))}
          </View>
        </Section>

        {/* Cabin */}
        <Section
          className="mb-7 pb-7 border-b border-light-secondary dark:border-dark-secondary"
          title="Cabin class"
          subtitle="Select one or more"
        >
          <View className="flex-row flex-wrap gap-2 mt-2">
            {CABIN_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                size="lg"
                isSelected={cabins.includes(opt.value)}
                onPress={() => toggleCabin(opt.value)}
              />
            ))}
          </View>
        </Section>

        {/* Departure window */}
        <Section
          className="mb-7 pb-7 border-b border-light-secondary dark:border-dark-secondary"
          title="Departure window"
          subtitle="Filter by first outbound departure"
        >
          <View className="flex-row gap-3 mt-2">
            <View className="flex-1">
              <TimePicker
                label="Earliest"
                variant="classic"
                is24Hour
                value={earliestDepart}
                onChange={(d) => patch({ earliestDepart: dateToHHMM(d) })}
              />
            </View>
            <View className="flex-1">
              <TimePicker
                label="Latest"
                variant="classic"
                is24Hour
                value={latestDepart}
                onChange={(d) => patch({ latestDepart: dateToHHMM(d) })}
              />
            </View>
          </View>
          {(filters.earliestDepart || filters.latestDepart) && (
            <Button
              title="Clear times"
              variant="ghost"
              size="small"
              onPress={() => patch({ earliestDepart: undefined, latestDepart: undefined })}
            />
          )}
        </Section>

        {/* Max flight duration */}
        <Section
          className="mb-7 pb-7 border-b border-light-secondary dark:border-dark-secondary"
          title="Max flight duration"
          subtitle={
            maxDurationMinutes !== undefined
              ? `Up to ${Math.round(maxDurationMinutes / 60)}h`
              : 'Any duration'
          }
        >
          <Slider
            minValue={60}
            maxValue={MAX_DURATION_HOURS * 60}
            step={30}
            value={maxDurationMinutes ?? MAX_DURATION_HOURS * 60}
            onValueChange={(v) =>
              patch({
                maxDurationMinutes:
                  v >= MAX_DURATION_HOURS * 60 ? undefined : Math.round(v),
              })
            }
            size="m"
          />
          <View className="flex-row justify-between mt-1">
            <ThemedText className="text-xs opacity-50">1h</ThemedText>
            <ThemedText className="text-xs opacity-50">24h+</ThemedText>
          </View>
        </Section>
      </ThemedScroller>

      <ThemeFooter>
        <View className="flex-row gap-3">
          <Button
            title="Reset all"
            variant="outline"
            rounded="full"
            size="large"
            className="flex-1"
            onPress={handleReset}
          />
          <Button
            title="Apply"
            rounded="full"
            size="large"
            className="flex-1"
            style={{ backgroundColor: INK }}
            textClassName="text-white"
            onPress={handleApply}
          />
        </View>
      </ThemeFooter>
    </>
  );
}
