import { useMutation, useQuery } from '@/lib/persona-convex';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getActivity } from '@/lib/activities';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 22;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

// Match threshold for "photo location matches device location" (meters).
const PHOTO_MATCH_RADIUS_M = 250;

// Defensive lazy-requires.
function tryLoadImagePicker() {
  try {
    return require('expo-image-picker') as typeof import('expo-image-picker');
  } catch {
    return null;
  }
}
function tryLoadLocation() {
  try {
    return require('expo-location') as typeof import('expo-location');
  } catch {
    return null;
  }
}

type GpsState =
  | { status: 'unknown' }
  | { status: 'requesting' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'locked'; lat: number; lng: number; accuracy: number | null };

type PhotoExif = {
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  cameraStripped: boolean;
};

export default function SubmitProof() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { participantId, forDate: forDateParam } = useLocalSearchParams<{
    participantId: string;
    forDate?: string;
  }>();

  const lookup = useQuery(
    api.challenges.getParticipant,
    participantId ? { id: participantId as Id<'participants'> } : 'skip'
  );
  const activity = getActivity(lookup?.activityKey);
  const challenge = lookup?.challenge;
  const challengeId = challenge?._id;
  const sessionGoal = challenge?.stepGoal ?? 1;
  const isMultiSession = !activity.sensor && sessionGoal > 1;
  // Day this check-in covers. URL param wins so the bet detail strip can
  // open the proof screen pre-targeted at a missed day; otherwise default
  // to today (UTC).
  const todayUtc = new Date().toISOString().slice(0, 10);
  const [forDate, setForDate] = useState<string>(forDateParam || todayUtc);

  const generateUploadUrl = useMutation(api.challenges.generateUploadUrl);
  const submitProof = useMutation(api.challenges.submitProof);
  const backfillFromPings = useMutation(api.proofs.backfillFromPings);

  const pingSummary = useQuery(
    api.location.pingSummaryForChallenge,
    challengeId ? { challengeId } : 'skip'
  );
  const checkIns = useQuery(
    api.proofs.myCheckIns,
    participantId ? { participantId: participantId as Id<'participants'> } : 'skip'
  );
  const pingDays = useQuery(
    api.proofs.pingDayCandidates,
    participantId ? { participantId: participantId as Id<'participants'> } : 'skip'
  );

  // imageUris is the canonical photo set for this submission. Index 0 is the
  // primary photo whose EXIF gates the camera-photo / window checks.
  const [imageUris, setImageUris] = useState<{ uri: string; mime: string }[]>([]);
  const [photoExif, setPhotoExif] = useState<PhotoExif | null>(null);
  const [score, setScore] = useState('');
  const [note, setNote] = useState('');
  const [gps, setGps] = useState<GpsState>({ status: 'unknown' });
  const [busy, setBusy] = useState<'capture' | 'library' | 'gps' | 'submit' | string | null>(null);

  const wantsScore = activity.goalKind === 'score';
  const wantsScorecard = activity.proofKinds.includes('scorecard');

  // Pre-warm: try to acquire a location lock as soon as the screen opens.
  useEffect(() => {
    captureGps('background');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function captureGps(mode: 'background' | 'foreground') {
    const Location = tryLoadLocation();
    if (!Location) {
      setGps({ status: 'unavailable' });
      if (mode === 'foreground') {
        Alert.alert(
          'Location not wired',
          'Run `npx expo prebuild` and rebuild to enable proof GPS.'
        );
      }
      return;
    }
    try {
      setGps({ status: 'requesting' });
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setGps({ status: 'denied' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGps({
        status: 'locked',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    } catch (e: any) {
      setGps({ status: 'denied' });
      if (mode === 'foreground') {
        Alert.alert('Location failed', e?.message ?? String(e));
      }
    }
  }

  async function pickFromLibrary() {
    const ImagePicker = tryLoadImagePicker();
    if (!ImagePicker) {
      Alert.alert(
        'Library not wired',
        'Run `npx expo prebuild` and rebuild to enable photo picking.'
      );
      return;
    }
    try {
      setBusy('library');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        exif: true,
        allowsMultipleSelection: true,
        selectionLimit: 4,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const added = result.assets.map((a) => ({
          uri: a.uri,
          mime: a.mimeType ?? 'image/jpeg',
        }));
        setImageUris((cur) => dedupe([...cur, ...added]).slice(0, 4));
        // EXIF reads from the first newly-picked asset since UI metadata
        // only renders one preview's worth.
        const first = result.assets[0];
        setPhotoExif(parseExif(first.exif, false));
      }
    } catch (e: any) {
      Alert.alert('Library failed', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function takePhoto() {
    const ImagePicker = tryLoadImagePicker();
    if (!ImagePicker) {
      Alert.alert('Camera not wired', 'Run `npx expo prebuild` and rebuild to enable the camera.');
      return;
    }
    try {
      setBusy('capture');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow camera access in Settings.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        exif: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const a = result.assets[0];
        setImageUris((cur) =>
          dedupe([...cur, { uri: a.uri, mime: a.mimeType ?? 'image/jpeg' }]).slice(0, 4)
        );
        setPhotoExif(parseExif(a.exif, true));
      }
    } catch (e: any) {
      Alert.alert('Camera failed', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function uploadAllImages(): Promise<Id<'_storage'>[]> {
    const ids: Id<'_storage'>[] = [];
    for (const { uri, mime } of imageUris) {
      const url = await generateUploadUrl();
      const blob = await (await fetch(uri)).blob();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': mime },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = await res.json();
      ids.push(storageId as Id<'_storage'>);
    }
    return ids;
  }

  async function onBackfillDay(date: string) {
    if (!participantId) return;
    try {
      setBusy(`backfill:${date}`);
      const res = await backfillFromPings({
        participantId: participantId as Id<'participants'>,
        date,
      });
      if (!res.ok) {
        const msg =
          res.reason === 'not_enough_pings'
            ? "Not enough background pings on that day to back-fill."
            : "Already checked in on that day.";
        Alert.alert('Could not back-fill', msg);
      } else {
        Alert.alert(
          'Backed-fill saved',
          'A check-in was added from background GPS pings. The other side can still dispute.'
        );
      }
    } catch (e: any) {
      Alert.alert('Back-fill failed', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function ensureGpsLock(): Promise<{ lat: number; lng: number } | null> {
    if (gps.status === 'locked') return { lat: gps.lat, lng: gps.lng };
    await captureGps('foreground');
    const Location = tryLoadLocation();
    if (!Location) return null;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return null;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        status: 'locked' as const,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setGps(next);
      return { lat: next.lat, lng: next.lng };
    } catch {
      return null;
    }
  }

  async function onSubmit() {
    if (!participantId) return;
    try {
      setBusy('submit');
      const lock = await ensureGpsLock();
      if (!lock) {
        Alert.alert(
          'GPS required',
          'Proof needs a device GPS lock so the other side can trust it. Enable Location for FitStake in Settings.'
        );
        return;
      }
      const imageStorageIds = await uploadAllImages();
      await submitProof({
        participantId: participantId as Id<'participants'>,
        imageStorageIds: imageStorageIds.length > 0 ? imageStorageIds : undefined,
        claimedValue: score ? Number(score) : undefined,
        gpsLat: lock.lat,
        gpsLng: lock.lng,
        photoExifLat: photoExif?.lat ?? undefined,
        photoExifLng: photoExif?.lng ?? undefined,
        photoTakenAt: photoExif?.takenAt ?? undefined,
        note: note.trim() || undefined,
        forDate,
      });
      Alert.alert(
        'Proof submitted',
        'GPS captured. The other side can dispute. Otherwise it counts on settle.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const canSubmit = gps.status === 'locked';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: PAGE_X,
            paddingTop: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Icon name="ChevronLeft" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>SUBMIT PROOF</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: PAGE_X,
            paddingTop: 18,
            paddingBottom: 110,
          }}
          showsVerticalScrollIndicator={false}>
          <Image
            source={SCENARIO_MASCOTS.proofGps}
            resizeMode="cover"
            style={{
              width: '100%',
              height: 166,
              borderRadius: 18,
              marginBottom: 18,
              backgroundColor: colors.text + '10',
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Icon name={activity.icon as any} size={26} color={GOLD} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...EYEBROW, color: GOLD }}>{activity.name.toUpperCase()}</Text>
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 2,
                  color: colors.text,
                  fontSize: 22,
                  fontWeight: '800',
                  letterSpacing: -0.5,
                }}>
                {challenge?.title ?? '—'}
              </Text>
            </View>
          </View>
          <Text
            style={{
              marginTop: 6,
              color: colors.text,
              opacity: 0.6,
              fontSize: 13,
              lineHeight: 20,
            }}>
            Trust the submitter. Photo + a device GPS lock; the other side can dispute.
          </Text>

          {/* GPS status — auto-captured, never user-edited */}
          <GpsStatusRow gps={gps} colors={colors} onRetry={() => captureGps('foreground')} />

          {/* Background pings summary */}
          {pingSummary && pingSummary.count > 0 ? (
            <View
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                backgroundColor: LIME + '14',
                borderWidth: 1,
                borderColor: LIME + '30',
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="Activity" size={12} color={LIME} />
                <Text style={{ ...EYEBROW, color: LIME }}>BACKGROUND PINGS</Text>
              </View>
              <Text
                style={{
                  marginTop: 4,
                  color: LIME,
                  fontSize: 13,
                  fontWeight: '600',
                }}>
                {pingSummary.count} location pings during this bet
              </Text>
              {pingSummary.firstAt && pingSummary.lastAt ? (
                <Text style={{ marginTop: 2, color: LIME, opacity: 0.8, fontSize: 11 }}>
                  {formatRange(pingSummary.firstAt, pingSummary.lastAt)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Check-in day selector — only for multi-session bets. Defaults
              to today; tapping a past day swaps the check-in target. */}
          {isMultiSession ? (
            <Section
              colors={colors}
              title="CHECK-IN FOR"
              sub={`${sessionGoal}-session bet · pick the day this proof covers`}>
              <DayChips
                colors={colors}
                startsAt={lookup?.startsAt ?? null}
                endsAt={lookup?.endsAt ?? null}
                today={todayUtc}
                selected={forDate}
                doneDates={
                  (checkIns ?? [])
                    .filter((c) => c.forDate && c.status !== 'disputed')
                    .map((c) => c.forDate!) as string[]
                }
                onSelect={setForDate}
              />
            </Section>
          ) : null}

          {/* Photo set — up to 4 thumbnails plus an add tile */}
          <Section
            colors={colors}
            title={wantsScorecard ? 'PHOTOS + SCORECARD' : 'PHOTOS'}
            sub={imageUris.length > 0 ? `${imageUris.length} of 4` : undefined}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {imageUris.map((img, i) => (
                <View key={`${img.uri}-${i}`}>
                  <Image
                    source={{ uri: img.uri }}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 12,
                      backgroundColor: colors.text + '14',
                    }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() =>
                      setImageUris((cur) => cur.filter((_, idx) => idx !== i))
                    }
                    hitSlop={6}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: EMBER,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="X" size={12} color={IRON} />
                  </Pressable>
                </View>
              ))}
              {imageUris.length < 4 ? (
                <Pressable
                  onPress={pickFromLibrary}
                  disabled={busy === 'library' || busy === 'capture'}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.text + '24',
                    borderStyle: 'dashed',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {busy === 'library' ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <>
                      <Icon name="Plus" size={22} color={colors.text + 'aa'} />
                      <Text
                        style={{
                          marginTop: 4,
                          color: colors.text,
                          opacity: 0.6,
                          fontSize: 10,
                          fontWeight: '700',
                        }}>
                        ADD PHOTO
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
            {imageUris.length < 4 ? (
              <Pressable
                onPress={takePhoto}
                disabled={busy === 'capture'}
                style={{
                  marginTop: 10,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.text + '20',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: busy === 'capture' ? 0.6 : 1,
                }}>
                <Icon name="Camera" size={14} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                  Take photo
                </Text>
              </Pressable>
            ) : null}
            {photoExif && imageUris.length > 0 ? (
              <PhotoMetaSummary
                exif={photoExif}
                deviceLat={gps.status === 'locked' ? gps.lat : null}
                deviceLng={gps.status === 'locked' ? gps.lng : null}
                startsAt={lookup?.startsAt ?? null}
                endsAt={lookup?.endsAt ?? null}
                colors={colors}
              />
            ) : null}
          </Section>

          {/* Prior check-ins — only when we have any */}
          {(checkIns?.length ?? 0) > 0 ? (
            <Section
              colors={colors}
              title="PRIOR CHECK-INS"
              sub={`${checkIns!.length} so far`}>
              <View style={{ marginTop: 4 }}>
                {checkIns!.map((c) => (
                  <View
                    key={c._id}
                    style={{
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: colors.text + '14',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor:
                          c.status === 'disputed'
                            ? EMBER + '24'
                            : c.derivedFromPings
                              ? GOLD + '24'
                              : LIME + '24',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Icon
                        name={
                          c.status === 'disputed'
                            ? 'AlertTriangle'
                            : c.derivedFromPings
                              ? 'MapPin'
                              : 'Check'
                        }
                        size={14}
                        color={
                          c.status === 'disputed'
                            ? EMBER
                            : c.derivedFromPings
                              ? GOLD
                              : LIME
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '700',
                          fontSize: 13,
                        }}>
                        {c.forDate ?? new Date(c.submittedAt).toLocaleDateString()}
                        {c.sessionIndex ? ` · session ${c.sessionIndex}` : ''}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          color: colors.text,
                          opacity: 0.55,
                          fontSize: 11,
                        }}>
                        {c.status === 'disputed'
                          ? 'Disputed by counterparty'
                          : c.derivedFromPings
                            ? `Auto-filled from ${c.imageUrls.length === 0 ? 'background pings' : 'pings + photo'}`
                            : `${c.imageUrls.length} photo${c.imageUrls.length === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                    {c.imageUrls[0] ? (
                      <Image
                        source={{ uri: c.imageUrls[0] }}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 6,
                          backgroundColor: colors.text + '10',
                        }}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Back-fill from background pings — only when there are missed
              days the tracker has evidence for. */}
          {isMultiSession && (pingDays?.length ?? 0) > 0 ? (
            <Section
              colors={colors}
              title="BACK-FILL FROM GPS"
              sub="Forgot to check in? Use background pings instead.">
              <View style={{ marginTop: 4 }}>
                {pingDays!.map((d) => (
                  <View
                    key={d.date}
                    style={{
                      paddingVertical: 10,
                      borderTopWidth: 1,
                      borderTopColor: colors.text + '14',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: GOLD + '24',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Icon name="MapPin" size={14} color={GOLD} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                        {d.date}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          color: colors.text,
                          opacity: 0.55,
                          fontSize: 11,
                        }}>
                        {d.pingCount} ping{d.pingCount === 1 ? '' : 's'} ·{' '}
                        {formatRange(d.firstAt, d.lastAt)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => onBackfillDay(d.date)}
                      disabled={busy === `backfill:${d.date}`}
                      style={{
                        paddingHorizontal: 10,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: GOLD,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: busy === `backfill:${d.date}` ? 0.6 : 1,
                      }}>
                      {busy === `backfill:${d.date}` ? (
                        <ActivityIndicator color={IRON} size="small" />
                      ) : (
                        <Text style={{ color: IRON, fontWeight: '800', fontSize: 11 }}>
                          USE
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* Score (only for score-based activities) */}
          {wantsScore ? (
            <Section
              colors={colors}
              title={`SCORE (${activity.unit || 'pts'})`}
              sub="What did you actually shoot / win?">
              <Field
                colors={colors}
                placeholder="e.g. 87"
                value={score}
                onChange={setScore}
                keyboardType="numeric"
                large
              />
            </Section>
          ) : null}

          {/* Note */}
          <Section colors={colors} title="NOTE (OPTIONAL)">
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Anything the other side should know"
              placeholderTextColor={colors.text + '60'}
              style={{
                marginTop: 4,
                color: colors.text,
                fontSize: 14,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.text + '24',
                minHeight: 56,
                textAlignVertical: 'top',
              }}
            />
          </Section>
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            left: PAGE_X,
            right: PAGE_X,
            bottom: insets.bottom + 12,
          }}>
          <Pressable
            onPress={onSubmit}
            disabled={busy !== null || !canSubmit}
            style={{
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSubmit ? GOLD : colors.text + '14',
              opacity: busy ? 0.7 : 1,
            }}>
            {busy === 'submit' ? (
              <ActivityIndicator color={IRON} />
            ) : (
              <Text
                style={{
                  color: canSubmit ? IRON : colors.text,
                  fontWeight: '800',
                  fontSize: 16,
                }}>
                {canSubmit
                  ? isMultiSession
                    ? forDate === todayUtc
                      ? 'Save today\'s check-in'
                      : `Save check-in for ${forDate}`
                    : 'Submit proof'
                  : 'Waiting for GPS lock'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ---- EXIF parsing ----------------------------------------------------------

function parseExif(exif: any, isCamera: boolean): PhotoExif {
  const cameraStripped = isCamera; // iOS strips camera GPS by design
  if (!exif || typeof exif !== 'object') {
    return { lat: null, lng: null, takenAt: null, cameraStripped };
  }

  // GPS keys vary by platform — check both naked and {GPS} namespace.
  const gpsBlock = exif.GPS && typeof exif.GPS === 'object' ? exif.GPS : exif;
  const lat = parseGpsCoord(
    gpsBlock.GPSLatitude ?? gpsBlock.Latitude,
    (gpsBlock.GPSLatitudeRef ?? gpsBlock.LatitudeRef ?? '') as string
  );
  const lng = parseGpsCoord(
    gpsBlock.GPSLongitude ?? gpsBlock.Longitude,
    (gpsBlock.GPSLongitudeRef ?? gpsBlock.LongitudeRef ?? '') as string
  );

  const takenStr =
    (typeof exif.DateTimeOriginal === 'string' && exif.DateTimeOriginal) ||
    (typeof exif.DateTime === 'string' && exif.DateTime) ||
    null;
  const takenAt = takenStr ? parseExifDate(takenStr) : null;

  return { lat, lng, takenAt, cameraStripped };
}

function parseGpsCoord(value: unknown, ref: string): number | null {
  if (value == null) return null;
  let decimal: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    decimal = value;
  } else if (Array.isArray(value) && value.length >= 3) {
    const [d, m, s] = value.map((x) => Number(x));
    if ([d, m, s].every(Number.isFinite)) {
      decimal = d + m / 60 + s / 3600;
    }
  }
  if (decimal == null) return null;
  const sign = ref === 'S' || ref === 'W' ? -1 : 1;
  // If value already carried a sign (some sources do), don't double-flip.
  return Math.abs(decimal) * sign;
}

function parseExifDate(s: string): number | null {
  // EXIF format: "YYYY:MM:DD HH:mm:ss" — replace first two ':' with '-' for Date.parse
  const cleaned = s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const t = Date.parse(cleaned);
  return Number.isNaN(t) ? null : t;
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatRange(firstAt: number, lastAt: number): string {
  const f = new Date(firstAt);
  const l = new Date(lastAt);
  const sameDay = f.toDateString() === l.toDateString();
  const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) {
    return `${f.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${t(f)} → ${t(l)}`;
  }
  return `${f.toLocaleDateString([], { month: 'short', day: 'numeric' })} → ${l.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

// ---- Subcomponents ---------------------------------------------------------

function PhotoMetaSummary({
  exif,
  deviceLat,
  deviceLng,
  startsAt,
  endsAt,
  colors,
}: {
  exif: PhotoExif;
  deviceLat: number | null;
  deviceLng: number | null;
  startsAt: number | null;
  endsAt: number | null;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const lines: { tone: string; icon: string; text: string }[] = [];

  // Camera-stripped GPS hint
  if (exif.cameraStripped && exif.lat == null) {
    lines.push({
      tone: colors.text,
      icon: 'Info',
      text: "Camera photos don't carry GPS. Live device fix used instead.",
    });
  }

  // Photo location vs device location
  if (exif.lat != null && exif.lng != null && deviceLat != null && deviceLng != null) {
    const dist = haversineMeters(exif.lat, exif.lng, deviceLat, deviceLng);
    if (dist <= PHOTO_MATCH_RADIUS_M) {
      lines.push({
        tone: LIME,
        icon: 'Check',
        text: `Photo location matches device · ${Math.round(dist)}m apart`,
      });
    } else {
      lines.push({
        tone: EMBER,
        icon: 'AlertTriangle',
        text: `Photo location ≠ device · ${formatDistance(dist)} apart`,
      });
    }
  } else if (exif.lat != null && exif.lng != null) {
    lines.push({
      tone: LIME,
      icon: 'MapPin',
      text: `Photo carries GPS · ${exif.lat.toFixed(4)}, ${exif.lng.toFixed(4)}`,
    });
  }

  // Photo timestamp vs bet window
  if (exif.takenAt != null && startsAt != null && endsAt != null) {
    if (exif.takenAt < startsAt) {
      lines.push({
        tone: EMBER,
        icon: 'Clock',
        text: 'Photo predates bet window',
      });
    } else if (exif.takenAt > endsAt) {
      lines.push({
        tone: EMBER,
        icon: 'Clock',
        text: 'Photo taken after bet ended',
      });
    } else {
      lines.push({
        tone: LIME,
        icon: 'Check',
        text: 'Photo taken inside bet window',
      });
    }
  }

  if (lines.length === 0) return null;

  return (
    <View
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.text + '14',
      }}>
      {lines.map((line, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            marginTop: i === 0 ? 0 : 6,
          }}>
          <Icon name={line.icon as any} size={13} color={line.tone} />
          <Text
            style={{
              flex: 1,
              color: line.tone,
              opacity: line.tone === colors.text ? 0.7 : 1,
              fontSize: 12,
              fontWeight: '600',
              lineHeight: 17,
            }}>
            {line.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

function dedupe(arr: { uri: string; mime: string }[]): { uri: string; mime: string }[] {
  const seen = new Set<string>();
  return arr.filter((x) => (seen.has(x.uri) ? false : (seen.add(x.uri), true)));
}

function DayChips({
  colors,
  startsAt,
  endsAt,
  today,
  selected,
  doneDates,
  onSelect,
}: {
  colors: ReturnType<typeof useThemeColors>;
  startsAt: number | null;
  endsAt: number | null;
  today: string;
  selected: string;
  doneDates: string[];
  onSelect: (d: string) => void;
}) {
  if (startsAt == null || endsAt == null) return null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((endsAt - startsAt) / DAY_MS));
  const done = new Set(doneDates);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {Array.from({ length: totalDays }).map((_, i) => {
        const date = new Date(startsAt + i * DAY_MS).toISOString().slice(0, 10);
        const isSelected = date === selected;
        const isDone = done.has(date);
        const isToday = date === today;
        const isFuture = date > today;
        const bg = isSelected
          ? GOLD
          : isDone
            ? LIME + '24'
            : isToday
              ? GOLD + '24'
              : isFuture
                ? colors.text + '0C'
                : colors.text + '0C';
        const fg = isSelected
          ? IRON
          : isDone
            ? LIME
            : isToday
              ? GOLD
              : colors.text;
        const d = new Date(date);
        return (
          <Pressable
            key={date}
            onPress={() => (isFuture ? undefined : onSelect(date))}
            disabled={isFuture}
            style={{
              minWidth: 60,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: isSelected ? GOLD : colors.text + '14',
              alignItems: 'center',
              opacity: isFuture ? 0.4 : 1,
            }}>
            <Text style={{ color: fg, fontSize: 10, fontWeight: '700', opacity: 0.8 }}>
              {d.toLocaleDateString([], { weekday: 'short' }).toUpperCase()}
            </Text>
            <Text style={{ color: fg, fontSize: 16, fontWeight: '800' }}>
              {d.getDate()}
            </Text>
            {isDone ? <Icon name="Check" size={10} color={LIME} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m)}m`;
}

function GpsStatusRow({
  gps,
  colors,
  onRetry,
}: {
  gps: GpsState;
  colors: ReturnType<typeof useThemeColors>;
  onRetry: () => void;
}) {
  const variant: {
    tone: string;
    icon: string;
    label: string;
    sub: string;
    showRetry: boolean;
  } =
    gps.status === 'locked'
      ? {
          tone: LIME,
          icon: 'MapPin',
          label: 'GPS LOCKED',
          sub: `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}${
            gps.accuracy != null ? ` · ±${Math.round(gps.accuracy)}m` : ''
          }`,
          showRetry: false,
        }
      : gps.status === 'requesting' || gps.status === 'unknown'
        ? {
            tone: colors.text,
            icon: 'Loader',
            label: 'CAPTURING LOCATION',
            sub: 'Asking the device for a fix.',
            showRetry: false,
          }
        : gps.status === 'denied'
          ? {
              tone: EMBER,
              icon: 'MapPinOff',
              label: 'LOCATION REQUIRED',
              sub: 'Proof needs a GPS lock so the other side trusts it. Enable Location for FitStake.',
              showRetry: true,
            }
          : {
              tone: EMBER,
              icon: 'MapPinOff',
              label: 'GPS UNAVAILABLE',
              sub: 'Run `npx expo prebuild` and rebuild to enable native location.',
              showRetry: false,
            };

  return (
    <View
      style={{
        marginTop: SECTION_GAP,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: variant.tone + '40',
        backgroundColor: variant.tone + '10',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={variant.icon as any} size={14} color={variant.tone} />
        <Text style={{ ...EYEBROW, color: variant.tone }}>{variant.label}</Text>
      </View>
      <Text
        style={{
          marginTop: 6,
          color: variant.tone,
          opacity: gps.status === 'locked' ? 1 : 0.85,
          fontSize: 13,
          fontWeight: gps.status === 'locked' ? '700' : '500',
          fontVariant: gps.status === 'locked' ? ['tabular-nums'] : undefined,
        }}>
        {variant.sub}
      </Text>
      {variant.showRetry ? (
        <Pressable onPress={onRetry} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Text style={{ color: variant.tone, fontWeight: '700', fontSize: 12 }}>Retry →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Section({
  colors,
  title,
  sub,
  children,
}: {
  colors: ReturnType<typeof useThemeColors>;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: SECTION_GAP }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>{title}</Text>
      {sub ? (
        <Text style={{ marginTop: 2, color: colors.text, opacity: 0.45, fontSize: 11 }}>{sub}</Text>
      ) : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

function Field({
  colors,
  placeholder,
  value,
  onChange,
  keyboardType,
  large,
}: {
  colors: ReturnType<typeof useThemeColors>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  large?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.text + '50'}
      keyboardType={keyboardType ?? 'default'}
      style={{
        flex: 1,
        color: colors.text,
        fontSize: large ? 24 : 16,
        fontWeight: large ? '800' : '600',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.text + '24',
        fontVariant: ['tabular-nums'],
      }}
    />
  );
}

function CaptureButton({
  colors,
  icon,
  label,
  onPress,
  loading,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        flex: 1,
        height: 100,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.text + '20',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: loading ? 0.6 : 1,
      }}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Icon name={icon as any} size={24} color={colors.text + 'cc'} />
          <Text
            style={{
              marginTop: 6,
              color: colors.text,
              opacity: 0.7,
              fontWeight: '700',
              fontSize: 12,
            }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function SmallButton({
  colors,
  label,
  onPress,
  loading,
  tone,
}: {
  colors: ReturnType<typeof useThemeColors>;
  label: string;
  onPress: () => void;
  loading?: boolean;
  tone?: 'ember';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: tone === 'ember' ? EMBER + '60' : colors.text + '20',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: loading ? 0.6 : 1,
      }}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text
          style={{
            color: tone === 'ember' ? EMBER : colors.text,
            fontWeight: '700',
            fontSize: 12,
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
