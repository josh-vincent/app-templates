/**
 * ActionSheetThemed — theme-aware bottom sheet wrapper.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, react-native-actions-sheet
 * @requires   @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./ActionSheetThemed.demo.tsx
 * @donor      fitstake/components/ActionSheetThemed.tsx
 */
import React, { forwardRef } from 'react';
import ActionSheet, {
  type ActionSheetProps,
  type ActionSheetRef,
} from 'react-native-actions-sheet';
import { useThemeColors } from './theme/useThemeColors';

interface ActionSheetThemedProps extends ActionSheetProps {}

const ActionSheetThemed = forwardRef<ActionSheetRef, ActionSheetThemedProps>(
  ({ containerStyle, ...props }, ref) => {
    const colors = useThemeColors();
    return (
      <ActionSheet
        {...props}
        ref={ref}
        containerStyle={{
          backgroundColor: colors.sheet,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          ...containerStyle,
        }}
      />
    );
  }
);

ActionSheetThemed.displayName = 'ActionSheetThemed';

export default ActionSheetThemed;
export type { ActionSheetRef };
