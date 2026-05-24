/**
 * Card — image card with classic / overlay / compact / minimal variants.
 *
 * Note: the donor (fitstake) had a built-in `hasFavorite` prop that imported a
 * domain-specific `Favorite` component. That has been removed; pass any badge
 * widget via the `topRightSlot` prop instead so the library stays domain-free.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router, expo-linear-gradient, @expo/vector-icons
 * @requires   @jv/ui (Button, Icon, ThemedText), @jv/ui/utils (shadowPresets), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Card.demo.tsx
 * @donor      fitstake/components/Card.tsx
 */
import React from 'react';
import {
  Dimensions,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ThemedText from './ThemedText';
import { Button } from './Button';
import { shadowPresets } from './utils/useShadow';
import { useThemeColors } from './theme/useThemeColors';

const { width: windowWidth } = Dimensions.get('window');

interface CardProps {
  title: string;
  description?: string;
  hasShadow?: boolean;
  image: string | ImageSourcePropType;
  href?: string;
  onPress?: () => void;
  variant?: 'classic' | 'overlay' | 'compact' | 'minimal';
  className?: string;
  button?: string;
  onButtonPress?: () => void;
  price?: string;
  rating?: number;
  badge?: string;
  badgeColor?: string;
  imageHeight?: number;
  showOverlay?: boolean;
  topRightSlot?: React.ReactNode;
  overlayGradient?: readonly [string, string];
  width?: number | string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children?: React.ReactNode;
  style?: ViewStyle;
}

const roundedMap: Record<NonNullable<CardProps['rounded']>, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

const Card: React.FC<CardProps> = ({
  title,
  description,
  image,
  hasShadow = false,
  href,
  onPress,
  variant = 'classic',
  className = 'w-full',
  button,
  onButtonPress,
  price,
  rating,
  badge,
  badgeColor: _badgeColor = '#000000',
  imageHeight = 200,
  showOverlay = true,
  topRightSlot,
  overlayGradient = ['transparent', 'rgba(0,0,0,0.3)'] as readonly [string, string],
  rounded = 'lg',
  width = '100%',
  children,
  style,
  ...props
}) => {
  const colors = useThemeColors();
  const roundedClass = roundedMap[rounded] ?? 'rounded-lg';

  const renderBadge = () =>
    badge ? (
      <View className="absolute top-2 left-2 z-10 px-2 py-1 rounded-full bg-white/70 dark:bg-black/70">
        <ThemedText className="text-xs font-medium">{badge}</ThemedText>
      </View>
    ) : null;

  const renderRating = () =>
    rating ? (
      <View className="flex-row items-center">
        <MaterialIcons name="star" size={10} color={colors.text} />
        <ThemedText className="text-xs ml-0 text-gray-500 dark:text-gray-300">{rating}</ThemedText>
      </View>
    ) : null;

  const renderPrice = () =>
    price ? (
      <ThemedText
        className={`text-xs ${variant === 'overlay' ? 'text-white' : 'text-gray-500 dark:text-gray-300'}`}
      >
        {price}
      </ThemedText>
    ) : null;

  const cardContent = (
    <View
      className={`flex-1 ${className}`}
      style={[hasShadow && shadowPresets.small, style]}
    >
      <View className="relative">
        {topRightSlot ? <View className="absolute top-3 right-3 z-50">{topRightSlot}</View> : null}
        {variant === 'overlay' ? (
          <ImageBackground
            source={typeof image === 'string' ? { uri: image } : image}
            className={`w-full overflow-hidden ${roundedClass}`}
            style={{ height: imageHeight }}
          >
            {showOverlay && (
              <LinearGradient colors={overlayGradient} className="w-full h-full relative flex flex-col justify-end">
                <View className="p-4 absolute bottom-0 left-0 right-0">
                  <Text className="text-base font-bold text-white">{title}</Text>
                  {description && (
                    <Text numberOfLines={1} className="text-xs text-white">
                      {description}
                    </Text>
                  )}
                  {(price || rating) && (
                    <View className="flex-row items-center mt-1 justify-start">
                      {renderPrice()}
                      {renderRating()}
                    </View>
                  )}
                </View>
              </LinearGradient>
            )}
          </ImageBackground>
        ) : (
          <View className={`${roundedClass} bg-neutral-200 dark:bg-dark-secondary`} style={shadowPresets.small}>
            <Image
              source={typeof image === 'string' ? { uri: image } : image}
              className={`w-full ${roundedClass}`}
              style={{ height: imageHeight }}
            />
            {children}
          </View>
        )}
        {renderBadge()}
      </View>

      {variant !== 'overlay' && (
        <View className="py-2 w-full flex-1">
          <ThemedText className="text-sm font-medium">{title}</ThemedText>
          {description && (
            <ThemedText numberOfLines={1} className="text-xs mb-px text-gray-500 dark:text-gray-300">
              {description}
            </ThemedText>
          )}
          {(price || rating) && (
            <View className="flex-row items-center mt-1 bg-light-secondary dark:bg-dark-secondary rounded-full px-2 py-1 mr-auto">
              {renderPrice()}
              <View className="mx-1" />
              {renderRating()}
            </View>
          )}
          {button && <Button className="mt-3" title={button} size="small" onPress={onButtonPress} />}
        </View>
      )}
    </View>
  );

  const onPressHandler = href ? () => router.push(href as any) : onPress;

  return (
    <TouchableOpacity
      className={`${variant === 'overlay' ? '!h-auto' : ''} ${className}`}
      activeOpacity={0.8}
      onPress={onPressHandler}
      style={{ width: width as ViewStyle['width'], ...style }}
      {...props}
    >
      {cardContent}
    </TouchableOpacity>
  );
};

export default Card;
