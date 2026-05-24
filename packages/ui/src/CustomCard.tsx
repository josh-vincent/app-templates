/**
 * CustomCard — wrapper card with rounded/padding/shadow/border/background props.
 * Supports an optional background image with overlay.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router
 * @platforms  ios, android
 * @demo       ./CustomCard.demo.tsx
 * @donor      fitstake/components/CustomCard.tsx
 */
import React, { type ReactNode } from 'react';
import {
  ImageBackground,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Link } from 'expo-router';

type Rounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';
type Shadow = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface CustomCardProps {
  children: ReactNode;
  rounded?: Rounded;
  padding?: Padding;
  shadow?: Shadow;
  border?: boolean;
  borderColor?: string;
  background?: boolean;
  elevation?: boolean;
  className?: string;
  style?: ViewStyle;
  backgroundImage?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  horizontal?: boolean;
  onPress?: () => void;
  href?: string;
}

const roundedClassMap: Record<Rounded, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};
const roundedValueMap: Record<Rounded, number> = {
  none: 0,
  sm: 2,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
};
const paddingClassMap: Record<Padding, string> = {
  none: '',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};
const shadowClassMap: Record<Shadow, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};
const elevationValueMap: Record<Exclude<Shadow, 'none'>, number> = {
  sm: 2,
  md: 4,
  lg: 8,
  xl: 16,
};

const CustomCard: React.FC<CustomCardProps> = ({
  children,
  rounded = 'lg',
  padding = 'md',
  shadow = 'none',
  border = false,
  borderColor,
  background = true,
  elevation = true,
  className = '',
  style,
  backgroundImage,
  overlayColor = 'black',
  overlayOpacity = 0.3,
  horizontal = false,
  onPress,
  href,
}) => {
  const roundedClass = roundedClassMap[rounded];
  const paddingClass = paddingClassMap[padding];
  const shadowClass = elevation && Platform.OS !== 'android' ? shadowClassMap[shadow] : '';
  const borderClass = !border
    ? ''
    : borderColor
    ? `border border-[${borderColor}]`
    : 'border border-black/10 dark:border-white/10';
  const backgroundClass = background ? 'bg-light-primary dark:bg-dark-primary' : '';
  const roundedValue = roundedValueMap[rounded];

  const elevationStyle: ViewStyle =
    elevation && Platform.OS === 'android' && shadow !== 'none'
      ? {
          elevation: elevationValueMap[shadow],
          shadowColor: 'rgba(0, 0, 0, 0.5)',
          shadowRadius: elevationValueMap[shadow] / 2,
          shadowOffset: { height: elevationValueMap[shadow] / 3, width: 0 },
        }
      : {};

  const combinedStyle = { ...style, ...elevationStyle };

  const content = backgroundImage ? (
    <View className={`overflow-visible ${roundedClass} ${shadowClass} ${className}`} style={style}>
      <ImageBackground
        className={`${roundedClass} relative w-full overflow-hidden`}
        source={typeof backgroundImage === 'string' ? { uri: backgroundImage } : backgroundImage}
        imageStyle={{ borderRadius: roundedValue }}
        style={combinedStyle}
      >
        {overlayOpacity > 0 && (
          <View
            className={`${paddingClass} absolute inset-0`}
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
              borderRadius: roundedValue,
            }}
          />
        )}
        <View>{children}</View>
      </ImageBackground>
    </View>
  ) : (
    <View
      className={`overflow-visible w-full overflow-hidden ${roundedClass} ${paddingClass} ${shadowClass} ${borderClass} ${backgroundClass} ${className} ${horizontal ? 'flex-row' : 'flex-col'}`}
      style={style}
    >
      {children}
    </View>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        <TouchableOpacity activeOpacity={1}>{content}</TouchableOpacity>
      </Link>
    );
  }
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={1}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

export default CustomCard;
