import { Modal, Pressable, View, Platform, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import Icon from './Icon';
import ThemedText from './ThemedText';
import Counter from './forms/Counter';
import Divider from './layout/Divider';
import AnimatedView from './AnimatedView';
import DateRangeCalendar from './DateRangeCalendar';
import { Button } from './Button';
import { useFlightSearch } from '@/contexts/FlightSearchContext';
import { searchAirports } from '@/lib/airports';
import type { CabinClass } from '@/lib/flightTypes';

const CABINS: { value: CabinClass; label: string }[] = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First' },
];

export default function SearchBar() {
  const [showModal, setShowModal] = useState(false);
  const { params } = useFlightSearch();
  const label = params.origin && params.destination
    ? `${params.origin} → ${params.destination}`
    : 'Where to?';

  return (
    <>
      <View className="px-global bg-light-primary dark:bg-dark-primary w-full relative z-50">
        <Pressable onPress={() => setShowModal(true)}>
          <View
            style={{ elevation: 6, height: 50, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
            className="bg-light-primary flex-row items-center justify-center py-3 px-6 mt-3 mb-4 dark:bg-white/10 rounded-full"
          >
            <Icon name="Search" size={16} strokeWidth={3} />
            <ThemedText className="font-medium ml-2">{label}</ThemedText>
          </View>
        </Pressable>
      </View>
      <SearchModal showModal={showModal} setShowModal={setShowModal} />
    </>
  );
}

function SearchModal({
  showModal,
  setShowModal,
}: {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const { params, setParams } = useFlightSearch();
  const [open, setOpen] = useState<'where' | 'when' | 'who' | null>('where');
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');

  const onSubmit = () => {
    if (!params.origin || !params.destination || !params.departureDate) return;
    setShowModal(false);
    router.push({
      pathname: '/(tabs)/(home)',
      params: {
        origin: params.origin,
        destination: params.destination,
        departureDate: params.departureDate,
        returnDate: params.returnDate ?? '',
        adults: String(params.adults),
        cabin: params.cabin,
        t: String(Date.now()),
      },
    });
  };

  return (
    <Modal statusBarTranslucent visible={showModal} transparent animationType="fade">
      <BlurView intensity={20} tint="systemUltraThinMaterialLight" className="flex-1">
        <AnimatedView className="flex-1" animation="slideInTop" duration={Platform.OS === 'ios' ? 400 : 0}>
          <View className="flex-1 bg-neutral-100/90 dark:bg-black/95" style={{ paddingTop: insets.top + 10 }}>
            <View className="flex-row justify-between items-center px-5 pb-3">
              <Pressable onPress={() => setShowModal(false)} className="w-10 h-10 rounded-full bg-light-secondary dark:bg-dark-secondary items-center justify-center">
                <Icon name="X" size={18} />
              </Pressable>
              <ThemedText className="font-bold text-base">Find flights</ThemedText>
              <View className="w-10" />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-4">
              <SectionCard
                label="Where"
                open={open === 'where'}
                onToggle={() => setOpen(open === 'where' ? null : 'where')}
                summary={
                  params.origin && params.destination
                    ? `${params.origin} → ${params.destination}`
                    : 'Pick airports'
                }
              >
                <AirportPicker
                  title="From"
                  query={originQuery}
                  onQuery={setOriginQuery}
                  selected={params.origin}
                  onPick={(code) => {
                    setParams({ origin: code });
                    setOriginQuery('');
                  }}
                />
                <Divider className="my-3" />
                <AirportPicker
                  title="To"
                  query={destQuery}
                  onQuery={setDestQuery}
                  selected={params.destination}
                  onPick={(code) => {
                    setParams({ destination: code });
                    setDestQuery('');
                    setOpen('when');
                  }}
                />
              </SectionCard>

              <SectionCard
                label="When"
                open={open === 'when'}
                onToggle={() => setOpen(open === 'when' ? null : 'when')}
                summary={
                  params.departureDate
                    ? params.returnDate
                      ? `${params.departureDate} → ${params.returnDate}`
                      : params.departureDate
                    : 'Pick dates'
                }
              >
                <DateRangeCalendar
                  initialRange={{
                    startDate: params.departureDate,
                    endDate: params.returnDate,
                  }}
                  minDate={new Date().toISOString().slice(0, 10)}
                  onDateRangeChange={(r) =>
                    setParams({
                      departureDate: r.startDate,
                      returnDate: r.endDate,
                    })
                  }
                />
              </SectionCard>

              <SectionCard
                label="Who"
                open={open === 'who'}
                onToggle={() => setOpen(open === 'who' ? null : 'who')}
                summary={`${params.adults} adult${params.adults > 1 ? 's' : ''} · ${labelForCabin(params.cabin)}`}
              >
                <View className="flex-row items-center justify-between py-2">
                  <ThemedText>Adults</ThemedText>
                  <Counter
                    value={params.adults}
                    min={1}
                    max={9}
                    onChange={(v) => setParams({ adults: v ?? 1 })}
                  />
                </View>
                <Divider className="my-2" />
                <ThemedText className="mt-2 mb-2 text-sm opacity-60">Cabin</ThemedText>
                <View className="flex-row flex-wrap">
                  {CABINS.map((c) => (
                    <Pressable
                      key={c.value}
                      onPress={() => setParams({ cabin: c.value })}
                      className={`px-3 py-2 mr-2 mb-2 rounded-full border ${params.cabin === c.value ? 'bg-black border-black dark:bg-white dark:border-white' : 'border-neutral-300 dark:border-neutral-700'}`}
                    >
                      <ThemedText className={`text-sm ${params.cabin === c.value ? 'text-white dark:text-black' : ''}`}>
                        {c.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </SectionCard>
            </ScrollView>

            <View style={{ paddingBottom: insets.bottom + 12 }} className="absolute bottom-0 left-0 right-0 px-5 bg-transparent">
              <Button title="Search" onPress={onSubmit} className="w-full" />
            </View>
          </View>
        </AnimatedView>
      </BlurView>
    </Modal>
  );
}

function SectionCard({
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-light-primary dark:bg-dark-secondary rounded-2xl mb-3 p-4">
      <Pressable onPress={onToggle} className="flex-row justify-between items-center">
        <ThemedText className="font-bold">{label}</ThemedText>
        <ThemedText className="opacity-70">{summary}</ThemedText>
      </Pressable>
      {open ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}

function AirportPicker({
  title,
  query,
  onQuery,
  selected,
  onPick,
}: {
  title: string;
  query: string;
  onQuery: (q: string) => void;
  selected?: string;
  onPick: (code: string) => void;
}) {
  const results = searchAirports(query || '').slice(0, 6);
  return (
    <View>
      <ThemedText className="text-sm opacity-60 mb-1">{title}</ThemedText>
      <View className="flex-row items-center bg-light-secondary dark:bg-dark-primary rounded-full px-4 py-2">
        <Icon name="Search" size={14} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder={selected ? `${selected} (change)` : 'Search city or IATA code'}
          className="flex-1 ml-2"
          placeholderTextColor="#999"
        />
      </View>
      {(query || !selected) && results.length ? (
        <View className="mt-2">
          {results.map((a) => (
            <Pressable
              key={a.iata}
              onPress={() => onPick(a.iata)}
              className="flex-row items-center justify-between py-2"
            >
              <View className="flex-1 pr-2">
                <ThemedText className="font-medium">
                  {a.city} · {a.iata}
                </ThemedText>
                <ThemedText className="text-xs opacity-60">{a.name}</ThemedText>
              </View>
              {selected === a.iata ? <Icon name="Check" size={16} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function labelForCabin(c: CabinClass) {
  return CABINS.find((x) => x.value === c)?.label ?? 'Economy';
}
