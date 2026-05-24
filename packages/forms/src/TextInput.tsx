/**
 * TextInput — animated floating-label text input (single variant).
 * For variant flexibility (classic/underlined) use `<Input>` from this package.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind
 * @requires   @jv/ui (Icon, ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./TextInput.demo.tsx
 * @donor      fitstake/components/forms/TextInput.tsx
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput as RNTextInput, type TextInputProps, View } from 'react-native';
import { styled } from 'nativewind';
import { Icon, type IconName, ThemedText, useThemeColors } from '@jv/ui';

interface CustomTextInputProps extends TextInputProps {
  label: string;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  error?: string;
  isPassword?: boolean;
  className?: string;
  containerClassName?: string;
}

const StyledTextInput = styled(RNTextInput);

const TextInput: React.FC<CustomTextInputProps> = ({
  label,
  rightIcon,
  onRightIconPress,
  error,
  isPassword = false,
  className = '',
  containerClassName = '',
  value,
  onChangeText,
  ...props
}) => {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const animatedLabelValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    Animated.timing(animatedLabelValue, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value, animatedLabelValue]);

  const labelStyle = {
    top: animatedLabelValue.interpolate({ inputRange: [0, 1], outputRange: [16, -8] }),
    fontSize: animatedLabelValue.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    color: animatedLabelValue.interpolate({ inputRange: [0, 1], outputRange: [colors.placeholder, colors.text] }),
    left: 12,
    paddingHorizontal: 8,
  };

  const renderRightIcon = () => {
    if (isPassword) {
      return (
        <Pressable onPress={() => setShowPassword((v) => !v)} className="absolute right-3 top-[18px] z-10">
          <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={20} color={colors.text} />
        </Pressable>
      );
    }
    if (rightIcon) {
      return (
        <Pressable onPress={onRightIconPress} className="absolute right-3 top-[18px] z-10">
          <Icon name={rightIcon} size={20} color={colors.text} />
        </Pressable>
      );
    }
    return null;
  };

  return (
    <View className={`mb-global ${containerClassName}`}>
      <View className="relative">
        <Pressable className="z-40 bg-light-primary px-1 dark:bg-dark-primary" onPress={() => inputRef.current?.focus()}>
          <Animated.Text style={labelStyle} className="absolute z-50 bg-light-primary px-1 text-black dark:bg-dark-primary dark:text-white">
            {label}
          </Animated.Text>
        </Pressable>
        <StyledTextInput
          ref={inputRef}
          className={`h-14 rounded-lg border px-3 py-3 ${isPassword || rightIcon ? 'pr-10' : ''} bg-transparent text-black dark:text-white ${isFocused ? 'border-black dark:border-white' : 'border-black/40 dark:border-white/40'} ${error ? 'border-red-500' : ''} ${className}`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor="transparent"
          {...props}
        />
        {renderRightIcon()}
      </View>
      {error && <ThemedText className="mt-1 text-xs text-red-500">{error}</ThemedText>}
    </View>
  );
};

export default TextInput;
