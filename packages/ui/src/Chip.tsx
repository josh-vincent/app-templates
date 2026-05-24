/**
 * Chip — pill with label, optional icon/image, selectable + link variants.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router
 * @requires   @jv/ui (Icon), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Chip.demo.tsx
 * @donor      fitstake/components/Chip.tsx
 */
import React, { type ReactNode, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Link } from 'expo-router';
import Icon, { type IconName } from './Icon';
import { useThemeColors } from './theme/useThemeColors';

type ChipSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface ChipProps {
  label: string;
  isSelected?: boolean;
  className?: string;
  style?: ViewStyle;
  size?: ChipSize;
  href?: string;
  onPress?: () => void;
  icon?: IconName;
  iconSize?: number;
  iconColor?: string;
  image?: ImageSourcePropType;
  imageSize?: number;
  leftContent?: ReactNode;
  selectable?: boolean;
}

const sizeClasses: Record<ChipSize, string> = {
  xs: 'px-1.5 py-0.5 text-xs',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
  xl: 'px-5 py-2 text-lg',
  xxl: 'px-6 py-2.5 text-xl',
};

const defaultIconSize: Record<ChipSize, number> = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20, xxl: 24 };
const defaultImageSize: Record<ChipSize, number> = { xs: 16, sm: 18, md: 20, lg: 24, xl: 28, xxl: 32 };

export const Chip = ({
  label,
  isSelected,
  className,
  style,
  size = 'md',
  href,
  onPress,
  icon,
  iconSize,
  iconColor,
  image,
  imageSize,
  leftContent,
  selectable,
}: ChipProps) => {
  const [selected, setSelected] = useState(isSelected || false);
  const colors = useThemeColors();
  const isChipSelected = selectable ? selected : isSelected;

  const handlePress = () => {
    if (selectable) setSelected(!selected);
    onPress?.();
  };

  const renderLeftContent = () => {
    if (leftContent) return leftContent;
    if (icon) {
      return (
        <Icon
          name={icon}
          size={iconSize ?? defaultIconSize[size]}
          color={iconColor || (isChipSelected ? 'white' : colors.icon)}
          className="mr-2 -ml-1"
        />
      );
    }
    if (image) {
      const s = imageSize ?? defaultImageSize[size];
      return <Image className="rounded-lg mr-2 -ml-2" source={image} style={{ width: s, height: s }} />;
    }
    return null;
  };

  const [paddingClasses, textSizeClass] = sizeClasses[size].split(' text-');

  const chipContent = (
    <View className="flex-row items-center">
      {renderLeftContent()}
      <Text className={`text-${textSizeClass} ${isChipSelected ? 'text-white' : 'text-gray-700 dark:text-white'}`}>
        {label}
      </Text>
    </View>
  );

  const wrapper = (children: ReactNode) => (
    <View className={className ?? ''} style={style}>
      <View
        className={`${paddingClasses} rounded-full ${isChipSelected ? 'bg-highlight' : 'bg-light-secondary dark:bg-dark-secondary'} flex-row items-center justify-center`}
      >
        {children}
      </View>
    </View>
  );

  if (href) {
    return (
      <Link href={href as any} asChild>
        <TouchableOpacity activeOpacity={0.7}>{wrapper(chipContent)}</TouchableOpacity>
      </Link>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} disabled={!onPress && !selectable}>
      {wrapper(chipContent)}
    </TouchableOpacity>
  );
};

export default Chip;
