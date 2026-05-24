import { TabTriggerSlotProps } from 'expo-router/ui';
import { ComponentProps, forwardRef, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon, { IconName } from '@/components/Icon';
import { useThemeColors } from '@/contexts/ThemeColors';

export type TabButtonProps = TabTriggerSlotProps & {
  icon?: IconName;
  customContent?: ReactNode;
  labelAnimated?: boolean;
};

// Lean tab button — focused state changes icon stroke + color and label color.
// No animation libs / extra deps so the casino tab bar is rock-solid.
export const TabButton = forwardRef<View, TabButtonProps>(
  ({ icon, children, isFocused, onPress, customContent, ...props }, ref) => {
    const colors = useThemeColors();
    const tintIcon = isFocused ? colors.highlight : colors.icon;
    const tintText = isFocused ? colors.highlight : '#7b8190';
    return (
      <Pressable
        ref={ref}
        {...props}
        onPress={onPress}
        accessibilityRole="button"
        style={{ flex: 1 }}>
        <View
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 10,
            paddingBottom: 4,
            opacity: isFocused ? 1 : 0.85,
          }}>
          {customContent
            ? customContent
            : icon
              ? (
                <Icon
                  name={icon}
                  size={24}
                  strokeWidth={isFocused ? 2.2 : 1.8}
                  color={tintIcon}
                />
              )
              : null}
          <Text
            style={{
              marginTop: 2,
              fontSize: 10,
              fontWeight: isFocused ? '700' : '500',
              color: tintText,
            }}>
            {children as any}
          </Text>
        </View>
      </Pressable>
    );
  }
);
TabButton.displayName = 'TabButton';
