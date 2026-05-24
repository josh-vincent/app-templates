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
        {/* Single iron card with both push toggles stacked. Accent color is
            confined to the active icon + switch pill so the surface stays
            quiet and the rows read as siblings, not competing CTAs. */}
        <View
          style={{
            marginTop: SECTION_GAP / 2,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.text + '14',
            backgroundColor: colors.text + '06',
            overflow: 'hidden',
          }}>
          <ToggleRow
            iconName="Bell"
            accent={LIME}
            title={`Push ${pushEnabled ? 'on' : 'off'}`}
            sub={
              pushEnabled
                ? 'Bet settlements, friends staking against you, proofs in.'
                : 'Server-side suppression. Flip back on to resume alerts.'
            }
            value={pushEnabled}
            onToggle={onTogglePush}
            colors={colors}
          />
          <View style={{ height: 1, backgroundColor: colors.text + '0c', marginHorizontal: 18 }} />
          <ToggleRow
            iconName="Users"
            accent={GOLD}
            title="Friends activity"
            sub={
              friendActivityEnabled
                ? 'Pushes when friends close out, fall behind, or settle.'
                : 'In-app Feed still updates. Pushes are suppressed.'
            }
            value={pushEnabled && friendActivityEnabled}
            onToggle={pushEnabled ? onToggleFriendActivity : undefined}
            colors={colors}
            disabled={!pushEnabled}
          />
        </View>

        {/* Reminder leads */}
        <ReminderLeadsSection colors={colors} custom={customLeads} disabled={!pushEnabled} />
      </ScrollView>
    </View>
  );
}

function ToggleRow({
  iconName,
  accent,
  title,
  sub,
  value,
  onToggle,
  colors,
  disabled,
}: {
  iconName: string;
  accent: string;
  title: string;
  sub: string;
  value: boolean;
  onToggle?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        paddingVertical: 16,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        opacity: disabled ? 0.5 : 1,
      }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: value ? accent + '22' : colors.text + '0d',
        }}>
        <Icon name={iconName as any} size={18} color={value ? accent : colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontWeight: '700',
            fontSize: 15,
            letterSpacing: -0.2,
          }}>
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            color: colors.text,
            opacity: 0.55,
            fontSize: 12,
            marginTop: 2,
          }}>
          {sub}
        </Text>
      </View>
      <View
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          padding: 3,
          backgroundColor: value ? accent : colors.text + '24',
          alignItems: value ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#0d1014',
          }}
        />
      </View>
    </Pressable>
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
