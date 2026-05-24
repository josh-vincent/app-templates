import React, { useState } from 'react';
import { View } from 'react-native';
import Selectable from './Selectable';

export const meta = {
  title: 'Selectable',
  description: 'Card-row radio with icon, description, animated check.',
  variants: ['default'],
};

export default function SelectableDemo() {
  const [active, setActive] = useState('Free');
  return (
    <View className="p-global">
      {['Free', 'Pro', 'Enterprise'].map((plan) => (
        <Selectable
          key={plan}
          title={plan}
          description={`${plan} plan description`}
          icon="Zap"
          selected={active === plan}
          onPress={() => setActive(plan)}
        />
      ))}
    </View>
  );
}
