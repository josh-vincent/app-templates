/**
 * ThemeToggle — dual-icon sun/moon switch wired to the @jv/ui ThemeContext.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (Icon), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./ThemeToggle.demo.tsx
 * @donor      fitstake/components/ThemeToggle.tsx
 */
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { useTheme } from './theme/ThemeContext';
import { useThemeColors } from './theme/useThemeColors';

interface ThemeToggleProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  className?: string;
  accessibilityLabel?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ value, onChange, className = '', accessibilityLabel }) => {
  const { isDark, toggleTheme } = useTheme();
  const colors = useThemeColors();
  const isControlled = value !== undefined;
  const isActive = isControlled ? value : isDark;
  const slideAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: isActive ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [isActive, slideAnim]);

  const handlePress = () => {
    if (isControlled && onChange) onChange(!value);
    else if (!isControlled) toggleTheme();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      className={`flex-row items-center py-1 ${className}`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (isActive ? 'Switch to light theme' : 'Switch to dark theme')}
    >
      <View className="w-20 h-10 rounded-full flex-row items-center justify-between">
        <View className="absolute w-full h-full rounded-full bg-light-secondary dark:bg-dark-secondary" />
        <View className="z-10 w-8 h-8 items-center justify-center ml-1">
          <Icon name="Sun" size={16} color={isActive ? colors.placeholder : colors.text} />
        </View>
        <View className="z-10 w-8 h-8 items-center justify-center mr-1">
          <Icon name="Moon" size={16} color={!isActive ? colors.placeholder : colors.text} />
        </View>
        <Animated.View
          style={{
            transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 43] }) }],
            position: 'absolute',
            top: 4,
          }}
          className="w-8 h-8 bg-white dark:bg-dark-primary rounded-full shadow-sm"
        />
      </View>
    </TouchableOpacity>
  );
};

export default ThemeToggle;
