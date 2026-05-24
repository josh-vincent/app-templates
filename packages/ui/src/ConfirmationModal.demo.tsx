import React, { useRef } from 'react';
import { View } from 'react-native';
import type { ActionSheetRef } from 'react-native-actions-sheet';
import ConfirmationModal from './ConfirmationModal';
import { Button } from './Button';

export const meta = {
  title: 'ConfirmationModal',
  description: 'Themed confirm/cancel sheet for destructive actions.',
  variants: ['delete'],
};

export default function ConfirmationModalDemo() {
  const ref = useRef<ActionSheetRef>(null);
  return (
    <View className="p-global">
      <Button title="Delete..." variant="outline" onPress={() => ref.current?.show()} />
      <ConfirmationModal
        actionSheetRef={ref}
        title="Delete item?"
        message="This cannot be undone."
        onConfirm={() => undefined}
        onCancel={() => undefined}
        confirmText="Delete"
      />
    </View>
  );
}
