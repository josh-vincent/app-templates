import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceHeader } from '@/components/BalanceHeader';
import { useBalance, type Round } from '@/contexts/BalanceContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { EMBER, GOLD, LIME } from '@/lib/theme';

function fmtWhen(at: number) {
  const ms = Date.now() - at;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function HistoryRow({
  row,
  isFirst,
  colors,
}: {
  row: Round;
  isFirst: boolean;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const accent =
    row.outcome === 'bonus'
      ? GOLD
      : row.delta > 0
        ? LIME
        : row.delta < 0
          ? EMBER
          : colors.text;
  const gameLabel =
    row.game === 'slots'
      ? 'Slots'
      : row.game === 'blackjack'
        ? 'Blackjack'
        : 'Bonus';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.border,
      }}
      testID={`history-row-${row.id}`}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
          {gameLabel}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: colors.text,
            opacity: 0.55,
            fontSize: 12,
            marginTop: 2,
          }}>
          {(row.detail ? row.detail + ' · ' : '') + fmtWhen(row.at)}
        </Text>
      </View>
      <Text
        style={{
          color: accent,
          fontSize: 16,
          fontWeight: '900',
          fontVariant: ['tabular-nums'],
        }}>
        {row.delta > 0 ? `+${row.delta}` : row.delta}
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { history } = useBalance();

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
            RECENT ROUNDS · {history.length}
          </Text>
          {history.length === 0 ? (
            <View
              style={{
                marginTop: 24,
                padding: 18,
                borderRadius: 16,
                backgroundColor: colors.text + '08',
                borderColor: colors.border,
                borderWidth: 1,
              }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                No rounds yet.
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  color: colors.text,
                  opacity: 0.6,
                  fontSize: 12,
                }}>
                Play slots or blackjack and your results will land here.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              {history.map((r, i) => (
                <HistoryRow
                  key={r.id}
                  row={r}
                  isFirst={i === 0}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
