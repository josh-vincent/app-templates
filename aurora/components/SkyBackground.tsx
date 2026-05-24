import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { skyGradient, skyShimmer, type Condition } from '@/lib/aurora-data';

// Layered sky background:
//   1. Base 5-stop linear gradient (deep → bright), condition + hour driven
//   2. Diagonal shimmer wash (warm-top, neutral-mid, aurora-violet-bottom)
//   3. Bottom vignette so cards have a darker plinth to read against
export default function SkyBackground({
  condition,
  hour,
}: {
  condition: Condition;
  hour: number;
}) {
  const base = skyGradient(condition, hour);
  const shimmer = skyShimmer(condition, hour);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={base}
        locations={[0, 0.22, 0.5, 0.78, 1]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[shimmer.top, shimmer.mid, shimmer.bottom]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Full-screen darkening wash so every card lands on darkened sky,
          not just the ones near the bottom vignette. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.34)', 'rgba(0,0,0,0.55)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
