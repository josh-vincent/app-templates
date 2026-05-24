// Notifications settings — master push toggle, then per-duration reminder
// lead times. Lives on its own page so Profile stays a clean overview;
// mirrors the layout pattern of /dev.

import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { api } from '@/convex/_generated/api';
import { defaultLeadHoursForDuration, formatLeadHours } from '@/lib/notifyDefaults';
import { useMutation, useQuery } from '@/lib/persona-convex';
import { EMBER, GOLD, LIME } from '@jv/tokens';

const PAGE_X = 20;
const SECTION_GAP = 28;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

const DURATION_BUCKETS: { label: string; days: number; descriptor: string }[] = [
  { label: 'Same-day bet', days: 0.5, descriptor: '< 1 day' },
  { label: 'Weekend warriors', days: 3, descriptor: '1–3 days' },
  { label: 'Weekly goal', days: 7, descriptor: '4–14 days' },
  { label: 'Long haul', days: 30, descriptor: '> 14 days' },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const me = useQuery(api.users.me, {});
  const setPushPrefs = useMutation(api.notifications.setPushPrefs);
  const setFriendActivityPushPrefs = useMutation(
    api.notifications.setFriendActivityPushPrefs
  );

  const pushEnabled = me?.pushEnabled !== false;
  const friendActivityEnabled = me?.friendActivityPushEnabled !== false;
  const customLeads = me?.notifyLeadHours ?? null;

  async function onTogglePush() {
    try {
      await setPushPrefs({ enabled: !pushEnabled });
    } catch (e: any) {
      Alert.alert('Could not toggle', e?.message ?? String(e));
    }
  }

  async function onToggleFriendActivity() {
    try {
      await setFriendActivityPushPrefs({ enabled: !friendActivityEnabled });
    } catch (e: any) {
      Alert.alert('Could not toggle', e?.message ?? String(e));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}>
          <Icon name="ChevronLeft" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.55 }}>
          NOTIFICATIONS
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 24,
        }}>
        {/* Master toggle */}
        <Pressable
          onPress={onTogglePush}
          accessibilityRole="switch"
          accessibilityState={{ checked: pushEnabled }}
          style={{
            marginTop: SECTION_GAP / 2,
            paddingVertical: 18,
            paddingHorizontal: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: pushEnabled ? LIME + '40' : colors.text + '14',
            backgroundColor: pushEnabled ? LIME + '12' : colors.text + '06',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pushEnabled ? LIME + '22' : colors.text + '0d',
            }}>
            <Icon name="Bell" size={20} color={pushEnabled ? LIME : colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: pushEnabled ? LIME : colors.text,
                fontWeight: '800',
                fontSize: 16,
                letterSpacing: -0.2,
              }}>
              Push {pushEnabled ? 'on' : 'off'}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: colors.text,
                opacity: 0.6,
                fontSize: 12,
                marginTop: 2,
              }}>
              {pushEnabled
                ? 'You get pushed when bets settle, friends stake against you, or proofs come in.'
                : 'Server-side suppression. No alerts on this account until you flip it back on.'}
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              padding: 3,
              backgroundColor: pushEnabled ? LIME : colors.text + '24',
              alignItems: pushEnabled ? 'flex-end' : 'flex-start',
              justifyContent: 'center',
            }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#0d1014',
              }}
            />
          </View>
        </Pressable>

        {/* Friend activity stream toggle. Pushed-only flag — the in-app
            feed under Friends/Feed always populates regardless. */}
        <Pressable
          onPress={pushEnabled ? onToggleFriendActivity : undefined}
          accessibilityRole="switch"
          accessibilityState={{ checked: pushEnabled && friendActivityEnabled }}
          style={{
            marginTop: 14,
            paddingVertical: 16,
            paddingHorizontal: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor:
              pushEnabled && friendActivityEnabled
                ? GOLD + '40'
                : colors.text + '14',
            backgroundColor:
              pushEnabled && friendActivityEnabled
                ? GOLD + '10'
                : colors.text + '06',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            opacity: pushEnabled ? 1 : 0.5,
          }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                pushEnabled && friendActivityEnabled
                  ? GOLD + '22'
                  : colors.text + '0d',
            }}>
            <Icon
              name="Users"
              size={20}
              color={pushEnabled && friendActivityEnabled ? GOLD : colors.text}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color:
                  pushEnabled && friendActivityEnabled ? GOLD : colors.text,
                fontWeight: '800',
                fontSize: 16,
                letterSpacing: -0.2,
              }}>
              Friends activity
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: colors.text,
                opacity: 0.6,
                fontSize: 12,
                marginTop: 2,
              }}>
              {friendActivityEnabled
                ? 'Pushes when friends close out, fall behind, or settle a stake.'
                : 'In-app Feed still updates. Pushes are suppressed.'}
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              padding: 3,
              backgroundColor:
                pushEnabled && friendActivityEnabled
                  ? GOLD
                  : colors.text + '24',
              alignItems:
                pushEnabled && friendActivityEnabled ? 'flex-end' : 'flex-start',
              justifyContent: 'center',
            }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#0d1014',
              }}
            />
          </View>
        </Pressable>

        {/* Reminder leads */}
        <ReminderLeadsSection colors={colors} custom={customLeads} disabled={!pushEnabled} />
      </ScrollView>
    </View>
  );
}

// ---- Reminder leads block — pulled in from the previous Profile inline
//      version. Owns the smart-defaults / custom / mute-all toggle and the
//      per-duration lead chips. Disabled visually when the master push
//      toggle is off (server-side already suppresses sends, but we want
//      the UI to reflect that it's moot).

function ReminderLeadsSection({
  colors,
  custom,
  disabled,
}: {
  colors: ReturnType<typeof useThemeColors>;
  custom: number[] | null;
  disabled: boolean;
}) {
  const setNotifyLeads = useMutation(api.users.setNotifyLeads);
  const usingCustom = custom != null;

  async function onResetDefaults() {
    try {
      await setNotifyLeads({ leadHours: null });
    } catch (e: any) {
      Alert.alert('Could not reset', e?.message ?? String(e));
    }
  }
  async function onMuteAll() {
    try {
      await setNotifyLeads({ leadHours: [] });
    } catch (e: any) {
      Alert.alert('Could not mute', e?.message ?? String(e));
    }
  }

  return (
    <View style={{ marginTop: SECTION_GAP, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5, marginBottom: 4 }}>
        REMINDERS
      </Text>
      <Text
        style={{
          color: colors.text,
          opacity: 0.55,
          fontSize: 12,
          lineHeight: 17,
          marginBottom: 12,
        }}>
        {usingCustom
          ? custom!.length === 0
            ? 'Custom override: all bet-end reminders muted.'
            : `Custom override: notify ${custom!
                .map(formatLeadHours)
                .join(' · ')} (applied to every bet).`
          : 'Smart defaults — lead time tailored per bet duration so you always have time to catch up.'}
      </Text>
      {!usingCustom &&
        DURATION_BUCKETS.map((b, i) => {
          const leads = defaultLeadHoursForDuration(b.days);
          return (
            <View
              key={b.label}
              style={{
                flexDirection: 'row',
                paddingVertical: 12,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.text + '14',
                alignItems: 'center',
              }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                  {b.label}
                </Text>
                <Text style={{ color: colors.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>
                  {b.descriptor}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {leads.map((h) => (
                  <View
                    key={h}
                    style={{
                      backgroundColor: GOLD + '22',
                      paddingHorizontal: 9,
                      paddingVertical: 5,
                      borderRadius: 999,
                    }}>
                    <Text
                      style={{
                        color: GOLD,
                        fontSize: 11,
                        fontWeight: '800',
                        letterSpacing: 0.4,
                      }}>
                      {formatLeadHours(h).replace(' before', '')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <Pressable
          onPress={disabled ? undefined : onResetDefaults}
          disabled={disabled}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: usingCustom ? GOLD : colors.text + '0d',
            borderWidth: 1,
            borderColor: usingCustom ? GOLD : colors.text + '14',
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: usingCustom ? '#0d1014' : colors.text,
              fontWeight: '700',
              fontSize: 13,
            }}>
            Smart defaults
          </Text>
        </Pressable>
        <Pressable
          onPress={disabled ? undefined : onMuteAll}
          disabled={disabled}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: usingCustom && custom!.length === 0 ? EMBER : colors.text + '0d',
            borderWidth: 1,
            borderColor: usingCustom && custom!.length === 0 ? EMBER : colors.text + '14',
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: usingCustom && custom!.length === 0 ? '#0d1014' : colors.text,
              fontWeight: '700',
              fontSize: 13,
            }}>
            Mute all
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
