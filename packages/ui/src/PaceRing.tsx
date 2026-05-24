/**
 * PaceRing — animated SVG progress ring.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, react-native-svg
 * @platforms  ios, android
 * @demo       ./PaceRing.demo.tsx
 * @donor      fitstake/components/PaceRing.tsx
 */
import React from 'react';
import Svg, { Circle } from 'react-native-svg';

export function PaceRing({
  ratio,
  color,
  trackColor,
  size = 30,
  stroke = 3,
}: {
  ratio: number;
  color: string;
  trackColor: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const offset = c * (1 - clamped);
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeOpacity={0.12} strokeWidth={stroke} fill="none" />
      {clamped > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}

export default PaceRing;
