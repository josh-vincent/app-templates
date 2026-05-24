import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AnimatedView from '@/components/AnimatedView';
import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import { saveToDeviceCalendar, type CalendarEvent } from '@/lib/calendarActions';
import { formatLongDay, formatRange } from '@/lib/formatDate';
import { buildItinerarySkeleton } from '@/lib/itinerarySkeleton';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import { makeSlotId, type ItineraryDay, type ItinerarySlot, type ItinerarySlotKind, type Trip } from '@/lib/tripTypes';
import {
  addItinerarySlot,
  ensureItineraryDays,
  getTripById,
  removeItinerarySlot,
  setTripNotes,
  updateItineraryDays,
  updateItinerarySlot,
} from '@/utils/tripStorage';
import { listSavedActivities, type SavedActivity } from '@/utils/discoverStorage';
import { listSavedStays } from '@/utils/staysStorage';
import type { SavedStay } from '@/lib/stayTypes';

type AddSheet =
  | { kind: 'closed' }
  | { kind: 'open'; dayDate: string };

const KIND_ICON: Record<ItinerarySlotKind, string> = {
  activity: 'MapPin',
  stay: 'BedDouble',
  flight: 'Plane',
  note: 'StickyNote',
};

const KIND_ACCENT: Record<ItinerarySlotKind, string> = {
  activity: '#c97d4a',
  stay: '#1f6b43',
  flight: '#131a2a',
  note: '#7b6e8c',
};

export default function ItineraryEditor() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const isDark = themeColors.isDark;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);
  const [savedStays, setSavedStays] = useState<SavedStay[]>([]);
  const [sheet, setSheet] = useState<AddSheet>({ kind: 'closed' });
  const [notesDraft, setNotesDraft] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    let t = await getTripById(String(tripId));
    if (t && t.itineraryDays.length === 0) {
      t = (await ensureItineraryDays(t.id)) ?? t;
    }
    setTrip(t ?? null);
    setNotesDraft(t?.notes ?? '');
    const [acts, stays] = await Promise.all([listSavedActivities(), listSavedStays()]);
    setSavedActivities(acts);
    setSavedStays(stays);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const tripActivities = useMemo(
    () => savedActivities.filter((a) => trip?.activityIds.includes(a.id)),
    [savedActivities, trip],
  );
  const tripStays = useMemo(
    () => savedStays.filter((s) => trip?.stayIds.includes(s.id)),
    [savedStays, trip],
  );

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
        <TopBar isDark={isDark} title="Itinerary" />
        <View className="flex-1 items-center justify-center px-6">
          <Icon name="Compass" size={42} color={INK} />
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 18, marginTop: 12 }}>
            Trip not found
          </Text>
        </View>
      </View>
    );
  }

  const addNoteSlot = async (dayDate: string) => {
    setSheet({ kind: 'closed' });
    await addItinerarySlot(trip.id, dayDate, {
      id: makeSlotId('note'),
      kind: 'note',
      title: 'New note',
      time: '12:00',
    });
    load();
  };

  const addActivitySlot = async (dayDate: string, a: SavedActivity) => {
    setSheet({ kind: 'closed' });
    await addItinerarySlot(trip.id, dayDate, {
      id: makeSlotId('act'),
      kind: 'activity',
      title: a.title,
      detail: a.blurb,
      time: a.when.includes('morning') ? '10:00' : a.when.includes('evening') || a.when.includes('night') ? '20:00' : '15:00',
      ref: { activityId: a.id },
    });
    load();
  };

  const addStaySlot = async (dayDate: string, s: SavedStay) => {
    setSheet({ kind: 'closed' });
    await addItinerarySlot(trip.id, dayDate, {
      id: makeSlotId('stay'),
      kind: 'stay',
      title: `Check in · ${s.name}`,
      detail: s.neighborhood ?? s.cityName,
      time: '15:30',
      ref: { stayId: s.id },
    });
    load();
  };

  const removeSlot = async (dayDate: string, slotId: string) => {
    await removeItinerarySlot(trip.id, dayDate, slotId);
    load();
  };

  const cycleTime = async (dayDate: string, slot: ItinerarySlot) => {
    const order = ['08:30', '10:00', '12:30', '15:00', '17:30', '19:30', '21:00'];
    const idx = order.indexOf(slot.time ?? '12:00');
    const next = order[(idx + 1) % order.length];
    await updateItinerarySlot(trip.id, dayDate, slot.id, { time: next });
    load();
  };

  const resetDay = async (dayDate: string) => {
    const skel = buildItinerarySkeleton({
      destination: trip.primaryDestinationName,
      startDate: dayDate,
      days: 1,
    });
    const days = trip.itineraryDays.map((d) =>
      d.date === dayDate ? { ...d, slots: skel[0]?.slots ?? [] } : d,
    );
    await updateItineraryDays(trip.id, days);
    load();
  };

  const exportToCalendar = async () => {
    const events: CalendarEvent[] = trip.itineraryDays.flatMap((d) =>
      d.slots.map((s) => ({
        title: `${trip.primaryDestinationName}: ${s.title}`,
        start: makeIsoFromDateAndTime(d.date, s.time ?? '12:00'),
        end: makeIsoFromDateAndTime(d.date, addOneHour(s.time ?? '12:00')),
        notes: s.detail,
      })),
    );
    const result = await saveToDeviceCalendar(events);
    if (result.success) {
      Alert.alert('Exported', `${events.length} slots written to your calendar.`);
    } else {
      Alert.alert('Could not export', result.error ?? 'Calendar permission was denied.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <TopBar isDark={isDark} title={trip.primaryDestinationName} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 12,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
          Itinerary
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 30,
            letterSpacing: -0.4,
            marginTop: 4,
            lineHeight: 34,
          }}>
          {trip.title}
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.55,
            fontSize: 13,
            marginTop: 4,
            fontStyle: 'italic',
          }}>
          {trip.itineraryDays.length} day{trip.itineraryDays.length === 1 ? '' : 's'} · drag time to nudge, long-press to remove
        </Text>

        <AnimatedView animation="scaleIn" className="mt-4">
          {trip.itineraryDays.map((day, i) => (
            <DayCard
              key={day.date}
              day={day}
              dayIndex={i + 1}
              onAddSlot={() => setSheet({ kind: 'open', dayDate: day.date })}
              onCycleTime={(slot) => cycleTime(day.date, slot)}
              onRemoveSlot={(slotId) => removeSlot(day.date, slotId)}
              onResetDay={() => resetDay(day.date)}
            />
          ))}
        </AnimatedView>

        <View className="mt-3">
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              fontSize: 18,
              letterSpacing: -0.2,
              marginBottom: 8,
            }}>
            Notes
          </Text>
          <Pressable
            onPress={() => setNotesOpen(true)}
            className="rounded-2xl p-4"
            style={{ backgroundColor: PARCHMENT_DEEP, minHeight: 80 }}>
            {trip.notes ? (
              <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14, lineHeight: 20 }}>
                {trip.notes}
              </Text>
            ) : (
              <Text
                style={{
                  fontFamily: SERIF,
                  color: INK,
                  opacity: 0.55,
                  fontSize: 14,
                  fontStyle: 'italic',
                }}>
                Anything you want to remember about this trip — reservations, dress codes, vibes.
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 14,
          paddingTop: 12,
          backgroundColor: PARCHMENT,
          borderTopWidth: 1,
          borderColor: 'rgba(19,26,42,0.08)',
        }}>
        <Pressable
          onPress={exportToCalendar}
          className="rounded-full items-center justify-center flex-row"
          style={{ backgroundColor: INK, height: 50 }}>
          <Icon name="Calendar" size={14} color={PARCHMENT} />
          <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 15, marginLeft: 8 }}>
            Export day-by-day to calendar
          </Text>
        </Pressable>
      </View>

      <AddSlotSheet
        sheet={sheet}
        onClose={() => setSheet({ kind: 'closed' })}
        savedActivities={tripActivities.length > 0 ? tripActivities : savedActivities}
        savedStays={tripStays.length > 0 ? tripStays : savedStays}
        onAddNote={addNoteSlot}
        onAddActivity={addActivitySlot}
        onAddStay={addStaySlot}
      />

      <NotesModal
        open={notesOpen}
        initial={notesDraft}
        onClose={() => setNotesOpen(false)}
        onSave={async (text) => {
          await setTripNotes(trip.id, text);
          setNotesOpen(false);
          load();
        }}
      />
    </View>
  );
}

function TopBar({ isDark, title }: { isDark: boolean; title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 20,
        paddingBottom: 8,
        backgroundColor: isDark ? '#0a0a0a' : PARCHMENT,
      }}>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          className="mr-3 h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
          <Icon name="ArrowLeft" size={18} color={isDark ? PARCHMENT : INK} />
        </Pressable>
        <Text
          style={{
            fontFamily: SERIF,
            color: isDark ? PARCHMENT : INK,
            fontSize: 15,
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: 0.55,
          }}>
          Itinerary
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: isDark ? PARCHMENT : INK,
            fontSize: 15,
            marginLeft: 8,
          }}>
          · {title}
        </Text>
      </View>
    </View>
  );
}

function DayCard({
  day,
  dayIndex,
  onAddSlot,
  onCycleTime,
  onRemoveSlot,
  onResetDay,
}: {
  day: ItineraryDay;
  dayIndex: number;
  onAddSlot: () => void;
  onCycleTime: (slot: ItinerarySlot) => void;
  onRemoveSlot: (slotId: string) => void;
  onResetDay: () => void;
}) {
  return (
    <View className="rounded-3xl mb-4 overflow-hidden" style={{ backgroundColor: PARCHMENT_DEEP }}>
      <View className="flex-row items-end justify-between" style={{ padding: 18, paddingBottom: 8 }}>
        <View>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 11,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>
            Day {dayIndex}
          </Text>
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 22, marginTop: 2 }}>
            {formatLongDay(day.date)}
          </Text>
          {day.theme ? (
            <Text
              style={{
                fontFamily: SERIF,
                color: INK,
                opacity: 0.6,
                fontSize: 13,
                fontStyle: 'italic',
                marginTop: 2,
              }}>
              {day.theme}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onResetDay}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
          <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.65, fontSize: 11 }}>Reset</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        {day.slots.length === 0 ? (
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.5,
              fontSize: 13,
              fontStyle: 'italic',
              marginVertical: 8,
            }}>
            Nothing scheduled. Add an activity, stay, or note.
          </Text>
        ) : (
          day.slots.map((slot, idx) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              isFirst={idx === 0}
              onPressTime={() => onCycleTime(slot)}
              onLongPress={() =>
                Alert.alert('Remove from day?', slot.title, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => onRemoveSlot(slot.id) },
                ])
              }
            />
          ))
        )}
        <Pressable
          onPress={onAddSlot}
          className="self-start flex-row items-center mt-2 px-3 py-2 rounded-full"
          style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
          <Icon name="Plus" size={12} color={INK} />
          <Text style={{ fontFamily: SERIF, color: INK, fontSize: 12, marginLeft: 6 }}>Add to day</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SlotRow({
  slot,
  isFirst,
  onPressTime,
  onLongPress,
}: {
  slot: ItinerarySlot;
  isFirst: boolean;
  onPressTime: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      className="flex-row items-start"
      style={{
        paddingVertical: 10,
        borderTopWidth: isFirst ? 0 : 1,
        borderColor: 'rgba(19,26,42,0.06)',
      }}>
      <Pressable
        onPress={onPressTime}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        className="mr-3 items-center"
        style={{ width: 52 }}>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            fontSize: 14,
          }}>
          {slot.time ?? '—'}
        </Text>
        <Text
          style={{
            fontFamily: SERIF,
            color: INK,
            opacity: 0.4,
            fontSize: 9,
            marginTop: 2,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}>
          tap to nudge
        </Text>
      </Pressable>
      <View
        className="w-7 h-7 items-center justify-center rounded-full mr-3"
        style={{ backgroundColor: KIND_ACCENT[slot.kind] + '22' }}>
        <Icon name={KIND_ICON[slot.kind] as any} size={12} color={KIND_ACCENT[slot.kind]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: SERIF, color: INK, fontSize: 15 }}>{slot.title}</Text>
        {slot.detail ? (
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.6,
              fontSize: 12,
              marginTop: 2,
              lineHeight: 17,
            }}>
            {slot.detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function AddSlotSheet({
  sheet,
  onClose,
  savedActivities,
  savedStays,
  onAddNote,
  onAddActivity,
  onAddStay,
}: {
  sheet: AddSheet;
  onClose: () => void;
  savedActivities: SavedActivity[];
  savedStays: SavedStay[];
  onAddNote: (date: string) => void;
  onAddActivity: (date: string, a: SavedActivity) => void;
  onAddStay: (date: string, s: SavedStay) => void;
}) {
  const insets = useSafeAreaInsets();
  const open = sheet.kind === 'open';
  const date = open ? sheet.dayDate : '';
  return (
    <Modal visible={open} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PARCHMENT, paddingTop: 12 }}>
        <View className="px-5 flex-row items-center pb-4">
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
            <Icon name="X" size={18} color={INK} />
          </Pressable>
          <Text style={{ fontFamily: SERIF, fontSize: 20, color: INK, marginLeft: 12 }}>
            Add to {date ? formatLongDay(date) : ''}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 64 }}>
          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
            Saved activities
          </Text>
          {savedActivities.length === 0 ? (
            <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 13, fontStyle: 'italic' }}>
              Open Discover to save activities. They'll appear here.
            </Text>
          ) : (
            savedActivities.slice(0, 12).map((a) => (
              <Pressable
                key={a.id}
                onPress={() => date && onAddActivity(date, a)}
                className="rounded-2xl flex-row items-center mb-2 p-3"
                style={{ backgroundColor: PARCHMENT_COOL }}>
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: KIND_ACCENT.activity + '22' }}>
                  <Icon name="MapPin" size={14} color={KIND_ACCENT.activity} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>{a.title}</Text>
                  <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 11 }}>
                    {a.city} · {a.kind} · {a.when}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          <Text
            style={{
              fontFamily: SERIF,
              color: INK,
              opacity: 0.55,
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginTop: 16,
              marginBottom: 8,
            }}>
            Saved stays
          </Text>
          {savedStays.length === 0 ? (
            <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 13, fontStyle: 'italic' }}>
              No saved stays on this trip yet.
            </Text>
          ) : (
            savedStays.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => date && onAddStay(date, s)}
                className="rounded-2xl flex-row items-center mb-2 p-3"
                style={{ backgroundColor: PARCHMENT_COOL }}>
                <View
                  className="w-9 h-9 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: KIND_ACCENT.stay + '22' }}>
                  <Icon name="BedDouble" size={14} color={KIND_ACCENT.stay} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>{s.name}</Text>
                  <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 11 }}>
                    {s.cityName} · {formatRange(s.checkIn, s.checkOut, { sameMonthCompact: true })}
                  </Text>
                </View>
              </Pressable>
            ))
          )}

          <Pressable
            onPress={() => date && onAddNote(date)}
            className="rounded-2xl flex-row items-center mt-6 p-3"
            style={{ backgroundColor: PARCHMENT_COOL }}>
            <View
              className="w-9 h-9 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: KIND_ACCENT.note + '22' }}>
              <Icon name="StickyNote" size={14} color={KIND_ACCENT.note} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: SERIF, color: INK, fontSize: 14 }}>Add a blank note</Text>
              <Text style={{ fontFamily: SERIF, color: INK, opacity: 0.55, fontSize: 11 }}>
                Free-text slot · edit later
              </Text>
            </View>
            <Icon name="ChevronRight" size={14} color={INK} />
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function NotesModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);
  return (
    <Modal visible={open} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PARCHMENT, paddingTop: 12 }}>
        <View className="px-5 flex-row items-center pb-4">
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19,26,42,0.06)' }}>
            <Icon name="X" size={18} color={INK} />
          </Pressable>
          <Text style={{ fontFamily: SERIF, fontSize: 20, color: INK, marginLeft: 12 }}>Notes</Text>
          <Pressable
            onPress={() => onSave(text)}
            className="ml-auto px-4 py-2 rounded-full"
            style={{ backgroundColor: INK }}>
            <Text style={{ fontFamily: SERIF, color: PARCHMENT, fontSize: 13 }}>Save</Text>
          </Pressable>
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Reservations, dress codes, vibes…"
          placeholderTextColor="rgba(19,26,42,0.35)"
          style={{
            flex: 1,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 32,
            fontFamily: SERIF,
            color: INK,
            fontSize: 16,
            textAlignVertical: 'top',
          }}
        />
      </View>
    </Modal>
  );
}

function makeIsoFromDateAndTime(date: string, time: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(hh ?? 12, mm ?? 0, 0, 0);
  return d.toISOString();
}
function addOneHour(time: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const next = (hh + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(mm ?? 0).padStart(2, '0')}`;
}
