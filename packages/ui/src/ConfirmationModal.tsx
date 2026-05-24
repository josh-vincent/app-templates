/**
 * ConfirmationModal — themed confirm/cancel bottom-sheet for destructive actions.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, react-native-actions-sheet, expo-navigation-bar
 * @requires   @jv/ui (ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./ConfirmationModal.demo.tsx
 * @donor      fitstake/components/ConfirmationModal.tsx
 */
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import ActionSheet, {
  type ActionSheetRef,
} from 'react-native-actions-sheet';
import * as NavigationBar from 'expo-navigation-bar';
import ThemedText from './ThemedText';
import { useTheme } from './theme/ThemeContext';
import { useThemeColors } from './theme/useThemeColors';

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  actionSheetRef: React.RefObject<ActionSheetRef>;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  actionSheetRef,
}) => {
  const { isDark } = useTheme();
  const colors = useThemeColors();

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(colors.bg);
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
      return () => {
        NavigationBar.setBackgroundColorAsync(colors.bg);
        NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
      };
    }
  }, [isDark, colors.bg]);

  const handleConfirm = () => {
    actionSheetRef.current?.hide();
    onConfirm();
  };
  const handleCancel = () => {
    actionSheetRef.current?.hide();
    onCancel();
  };

  return (
    <ActionSheet
      ref={actionSheetRef}
      gestureEnabled
      drawUnderStatusBar={false}
      statusBarTranslucent
      containerStyle={{
        backgroundColor: colors.bg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
    >
      <View className="p-8 pb-14">
        <ThemedText className="text-xl font-bold mb-2">{title}</ThemedText>
        <ThemedText className="text-light-subtext dark:text-dark-subtext mb-6">{message}</ThemedText>
        <View className="flex-row justify-between space-x-3">
          <Pressable
            onPress={handleCancel}
            className="px-4 py-3 flex-1 rounded-lg items-center bg-light-secondary dark:bg-dark-secondary"
          >
            <ThemedText>{cancelText}</ThemedText>
          </Pressable>
          <Pressable onPress={handleConfirm} className="px-4 py-3 flex-1 items-center rounded-lg bg-red-500">
            <Text className="text-white">{confirmText}</Text>
          </Pressable>
        </View>
      </View>
    </ActionSheet>
  );
};

export default ConfirmationModal;
