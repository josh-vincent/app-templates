// Pulsing skeleton primitives. No new deps — just Animated.loop.
//
// Use SkeletonBar for inline shimmery rectangles and SkeletonCard for
// taller bordered blocks. Both honor the active theme by deriving their
// fill from the text color at low alpha.

import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

import { useThemeColors } from '@jv/ui';

function useShimmerOpacity(): Animated.Value {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

export function SkeletonBar({
  width,
  height = 14,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}) {
  const colors = useThemeColors();
  const opacity = useShimmerOpacity();
  return (
    <Animated.View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: 6,
          backgroundColor: colors.text + '15',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({
  height = 80,
  style,
}: {
  height?: number;
  style?: ViewStyle;
}) {
  const colors = useThemeColors();
  const opacity = useShimmerOpacity();
  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: 16,
          backgroundColor: colors.text + '10',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonRow({
  count = 3,
  height = 56,
  gap = 10,
}: {
  count?: number;
  height?: number;
  gap?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard
          key={i}
          height={height}
          style={{ marginTop: i === 0 ? 0 : gap }}
        />
      ))}
    </>
  );
}
