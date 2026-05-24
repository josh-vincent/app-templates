import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';

// True iOS-26 native bottom tabs backed by UITabBarController via
// react-native-screens. On iOS 26 the system renders Liquid Glass
// automatically — passing `blurEffect` would override that with the legacy
// UIVisualEffectView material, so we deliberately leave it unset.
//
// `minimizeBehavior="onScrollDown"` opts into the iOS-26 morphing tab bar:
// the bar shrinks while scrolling down and expands on scroll up — this is
// the visual signature people associate with iOS-26 Liquid Glass tabs.
//
// `tintColor` colours the active SF Symbol + label in Aurora purple.
export default function TabsLayout() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor="#7B5BFF">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="hourly">
        <NativeTabs.Trigger.Icon sf="chart.bar.xaxis" />
        <NativeTabs.Trigger.Label>Forecast</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} />
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.circle', selected: 'person.circle.fill' }}
        />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
