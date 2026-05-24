import React, { useRef } from 'react';
import { View } from 'react-native';
import ActionSheetThemed, { type ActionSheetRef } from './ActionSheetThemed';
import { Button } from './Button';
import ThemedText from './ThemedText';

export const meta = {
  title: 'ActionSheetThemed',
  description: 'Theme-aware bottom sheet wrapper.',
  variants: ['basic'],
};

export default function ActionSheetThemedDemo() {
  const ref = useRef<ActionSheetRef>(null);
  return (
    <View className="p-global">
      <Button title="Open sheet" onPress={() => ref.current?.show()} />
      <ActionSheetThemed ref={ref} gestureEnabled>
        <View className="p-8">
          <ThemedText className="text-xl font-bold mb-2">Themed action sheet</ThemedText>
          <ThemedText>Swipe down or tap outside to close.</ThemedText>
        </View>
      </ActionSheetThemed>
    </View>
  );
}
