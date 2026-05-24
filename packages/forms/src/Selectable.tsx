/**
 * Selectable — large pickable card row (radio-style) with icon, description,
 * and bouncy check animation on select.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (Icon, ThemedText, AnimatedView), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Selectable.demo.tsx
 * @donor      fitstake/components/forms/Selectable.tsx
 */
import React, { type ReactNode } from 'react';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { AnimatedView, Icon, type IconName, ThemedText, useThemeColors } from '@jv/ui';

interface SelectableProps {
  title: string;
  description?: string;
  icon?: IconName;
  customIcon?: ReactNode;
  iconColor?: string;
  selected?: boolean;
  onPress?: () => void;
  error?: string;
  className?: string;
  containerClassName?: string;
  style?: StyleProp<ViewStyle>;
}

const Selectable: React.FC<SelectableProps> = ({
  title,
  description,
  icon,
  customIcon,
  iconColor,
  selected = false,
  onPress,
  error,
  className = '',
  containerClassName = '',
  style,
}) => {
  const colors = useThemeColors();
  return (
    <View className={`mb-2 ${containerClassName}`}>
      <Pressable
        onPress={onPress}
        style={style}
        className={`
          border dark:border-transparent rounded-2xl p-4 active:opacity-70 dark:bg-dark-secondary/50
          ${selected ? 'bg-light-subtext/0 dark:bg-dark-secondary border-highlight' : 'border-neutral-400 dark:border-transparent'}
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
      >
        <View className="flex-row items-center">
          {icon && (
            <View
              className={`mr-4 h-12 w-12 rounded-xl items-center justify-center bg-light-secondary dark:bg-white/10 ${selected ? 'bg-highlight' : ''}`}
            >
              <Icon name={icon} size={20} strokeWidth={1.2} color={iconColor || (selected ? 'white' : colors.icon)} />
            </View>
          )}
          {customIcon && (
            <View className="mr-4 h-12 w-12 rounded-xl items-center justify-center bg-light-secondary dark:bg-dark-secondary">
              {customIcon}
            </View>
          )}
          <View className="flex-1">
            <ThemedText className="font-semibold text-base">{title}</ThemedText>
            {description && (
              <ThemedText className="text-sm text-light-subtext dark:text-dark-subtext mt-0">{description}</ThemedText>
            )}
          </View>
          {selected ? (
            <AnimatedView animation="bounceIn" duration={500} className="ml-3">
              <Icon name="CheckCircle2" size={24} color={colors.highlight} />
            </AnimatedView>
          ) : null}
        </View>
      </Pressable>
      {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
    </View>
  );
};

export default Selectable;
