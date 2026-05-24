/**
 * Icon — Lucide icon wrapper with variant (plain / bordered / contained)
 * and built-in Pressable behavior via `href` or `onPress`.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router, lucide-react-native
 * @requires   @jv/tokens, @jv/ui/theme
 * @platforms  ios, android
 * @a11y       Pressable wrapper supports accessibilityLabel via parent
 * @demo       ./Icon.demo.tsx
 * @donor      fitstake/components/Icon.tsx
 */
import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import * as LucideIcons from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';
import { useThemeColors } from './theme';

type IconVariant = 'plain' | 'bordered' | 'contained';
type IconSize = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';
export type IconName = Exclude<keyof typeof LucideIcons, 'createLucideIcon' | 'default'>;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  variant?: IconVariant;
  iconSize?: IconSize;
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
  style?: ViewStyle;
  strokeWidth?: number;
  fill?: string;
}

const sizeMap: Record<IconSize, { container: string; icon: number }> = {
  xs: { container: 'w-8 h-8', icon: 16 },
  s: { container: 'w-10 h-10', icon: 20 },
  m: { container: 'w-12 h-12', icon: 24 },
  l: { container: 'w-16 h-16', icon: 32 },
  xl: { container: 'w-20 h-20', icon: 40 },
  xxl: { container: 'w-24 h-24', icon: 48 },
};

const variantClasses: Record<IconVariant, string> = {
  plain: '',
  bordered: 'border border-light-secondary dark:border-dark-secondary rounded-full items-center justify-center',
  contained: 'bg-light-secondary dark:bg-dark-secondary rounded-full items-center justify-center',
};

const Icon: React.FC<IconProps> = ({
  name,
  size,
  color,
  variant = 'plain',
  iconSize,
  href,
  onPress,
  disabled = false,
  className,
  style,
  strokeWidth = 2,
  fill = 'none',
}) => {
  const colors = useThemeColors();

  const resolved =
    iconSize && sizeMap[iconSize]
      ? sizeMap[iconSize]
      : typeof size === 'number'
      ? { container: '', icon: size }
      : { container: '', icon: 24 };

  const classes = [
    'items-center justify-center',
    variant !== 'plain' && resolved.container ? resolved.container : '',
    variant !== 'plain' ? variantClasses[variant] : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const IconComponent = LucideIcons[name] as React.ComponentType<LucideProps>;

  const content = (
    <View style={style} className={classes || undefined}>
      <IconComponent size={resolved.icon} color={color || colors.text} strokeWidth={strokeWidth} fill={fill} />
    </View>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        <Pressable disabled={disabled}>{content}</Pressable>
      </Link>
    );
  }

  if (onPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={style}
        className={classes || undefined}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

export default Icon;
