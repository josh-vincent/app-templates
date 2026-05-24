import React from 'react';
import { Text, View } from 'react-native';

import { useBalance } from '@/contexts/BalanceContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { GOLD } from '@/lib/theme';

// Standard header that surfaces the running play-credit balance + the
// "no real money" disclaimer. Reused across all gameplay tabs.
export function BalanceHeader({ title }: { title?: string }) {
  const colors = useThemeColors();
  const { balance } = useBalance();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}>
        <View>
          <Text
            style={{
              color: colors.text,
              opacity: 0.55,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.3,
            }}
            testID="balance-label">
            {title ?? 'BALANCE'}
          </Text>
          <Text
            style={{
              color: GOLD,
              fontSize: 36,
              fontWeight: '900',
              letterSpacing: -1.1,
              marginTop: 2,
              fontVariant: ['tabular-nums'],
            }}
            accessibilityLabel={`Balance ${balance} play credits`}
            testID="balance-amount">
            {balance.toLocaleString()}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: GOLD + '1f',
            borderColor: GOLD + '55',
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
          }}>
          <Text
            style={{
              color: GOLD,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 1.1,
            }}>
            PLAY CREDITS
          </Text>
        </View>
      </View>
      <Text
        style={{
          marginTop: 4,
          color: colors.text,
          opacity: 0.45,
          fontSize: 11,
        }}>
        Demo only — no real money is ever involved.
      </Text>
    </View>
  );
}

export default BalanceHeader;
