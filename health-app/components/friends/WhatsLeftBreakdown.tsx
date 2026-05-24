// One-line "what's left" eyebrow used by the Friends progress hub. Takes the
// canonical WhatsLeft shape from convex/lib/whatsLeft.ts and just renders its
// `label` field — the backend is the single source of truth for copy. The
// glyph + color choices are local cosmetics keyed off `kind`.

import React from 'react';
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';
import type { WhatsLeft } from '@/convex/lib/whatsLeft';
import { EMBER, GOLD, LIME } from '@/lib/theme';
import type { IconName } from '@/components/Icon';

function styleFor(
  wl: WhatsLeft,
  mutedText: string
): { color: string; icon: IconName } {
  switch (wl.kind) {
    case 'steps_today':
      return { color: mutedText, icon: 'Footprints' };
    case 'distance_left':
      return { color: mutedText, icon: 'MapPin' };
    case 'sessions_left':
      return { color: mutedText, icon: 'Dumbbell' };
    case 'time_left':
      return { color: mutedText, icon: 'Clock' };
    case 'awaiting_proof':
      return { color: GOLD, icon: 'CircleAlert' };
    case 'finished':
      return wl.outcome === 'won'
        ? { color: LIME, icon: 'CircleCheck' }
        : { color: EMBER, icon: 'CircleX' };
  }
}

export function WhatsLeftBreakdown({ whatsLeft }: { whatsLeft: WhatsLeft }) {
  const colors = useThemeColors();
  const mutedText = colors.text + '99';
  const { color, icon } = styleFor(whatsLeft, mutedText);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={12} color={color} />
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
        }}>
        {whatsLeft.label}
      </Text>
    </View>
  );
}

export default WhatsLeftBreakdown;
