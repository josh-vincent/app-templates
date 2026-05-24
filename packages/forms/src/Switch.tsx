/**
 * Switch — labeled row switch with optional description + leading icon.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (Icon, ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Switch.demo.tsx
 * @donor      fitstake/components/forms/Switch.tsx
 */
import React, { useRef, useState } from 'react';
import { Animated, type StyleProp, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Icon, type IconName, ThemedText, useThemeColors } from '@jv/ui';

interface SwitchProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  description?: string;
  icon?: IconName;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

const Switch: React.FC<SwitchProps> = ({
  value,
  onChange,
  label,
  description,
  icon,
  disabled = false,
  className = '',
  style,
}) => {
  const colors = useThemeColors();
  const [isOn, setIsOn] = useState(value ?? false);
  const slideAnim = useRef(new Animated.Value(value ?? false ? 1 : 0)).current;
  const isControlled = value !== undefined;
  const switchValue = isControlled ? value : isOn;

  const toggle = () => {
    if (disabled) return;
    const next = !switchValue;
    if (!isControlled) setIsOn(next);
    onChange?.(next);
    Animated.spring(slideAnim, { toValue: next ? 1 : 0, useNativeDriver: true, bounciness: 4, speed: 12 }).start();
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={toggle} disabled={disabled} className={`flex-row items-center py-1 ${className}`} style={style}>
      {icon && (
        <View className="mr-3">
          <Icon name={icon} size={20} color={colors.text} />
        </View>
      )}
      <View className="flex-1">
        {label && <ThemedText className="font-medium text-base">{label}</ThemedText>}
        {description && <ThemedText className="text-sm text-light-subtext dark:text-dark-subtext">{description}</ThemedText>}
      </View>
      <View className="w-10 h-6 rounded-full">
        <View className={`w-full h-full rounded-full absolute ${switchValue ? 'bg-highlight' : 'bg-light-secondary dark:bg-white/40'}`} />
        <Animated.View
          style={{ transform: [{ translateX: slideAnim.interpolate({ inputRange: [0, 1.2], outputRange: [1, 21] }) }] }}
          className="w-5 h-5 bg-white rounded-full shadow-sm my-0.5"
        />
      </View>
    </TouchableOpacity>
  );
};

export default Switch;
