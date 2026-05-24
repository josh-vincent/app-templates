import React from 'react';
import { View } from 'react-native';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
} from 'lucide-react-native';

import type { Condition } from '@/lib/aurora-data';

type Props = {
  condition: Condition;
  size?: number;
  strokeWidth?: number;
  /** Override the auto-picked color */
  color?: string;
};

// Map a weather condition to the lucide icon + an accent tone that reads on a
// dark/glass background. No emoji; this is the production icon set.
function pickIcon(condition: Condition) {
  switch (condition) {
    case 'clear-day':
      return { Cmp: Sun, color: '#FFD15C' };
    case 'clear-night':
      return { Cmp: Moon, color: '#C4D2FF' };
    case 'partly-cloudy':
      return { Cmp: CloudSun, color: '#E8EDF5' };
    case 'cloudy':
      return { Cmp: Cloud, color: '#D7DEE9' };
    case 'rain':
      return { Cmp: CloudRain, color: '#7BB3F0' };
    case 'thunder':
      return { Cmp: CloudLightning, color: '#9C7BFF' };
    case 'snow':
      return { Cmp: CloudSnow, color: '#E5F2FF' };
    case 'fog':
      return { Cmp: CloudFog, color: '#B5BCC8' };
  }
}

export default function WeatherIcon({ condition, size = 24, strokeWidth = 1.8, color }: Props) {
  const { Cmp, color: pickedColor } = pickIcon(condition);
  return <Cmp size={size} color={color ?? pickedColor} strokeWidth={strokeWidth} />;
}

// Small helper for hero placement — adds a soft outer shadow / glow.
export function WeatherIconHero({ condition, size = 96 }: { condition: Condition; size?: number }) {
  const { color } = pickIcon(condition);
  return (
    <View
      style={{
        shadowColor: color,
        shadowOpacity: 0.45,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 6 },
      }}>
      <WeatherIcon condition={condition} size={size} strokeWidth={1.4} color={color} />
    </View>
  );
}
