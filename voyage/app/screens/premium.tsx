import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import Header from '@/components/Header';
import Icon from '@/components/Icon';
import { usePremium } from '@/contexts/PremiumContext';
import { BRICK, INK, MOSS, PARCHMENT, PARCHMENT_COOL, PARCHMENT_DEEP, SERIF } from '@/lib/theme';
import type { PremiumPlan } from '@/lib/premium';

const FEATURES = [
  'Unlimited tracked route alerts',
  'Premium fare cabin comparisons',
  'Trip companion timeline and reminders',
  'Priority concierge planning prompts',
];

export default function PremiumScreen() {
  const { state, isPremium, activate, cancel } = usePremium();
  const [busyPlan, setBusyPlan] = useState<PremiumPlan | null>(null);

  const run = async (plan: Exclude<PremiumPlan, 'free'>) => {
    setBusyPlan(plan);
    try {
      await activate(plan);
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: PARCHMENT }}>
      <Header title="Voyage Premium" showBackButton />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 54, gap: 14 }}
        showsVerticalScrollIndicator={false}>
        <View className="rounded-3xl p-5" style={{ backgroundColor: INK }}>
          <View className="flex-row items-start justify-between">
            <View>
              <Text style={{ color: PARCHMENT, fontFamily: SERIF, fontSize: 13, opacity: 0.68 }}>
                Local StoreKit mock
              </Text>
              <Text
                style={{
                  color: PARCHMENT,
                  fontFamily: SERIF,
                  fontSize: 31,
                  letterSpacing: -0.35,
                  marginTop: 4,
                }}>
                {isPremium ? `${state.plan.toUpperCase()} is active` : 'Upgrade flow ready'}
              </Text>
            </View>
            <View
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(241,236,228,0.12)' }}>
              <Icon name="Sparkles" size={18} color={PARCHMENT} />
            </View>
          </View>
          <Text
            style={{
              color: PARCHMENT,
              fontFamily: SERIF,
              fontSize: 13,
              fontStyle: 'italic',
              lineHeight: 19,
              opacity: 0.68,
              marginTop: 14,
            }}>
            This screen stores a local premium entitlement for simulator, review, and QA flows. No
            real purchase is attempted.
          </Text>
        </View>

        <View className="rounded-3xl p-5" style={{ backgroundColor: PARCHMENT_DEEP }}>
          {FEATURES.map((feature) => (
            <View key={feature} className="flex-row items-center py-2">
              <View
                className="mr-3 h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(36,62,54,0.1)' }}>
                <Icon name="Check" size={14} color={MOSS} />
              </View>
              <Text style={{ color: INK, fontFamily: SERIF, fontSize: 14 }}>{feature}</Text>
            </View>
          ))}
        </View>

        <PlanCard
          title="Voyage Plus"
          price="$8.99 / month"
          description="For route watching, alerts, and lightweight planning."
          active={state.plan === 'plus' && isPremium}
          busy={busyPlan === 'plus'}
          onPress={() => run('plus')}
        />
        <PlanCard
          title="Voyage Pro"
          price="$19.99 / month"
          description="For frequent travelers who want deeper concierge context."
          active={state.plan === 'pro' && isPremium}
          busy={busyPlan === 'pro'}
          onPress={() => run('pro')}
        />

        <Pressable
          onPress={isPremium ? cancel : undefined}
          className="h-14 flex-row items-center justify-center rounded-full"
          style={{
            backgroundColor: isPremium ? BRICK : PARCHMENT_COOL,
            opacity: isPremium ? 1 : 0.62,
          }}
          accessibilityRole="button"
          accessibilityLabel={isPremium ? 'Cancel mock premium' : 'Mock premium inactive'}>
          <Text style={{ color: isPremium ? PARCHMENT : INK, fontFamily: SERIF, fontSize: 14 }}>
            {isPremium ? 'Cancel mock premium' : 'No active mock subscription'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PlanCard({
  title,
  price,
  description,
  active,
  busy,
  onPress,
}: {
  title: string;
  price: string;
  description: string;
  active: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-3xl p-5"
      style={{ backgroundColor: active ? MOSS : PARCHMENT_DEEP }}
      accessibilityRole="button"
      accessibilityLabel={`${active ? 'Active plan' : 'Start mock subscription'} ${title}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text style={{ color: active ? PARCHMENT : INK, fontFamily: SERIF, fontSize: 21 }}>
            {title}
          </Text>
          <Text
            style={{
              color: active ? PARCHMENT : INK,
              fontFamily: SERIF,
              fontSize: 13,
              opacity: 0.7,
              marginTop: 3,
            }}>
            {description}
          </Text>
        </View>
        <Text style={{ color: active ? PARCHMENT : INK, fontFamily: SERIF, fontSize: 14 }}>
          {price}
        </Text>
      </View>
      <View className="mt-4 flex-row items-center">
        <Icon
          name={active ? 'BadgeCheck' : 'CreditCard'}
          size={15}
          color={active ? PARCHMENT : INK}
        />
        <Text
          className="ml-2"
          style={{ color: active ? PARCHMENT : INK, fontFamily: SERIF, fontSize: 13 }}>
          {active ? 'Active locally' : busy ? 'Updating...' : 'Start mock upgrade'}
        </Text>
      </View>
    </Pressable>
  );
}
