import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { useQuery } from '@/lib/persona-convex';
import { GOLD, IRON } from '@/lib/theme';

// Entry point — anonymous auth happens in _layout.tsx. Once the profile
// loads we drop straight into the trip tabs. No onboarding gate for Voyager.
export default function Index() {
  const me = useQuery(api.users.me, {});
  if (me === undefined) {
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
  return <Redirect href="/(tabs)/(home)" />;
}
