import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceHeader } from '@/components/BalanceHeader';
import { LUCKYCHIPS_CONSTANTS, useBalance } from '@/contexts/BalanceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { EMBER, GOLD, IRON, LIME } from '@/lib/theme';

function Stat({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color?: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 14,
        borderRadius: 14,
        backgroundColor: colors.text + '08',
        borderColor: colors.border,
        borderWidth: 1,
      }}>
      <Text
        style={{
          color: colors.text,
          opacity: 0.55,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1.2,
        }}>
        {label}
      </Text>
      <Text
        style={{
          marginTop: 4,
          color: color ?? colors.text,
          fontSize: 20,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { isDark, toggleTheme } = useTheme();
  const { balance, history, reset } = useBalance();

  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let net = 0;
    for (const r of history) {
      net += r.delta;
      if (r.delta > 0) wins += 1;
      if (r.delta < 0) losses += 1;
    }
    return { wins, losses, net };
  }, [history]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <BalanceHeader />
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <Text
            style={{
              color: colors.text,
              opacity: 0.55,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.3,
            }}>
            STATS
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Stat label="WINS" value={String(stats.wins)} color={LIME} colors={colors} />
            <Stat label="LOSSES" value={String(stats.losses)} color={EMBER} colors={colors} />
            <Stat
              label="NET"
              value={stats.net >= 0 ? `+${stats.net}` : String(stats.net)}
              color={stats.net >= 0 ? LIME : EMBER}
              colors={colors}
            />
          </View>

          {/* Theme toggle */}
          <View style={{ marginTop: 28 }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.55,
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.3,
              }}>
              SETTINGS
            </Text>
            <Pressable
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel="Toggle theme"
              testID="toggle-theme"
              style={{
                marginTop: 10,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: colors.text + '08',
                borderColor: colors.border,
                borderWidth: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                Theme
              </Text>
              <Text
                style={{
                  color: GOLD,
                  fontSize: 13,
                  fontWeight: '800',
                }}>
                {isDark ? 'Dark' : 'Light'}
              </Text>
            </Pressable>
          </View>

          {/* Reset balance */}
          <View style={{ marginTop: 28 }}>
            <Pressable
              onPress={reset}
              accessibilityRole="button"
              accessibilityLabel={`Reset balance to ${LUCKYCHIPS_CONSTANTS.STARTING_BALANCE}`}
              testID="reset-balance"
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: GOLD,
                alignItems: 'center',
              }}>
              <Text style={{ color: IRON, fontSize: 15, fontWeight: '900' }}>
                Reset balance to {LUCKYCHIPS_CONSTANTS.STARTING_BALANCE}
              </Text>
            </Pressable>
            <Text
              style={{
                marginTop: 8,
                color: colors.text,
                opacity: 0.55,
                fontSize: 12,
                lineHeight: 18,
              }}>
              Clears history too. Use this to start the demo from scratch.
            </Text>
          </View>

          {/* About */}
          <View
            style={{
              marginTop: 28,
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.text + '08',
              borderColor: colors.border,
              borderWidth: 1,
            }}>
            <Text
              style={{
                color: colors.text,
                opacity: 0.55,
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 1.2,
              }}>
              ABOUT LUCKYCHIPS
            </Text>
            <Text
              style={{
                marginTop: 6,
                color: colors.text,
                opacity: 0.75,
                fontSize: 13,
                lineHeight: 19,
              }}>
              Play-money casino UI demo. Slots and blackjack run against a
              local pseudo-random deck. No purchases, no real money, no
              gambling.
            </Text>
            <Text
              style={{
                marginTop: 8,
                color: colors.text,
                opacity: 0.4,
                fontSize: 11,
              }}>
              Current balance: {balance.toLocaleString()} credits
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
