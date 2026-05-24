/**
 * Button — primary touchable surface with variants & loading state.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind, expo-router, lucide-react-native
 * @requires   @jv/tokens
 * @platforms  ios, android
 * @a11y       role=button, supports accessibilityLabel
 * @demo       ./Button.demo.tsx
 * @donor      fitstake/components/Button.tsx
 */
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Icon, { type IconName } from './Icon';

type RoundedOption = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ButtonProps {
  title?: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  rounded?: RoundedOption;
  href?: string;
  className?: string;
  textClassName?: string;
  disabled?: boolean;
  iconStart?: IconName;
  iconEnd?: IconName;
  iconSize?: number;
  iconColor?: string;
  iconClassName?: string;
}

const buttonStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-highlight',
  secondary: 'bg-light-secondary dark:bg-dark-secondary',
  outline: 'border border-black dark:border-white bg-transparent',
  ghost: 'bg-transparent',
};

const buttonSize: Record<NonNullable<ButtonProps['size']>, string> = {
  small: 'py-2',
  medium: 'py-3',
  large: 'py-5',
};

const roundedStyles: Record<RoundedOption, string> = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  size = 'medium',
  rounded = 'lg',
  href,
  className = '',
  textClassName = '',
  disabled = false,
  iconStart,
  iconEnd,
  iconSize,
  iconColor,
  iconClassName = '',
  ...props
}) => {
  const textColor =
    variant === 'outline' || variant === 'secondary' || variant === 'ghost'
      ? 'text-black dark:text-white'
      : 'text-white dark:text-black';
  const disabledStyle = disabled ? 'opacity-50' : '';

  const resolveIconSize = () => {
    if (iconSize) return iconSize;
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 20;
      default:
        return 18;
    }
  };

  const ButtonContent = (
    <>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'secondary' || variant === 'ghost' ? '#0EA5E9' : '#fff'}
        />
      ) : (
        <View className="flex-row items-center justify-center">
          {iconStart && (
            <Icon name={iconStart} size={resolveIconSize()} color={iconColor} className={`mr-2 ${iconClassName}`} />
          )}
          <Text className={`${textColor} font-medium ${textClassName}`}>{title}</Text>
          {iconEnd && (
            <Icon name={iconEnd} size={resolveIconSize()} color={iconColor} className={`ml-2 ${iconClassName}`} />
          )}
        </View>
      )}
    </>
  );

  const containerClass = `px-4 relative ${buttonStyles[variant]} ${buttonSize[size]} ${roundedStyles[rounded]} items-center justify-center ${disabledStyle} ${className}`;

  if (href) {
    return (
      <TouchableOpacity
        disabled={loading || disabled}
        activeOpacity={0.8}
        className={containerClass}
        {...props}
        onPress={() => router.push(href as any)}
      >
        {ButtonContent}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
      className={containerClass}
      {...props}
    >
      {ButtonContent}
    </TouchableOpacity>
  );
};

export default Button;
