/**
 * Input — text input with animated / classic / underlined variants, password
 * mode, optional right icon, and error state.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind
 * @requires   @jv/ui (Icon, ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Input.demo.tsx
 * @donor      fitstake/components/forms/Input.tsx
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, TextInput as RNTextInput, type TextInputProps, View } from 'react-native';
import { styled } from 'nativewind';
import { Icon, type IconName, ThemedText, useThemeColors } from '@jv/ui';

export type InputVariant = 'animated' | 'classic' | 'underlined';

interface CustomTextInputProps extends TextInputProps {
  label?: string;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  error?: string;
  isPassword?: boolean;
  className?: string;
  containerClassName?: string;
  isMultiline?: boolean;
  variant?: InputVariant;
  inRow?: boolean;
}

const StyledTextInput = styled(RNTextInput);

const Input: React.FC<CustomTextInputProps> = ({
  label,
  rightIcon,
  onRightIconPress,
  error,
  isPassword = false,
  className = '',
  containerClassName = '',
  value,
  onChangeText,
  isMultiline = false,
  variant = 'animated',
  ...props
}) => {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const animatedLabelValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    if (variant !== 'classic') {
      Animated.timing(animatedLabelValue, {
        toValue: isFocused || localValue !== '' ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isFocused, localValue, animatedLabelValue, variant]);

  const handleChangeText = (text: string) => {
    setLocalValue(text);
    onChangeText?.(text);
  };

  const labelStyle = {
    top: animatedLabelValue.interpolate({ inputRange: [0, 1], outputRange: [16, -8] }),
    fontSize: animatedLabelValue.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    color: animatedLabelValue.interpolate({ inputRange: [0, 1], outputRange: [colors.placeholder, colors.text] }),
    left: 12,
    paddingHorizontal: 8,
    position: 'absolute' as const,
    zIndex: 50,
    backgroundColor: colors.bg,
  };

  const renderRightIcon = () => {
    if (isPassword) {
      return (
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          className={`absolute right-3 ${variant === 'classic' ? 'top-[32px]' : 'top-[18px]'} z-10`}
        >
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

  if (variant === 'classic') {
    return (
      <View className={`mb-global relative ${containerClassName}`}>
        {label && <ThemedText className="mb-2 font-medium">{label}</ThemedText>}
        <View className="relative">
          <StyledTextInput
            ref={inputRef}
            className={`border rounded-lg px-3 ${isMultiline ? 'h-36 pt-4' : 'h-14'} ${isPassword || rightIcon ? 'pr-10' : ''} text-black dark:text-white bg-transparent ${isFocused ? 'border-black dark:border-white' : 'border-black/60 dark:border-white/60'} ${error ? 'border-red-500' : ''} ${className}`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={localValue}
            onChangeText={handleChangeText}
            secureTextEntry={isPassword && !showPassword}
            placeholderTextColor={colors.placeholder}
            numberOfLines={isMultiline ? 4 : 1}
            textAlignVertical={isMultiline ? 'top' : 'center'}
            multiline={isMultiline}
            {...props}
          />
          {renderRightIcon()}
        </View>
        {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
      </View>
    );
  }

  if (variant === 'underlined') {
    const ulLabelStyle = { ...labelStyle, left: 0, paddingHorizontal: 0 };
    return (
      <View className={`mb-global relative ${containerClassName}`}>
        <View className="relative">
          <Pressable className="px-0 bg-light-primary dark:bg-dark-primary z-40" onPress={() => inputRef.current?.focus()}>
            <Animated.Text style={ulLabelStyle} className="absolute z-50 text-black dark:text-white">
              {label}
            </Animated.Text>
          </Pressable>
          <StyledTextInput
            ref={inputRef}
            className={`border-b-2 py-3 px-0 ${isMultiline ? 'h-36 pt-4' : 'h-14'} ${isPassword || rightIcon ? 'pr-10' : ''} text-black dark:text-white bg-transparent border-t-0 border-l-0 border-r-0 ${isFocused ? 'border-black dark:border-white' : 'border-black/60 dark:border-white/60'} ${error ? 'border-red-500' : ''} ${className}`}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={localValue}
            onChangeText={handleChangeText}
            secureTextEntry={isPassword && !showPassword}
            placeholderTextColor="transparent"
            numberOfLines={isMultiline ? 4 : 1}
            textAlignVertical={isMultiline ? 'top' : 'center'}
            multiline={isMultiline}
            {...props}
          />
          {renderRightIcon()}
        </View>
        {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
      </View>
    );
  }

  return (
    <View className={`mb-8 relative ${containerClassName}`}>
      <Pressable
        className="z-40 px-1 bg-light-primary dark:bg-dark-primary"
        style={{ position: 'absolute', left: 4, top: 0 }}
        onPress={() => inputRef.current?.focus()}
      >
        <Animated.Text style={labelStyle} className="bg-light-primary dark:bg-dark-primary text-black dark:text-white">
          {label}
        </Animated.Text>
      </Pressable>
      <StyledTextInput
        ref={inputRef}
        className={`border rounded-lg py-3 px-3 ${isMultiline ? 'h-36 pt-4' : 'h-14'} ${isPassword || rightIcon ? 'pr-10' : ''} text-black dark:text-white bg-transparent ${isFocused ? 'border-black dark:border-white' : 'border-black/60 dark:border-white/60'} ${error ? 'border-red-500' : ''} ${className}`}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        value={localValue}
        onChangeText={handleChangeText}
        secureTextEntry={isPassword && !showPassword}
        placeholderTextColor="transparent"
        numberOfLines={isMultiline ? 4 : 1}
        textAlignVertical={isMultiline ? 'top' : 'center'}
        multiline={isMultiline}
        {...props}
      />
      {renderRightIcon()}
      {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
    </View>
  );
};

export default Input;
