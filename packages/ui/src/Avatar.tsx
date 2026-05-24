/**
 * Avatar — circular avatar with image, initials fallback, optional border.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router
 * @requires   @jv/ui (ThemedText)
 * @platforms  ios, android
 * @demo       ./Avatar.demo.tsx
 * @donor      fitstake/components/Avatar.tsx
 */
import React from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import ThemedText from './ThemedText';

type AvatarProps = {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  src?: string | ImageSourcePropType;
  name?: string;
  border?: boolean;
  bgColor?: string;
  onPress?: () => void;
  link?: string;
  className?: string;
  style?: ViewStyle;
};

const sizeMap: Record<NonNullable<AvatarProps['size']>, string> = {
  xxs: 'w-7 h-7',
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20',
  xxl: 'w-24 h-24',
};

const FALLBACK_SRC: ImageSourcePropType = {
  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
};

const Avatar: React.FC<AvatarProps> = ({
  size = 'md',
  src,
  name,
  border = false,
  bgColor = 'bg-light-secondary dark:bg-dark-secondary',
  onPress,
  link,
  className,
  style,
}) => {
  const borderStyle = border ? 'border-2 border-light-secondary dark:border-dark-secondary' : '';

  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : '';

  const source: ImageSourcePropType = !src
    ? FALLBACK_SRC
    : typeof src === 'string'
    ? { uri: src }
    : src;

  const avatarContent = (
    <View
      className={`rounded-full flex-shrink-0 ${bgColor} ${sizeMap[size]} ${borderStyle} items-center justify-center ${className ?? ''}`}
      style={style}
    >
      {src ? (
        <Image source={source} className="rounded-full w-full h-full" resizeMode="cover" />
      ) : (
        <ThemedText className="font-medium text-center">{initials}</ThemedText>
      )}
    </View>
  );

  if (link) {
    return <Pressable onPress={() => router.push(link as any)}>{avatarContent}</Pressable>;
  }
  return onPress ? <Pressable onPress={onPress}>{avatarContent}</Pressable> : avatarContent;
};

export default Avatar;
