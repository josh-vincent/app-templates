import { Redirect } from 'expo-router';
import React from 'react';

// HealthPulse: simplified entry — go straight to the tabs.
export default function Index() {
  return <Redirect href="/(tabs)/(home)" />;
}
