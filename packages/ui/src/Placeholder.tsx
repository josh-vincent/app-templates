/**
 * Placeholder — empty-state with icon, title, subtitle, optional CTA.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (Icon, ThemedText, Button)
 * @platforms  ios, android
 * @demo       ./Placeholder.demo.tsx
 * @donor      fitstake/components/Placeholder.tsx
 */
import React from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Icon, { type IconName } from './Icon';
import ThemedText from './ThemedText';
import { Button } from './Button';

interface PlaceholderProps {
  title: string;
  subtitle?: string;
  button?: string;
  href?: string;
  icon?: IconName;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export function Placeholder({
  title,
  subtitle,
  button,
  href,
  icon = 'Inbox',
  className = '',
  style,
}: PlaceholderProps) {
  return (
    <View
      className={`bg-light-primary dark:bg-dark-primary items-center justify-center p-4 ${className}`}
      style={style}
    >
      <View className="w-20 h-20 border border-light-secondary dark:border-dark-secondary rounded-full items-center justify-center mb-4">
        <Icon name={icon} size={30} />
      </View>
      <ThemedText className="text-xl font-bold text-center">{title}</ThemedText>
      {subtitle && (
        <ThemedText className="text-light-subtext dark:text-dark-subtext text-center mb-4">{subtitle}</ThemedText>
      )}
      {button && href && (
        <Button className="mt-4" title={button} variant="outline" href={href} rounded="full" />
      )}
    </View>
  );
}

export default Placeholder;
