import { Redirect } from 'expo-router';
import React from 'react';

// Play-money demo — no auth, no onboarding. Land directly on the home tab.
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
