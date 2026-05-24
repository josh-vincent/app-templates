import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalanceHeader } from '@/components/BalanceHeader';
import Icon from '@/components/Icon';
import { LUCKYCHIPS_CONSTANTS, useBalance } from '@/contexts/BalanceContext';
import { useThemeColors } from '@/contexts/ThemeColors';
import { GOLD, IRON, LIME } from '@/lib/theme';

function GameTile({
  title,
  subtitle,
  icon,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  icon: 'Dice5' | 'Spade';
  onPress: () => void;
  testID?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      testID={testID}
      style={{
        flex: 1,
        backgroundColor: colors.text + '08',
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 18,
        padding: 18,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: GOLD + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}>
        <Icon name={icon} size={22} color={GOLD} />
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
        {title}
      </Text>
      <Text
        style={{
          color: colors.text,
          opacity: 0.55,
          fontSize: 12,
          marginTop: 4,
        }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { balance, claimDailyBonus, canClaimDailyBonus, history } = useBalance();
  const claimable = canClaimDailyBonus();

  const onClaim = () => {
    claimDailyBonus();
  };

  const lastRound = history[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <BalanceHeader />

        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          {/* Daily bonus card */}
          <Pressable
            onPress={claimable ? onClaim : undefined}
            disabled={!claimable}
            accessibilityRole="button"
            accessibilityLabel={
              claimable
                ? `Claim daily bonus of ${LUCKYCHIPS_CONSTANTS.DAILY_BONUS} credits`
                : 'Daily bonus already claimed'
            }
            testID="daily-bonus"
            style={{
              marginTop: 12,
              padding: 18,
              borderRadius: 18,
              backgroundColor: claimable ? GOLD : colors.text + '0c',
              borderColor: claimable ? GOLD : colors.border,
              borderWidth: 1,
              opacity: claimable ? 1 : 0.7,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: claimable ? IRON : colors.text,
                    opacity: claimable ? 0.8 : 0.6,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                  }}>
                  {claimable ? 'DAILY BONUS' : 'COME BACK TOMORROW'}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: claimable ? IRON : colors.text,
                    fontSize: 22,
                    fontWeight: '900',
                    letterSpacing: -0.5,
                  }}>
                  {claimable
                    ? `+${LUCKYCHIPS_CONSTANTS.DAILY_BONUS} credits`
                    : 'Bonus already claimed'}
                </Text>
                <Text
                  style={{
                    marginTop: 4,
                    color: claimable ? IRON : colors.text,
                    opacity: 0.7,
                    fontSize: 12,
                  }}>
                  {claimable
                    ? 'Tap to add free play credits to your stack.'
                    : 'New bonus unlocks next calendar day.'}
                </Text>
              </View>
              <Icon
                name={claimable ? 'Gift' : 'Check'}
                size={28}
                color={claimable ? IRON : colors.text}
              />
            </View>
          </Pressable>

          {/* Games grid */}
          <Text
            style={{
              marginTop: 28,
              color: colors.text,
              opacity: 0.55,
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.3,
            }}>
            GAMES
          </Text>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <GameTile
              title="Slots"
              subtitle="Spin three reels"
              icon="Dice5"
              onPress={() => router.push('/(tabs)/slots' as any)}
              testID="game-slots"
            />
            <GameTile
              title="Blackjack"
              subtitle="Beat the dealer"
              icon="Spade"
              onPress={() => router.push('/(tabs)/blackjack' as any)}
              testID="game-blackjack"
            />
          </View>

          {/* Last round summary */}
          {lastRound ? (
            <View
              style={{
                marginTop: 28,
                padding: 16,
                borderRadius: 16,
                backgroundColor: colors.text + '06',
                borderColor: colors.border,
                borderWidth: 1,
              }}>
              <Text
                style={{
                  color: colors.text,
                  opacity: 0.55,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.3,
                }}>
                LAST ROUND
              </Text>
              <View
                style={{
                  marginTop: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 16,
                      fontWeight: '800',
                    }}>
                    {lastRound.game === 'slots'
                      ? 'Slots'
                      : lastRound.game === 'blackjack'
                        ? 'Blackjack'
                        : 'Daily bonus'}
                  </Text>
                  {lastRound.detail ? (
                    <Text
                      style={{
                        color: colors.text,
                        opacity: 0.6,
                        fontSize: 12,
                        marginTop: 2,
                      }}>
                      {lastRound.detail}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={{
                    color: lastRound.delta >= 0 ? LIME : '#ff5147',
                    fontSize: 18,
                    fontWeight: '900',
                    fontVariant: ['tabular-nums'],
                  }}>
                  {lastRound.delta >= 0 ? `+${lastRound.delta}` : lastRound.delta}
                </Text>
              </View>
            </View>
          ) : null}

          {balance < 10 ? (
            <View
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 14,
                backgroundColor: '#ff514714',
                borderColor: '#ff514744',
                borderWidth: 1,
              }}>
              <Text style={{ color: '#ff5147', fontSize: 13, fontWeight: '700' }}>
                Low balance. Reset on the Profile tab or wait for tomorrow's bonus.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
