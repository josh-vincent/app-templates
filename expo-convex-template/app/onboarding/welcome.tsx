import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '@jv/ui';
import { useThemeColors } from '@jv/ui';
import { SCENARIO_MASCOTS } from '@/lib/fitstakeImages';
import { BONE, EMBER, GOLD, IRON, LIME } from '@jv/tokens';

const PAGE_X = 24;
const EYEBROW = { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 };

export default function OnboardingWelcome() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: PAGE_X, flex: 1 }}>
        <Text style={{ ...EYEBROW, color: colors.text, opacity: 0.5 }}>STEP 1 OF 4</Text>
        <Text
          style={{
            color: colors.text,
            fontSize: 34,
            fontWeight: '900',
            letterSpacing: -1,
            marginTop: 8,
            lineHeight: 38,
          }}>
          Put your money where your steps are.
        </Text>
        <Text
          style={{ color: colors.text, opacity: 0.65, fontSize: 15, marginTop: 14, lineHeight: 22 }}>
          Stake real-feeling cash on a fitness goal. Hit it and keep your
          stake. Miss it and it pools into a jackpot the finishers share.
        </Text>

        <Image
          source={SCENARIO_MASCOTS.betWon}
          resizeMode="contain"
          style={{ width: '100%', height: 240, marginTop: 18 }}
        />

        <View style={{ marginTop: 18, gap: 14 }}>
          <Bullet icon="Activity" tone={LIME} colors={colors} title="Real activity, verified">
            Steps and workouts come from Apple Health — no way to cheat the
            counter.
          </Bullet>
          <Bullet icon="Flame" tone={GOLD} colors={colors} title="One goal at a time">
            Pick what you'll do, when, and what it's worth. We'll handle the
            rest.
          </Bullet>
          <Bullet icon="Users" tone={EMBER} colors={colors} title="Friends raise the stakes">
            Bet against friends head-to-head or let the jackpot grow from
            everyone's misses.
          </Bullet>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: PAGE_X,
          paddingBottom: insets.bottom + 18,
        }}>
        <Pressable
          onPress={() => router.push('/onboarding/health' as any)}
          style={{
            height: 56,
            borderRadius: 18,
            backgroundColor: GOLD,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}>
          <Text style={{ color: IRON, fontWeight: '900', fontSize: 16, letterSpacing: 0.2 }}>
            Get started
          </Text>
          <Icon name="ArrowRight" size={16} color={IRON} />
        </Pressable>
      </View>
    </View>
  );
}

function Bullet({
  icon,
  tone,
  title,
  children,
  colors,
}: {
  icon: string;
  tone: string;
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: tone + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          marginTop: 2,
        }}>
        <Icon name={icon as any} size={15} color={tone} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.text, opacity: 0.6, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
          {children}
        </Text>
      </View>
    </View>
  );
}
