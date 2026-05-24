import React, { useState, useRef } from 'react';
import { View, Pressable, Animated, Platform, UIManager, ViewStyle } from 'react-native';

import Icon, { IconName } from './Icon';
import ThemedText from './ThemedText';

import { INK, PARCHMENT, PARCHMENT_DEEP, SERIF } from '@/lib/theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface ExpandableProps {
  icon?: IconName;
  title: string;
  description?: string;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onPress?: () => void;
  className?: string;
  style?: ViewStyle;
  variant?: 'default' | 'voyage';
}

const Expandable: React.FC<ExpandableProps> = ({
  icon,
  title,
  description,
  children,
  defaultExpanded = false,
  expanded,
  onPress,
  className,
  style,
  variant = 'default',
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded ?? defaultExpanded);
  const rotateAnim = useRef(new Animated.Value((expanded ?? defaultExpanded) ? 1 : 0)).current;
  const heightAnim = useRef(new Animated.Value((expanded ?? defaultExpanded) ? 1 : 0)).current;
  const isVoyage = variant === 'voyage';

  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    setIsExpanded(!isExpanded);
    onPress?.();

    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(heightAnim, {
        toValue,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  return (
    <View
      className={`${isVoyage ? 'mb-2 overflow-hidden rounded-2xl' : 'border-b border-light-secondary dark:border-dark-secondary'} ${className || ''}`}
      style={[isVoyage ? { backgroundColor: PARCHMENT_DEEP } : undefined, style]}>
      <Pressable
        onPress={toggleExpand}
        className={isVoyage ? 'flex-row items-center px-4 py-4' : 'flex-row items-center py-5'}>
        {icon && (
          <View
            className={isVoyage ? 'mr-3 h-9 w-9 items-center justify-center rounded-full' : 'mr-4'}
            style={isVoyage ? { backgroundColor: 'rgba(19,26,42,0.06)' } : undefined}>
            <Icon
              name={icon}
              size={isVoyage ? 15 : 24}
              color={isVoyage ? INK : undefined}
              strokeWidth={isVoyage ? 1.7 : 1.2}
            />
          </View>
        )}
        <View className="flex-1">
          <ThemedText
            className="text-base font-medium"
            style={
              isVoyage
                ? { color: INK, fontFamily: SERIF, fontSize: 15, letterSpacing: -0.1 }
                : undefined
            }>
            {title}
          </ThemedText>
          {description && (
            <ThemedText
              className="text-sm text-light-subtext dark:text-dark-subtext"
              style={
                isVoyage
                  ? {
                      color: INK,
                      opacity: 0.5,
                      fontFamily: SERIF,
                      fontSize: 12,
                      fontStyle: 'italic',
                      marginTop: 1,
                    }
                  : undefined
              }>
              {description}
            </ThemedText>
          )}
        </View>
        <Animated.View
          style={{
            transform: [
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['-90deg', '0deg'],
                }),
              },
            ],
          }}>
          <Icon name="ChevronDown" size={isVoyage ? 14 : 20} color={isVoyage ? INK : undefined} />
        </Animated.View>
      </Pressable>
      <Animated.View
        style={{
          maxHeight: heightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1000],
          }),
          opacity: heightAnim,
          overflow: 'hidden',
        }}>
        <View
          className="px-4 pb-4 pt-4"
          style={isVoyage ? { backgroundColor: PARCHMENT } : undefined}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

export default Expandable;
