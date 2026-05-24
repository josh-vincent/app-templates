/**
 * Counter — numeric counter with +/- buttons. `undefined` is "any".
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (ThemedText)
 * @platforms  ios, android
 * @demo       ./Counter.demo.tsx
 * @donor      fitstake/components/forms/Counter.tsx
 */
import React, { useState } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@jv/ui';

interface CounterProps {
  label?: string;
  value?: number;
  onChange?: (value: number | undefined) => void;
  min?: number;
  max?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export default function Counter({ value: controlled, onChange, min = 0, max = 99, className, style }: CounterProps) {
  const [internal, setInternal] = useState<number | undefined>(undefined);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : internal;

  const update = (next: number | undefined) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const inc = () => {
    if (value === undefined) update(1);
    else if (value < max) update(value + 1);
  };
  const dec = () => {
    if (value === 1) update(undefined);
    else if (value !== undefined && value > min) update(value - 1);
  };

  return (
    <View className={`w-auto ${className ?? ''}`} style={style}>
      <View className="w-full flex-row items-center justify-between">
        <View className="flex-row min-w-[100px] justify-between p-1 items-center bg-light-secondary dark:bg-dark-secondary rounded-full overflow-hidden">
          <Pressable onPress={dec} className="w-8 h-8 bg-light-primary dark:bg-dark-primary rounded-full items-center justify-center">
            <ThemedText className="text-lg">-</ThemedText>
          </Pressable>
          <View className="items-center justify-center px-4 min-w-[80px]">
            <ThemedText className="text-base font-medium">{value === undefined ? 'any' : value}</ThemedText>
          </View>
          <Pressable onPress={inc} className="w-8 h-8 bg-light-primary dark:bg-dark-primary rounded-full items-center justify-center">
            <ThemedText className="text-lg">+</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
