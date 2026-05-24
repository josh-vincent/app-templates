import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useDevPersona } from '@/contexts/DevPersonaContext';
import { api } from '@/convex/_generated/api';
import { useQuery } from '@/lib/persona-convex';
import { GOLD, IRON } from '@jv/tokens';

// Auth is auto-signed-in anonymously in app/_layout.tsx. This entry point
// then forks based on onboarding state:
//   - persona set (dev mode): skip onboarding, go to tabs
//   - onboardingComplete (real user): go to tabs
//   - otherwise: walk through /onboarding/welcome
export default function Index() {
  const { persona, ready: personaReady } = useDevPersona();
  const me = useQuery(api.users.me);

  if (!personaReady || me === undefined) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: IRON,
        }}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  // Dev personas skip the onboarding gate.
  if (persona) return <Redirect href="/(tabs)/(home)" />;

  if (me?.onboardingComplete) return <Redirect href="/(tabs)/(home)" />;

  return <Redirect href="/onboarding/welcome" />;
}
