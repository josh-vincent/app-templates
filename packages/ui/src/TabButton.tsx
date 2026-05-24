/**
 * TabButton — animated tab item for expo-router's TabTrigger slot.
 * Supports icon / avatar / customContent and an animated focus label.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router
 * @requires   @jv/ui (Icon, Avatar, AnimatedView, ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./TabButton.demo.tsx
 * @donor      fitstake/components/TabButton.tsx
 */
import React, { forwardRef, type ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import Icon, { type IconName } from './Icon';
import ThemedText from './ThemedText';
import Avatar from './Avatar';
import { useThemeColors } from './theme/useThemeColors';

export type TabButtonProps = TabTriggerSlotProps & {
  icon?: IconName;
  avatar?: string;
  customContent?: ReactNode;
  labelAnimated?: boolean;
  hasBadge?: boolean;
};

export const TabButton = forwardRef<View, TabButtonProps>(
  ({ icon, avatar, children, isFocused, onPress, customContent, labelAnimated = true, hasBadge = false, ...props }, ref) => {
    const colors = useThemeColors();
    const [labelOpacity] = useState(new Animated.Value(isFocused ? 1 : 0));
    const [labelMarginBottom] = useState(new Animated.Value(isFocused ? 0 : 10));
    const [lineScale] = useState(new Animated.Value(isFocused ? 0 : 10));

    useEffect(() => {
      Animated.parallel([
        Animated.timing(labelOpacity, { toValue: isFocused ? 1 : 0, duration: 200, useNativeDriver: true }),
        Animated.timing(labelMarginBottom, { toValue: isFocused ? 0 : 10, duration: 200, useNativeDriver: true }),
        Animated.timing(lineScale, { toValue: isFocused ? 1 : 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }, [isFocused, labelOpacity, labelMarginBottom, lineScale]);

    const renderContent = () => {
      if (customContent) return customContent;
      if (icon) {
        return (
          <View className="relative">
            <View className={`w-full relative ${isFocused ? 'opacity-100' : 'opacity-40'}`}>
              <Icon name={icon} size={26} strokeWidth={isFocused ? 2.1 : 1.7} color={isFocused ? colors.highlight : colors.icon} />
            </View>
            {hasBadge && (
              <View className="absolute w-3 h-3 border border-light-primary dark:border-dark-primary rounded-full bg-highlight -top-1 -right-1.5" />
            )}
          </View>
        );
      }
      if (avatar) {
        return (
          <View className={`rounded-full border-2 ${isFocused ? 'border-highlight' : 'border-transparent'}`}>
            <Avatar src={avatar} size="xxs" />
          </View>
        );
      }
      return null;
    };

    return (
      <Pressable className="flex-1 overflow-hidden" ref={ref} {...props} onPress={onPress}>
        <View className="flex-col items-center justify-center pt-4 pb-0 w-full relative">
          {renderContent()}
          {labelAnimated ? (
            <Animated.View
              className="relative"
              style={{ opacity: labelOpacity, transform: [{ translateY: labelMarginBottom }] }}
            >
              <ThemedText className="text-[9px] mt-px text-highlight">{children}</ThemedText>
            </Animated.View>
          ) : (
            <ThemedText className={`text-[9px] mt-px ${isFocused ? 'text-highlight' : 'text-neutral-500'}`}>{children}</ThemedText>
          )}
        </View>
      </Pressable>
    );
  }
);

TabButton.displayName = 'TabButton';

export default TabButton;
