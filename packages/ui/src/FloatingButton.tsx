/**
 * FloatingButton — bottom-right pill with icon + label, optional animation.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router
 * @requires   @jv/ui (Icon, ThemedText)
 * @platforms  ios, android
 * @demo       ./FloatingButton.demo.tsx
 * @donor      fitstake/components/FloatingButton.tsx
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import Icon, { type IconName } from './Icon';
import ThemedText from './ThemedText';

interface FloatingButtonProps {
  icon: IconName;
  label?: string;
  onPress?: () => void;
  href?: string;
  className?: string;
  bottom?: number;
  right?: number;
  visible?: boolean;
  isAnimated?: boolean;
  style?: ViewStyle;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', zIndex: 1000 },
  button: {
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

const FloatingButton: React.FC<FloatingButtonProps> = ({
  icon,
  label,
  onPress,
  href,
  className = '',
  bottom = 20,
  right = 20,
  visible = true,
  isAnimated = false,
  style,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isAnimated) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: visible ? 0 : 100, useNativeDriver: true, tension: 40, friction: 8 }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [visible, isAnimated, translateY, opacity]);

  const containerStyle: any = isAnimated
    ? { transform: [{ translateY }], opacity }
    : { opacity: visible ? 1 : 0 };

  const buttonContent = (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-highlight px-4 py-3 rounded-full shadow-lg"
      style={[styles.button, style]}
    >
      <Icon name={icon} size={20} color="white" />
      {label ? <ThemedText className="text-white ml-2">{label}</ThemedText> : null}
    </TouchableOpacity>
  );

  return (
    <Animated.View className={className} style={[styles.container, containerStyle, { bottom, right }]}>
      {href ? (
        <Link href={href as any} asChild>
          {buttonContent}
        </Link>
      ) : (
        buttonContent
      )}
    </Animated.View>
  );
};

export default FloatingButton;
