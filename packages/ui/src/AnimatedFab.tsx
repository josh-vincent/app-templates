/**
 * AnimatedFab — expanding floating action button that morphs from a circle
 * into a full-width rounded panel showing children.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind, react-native-reanimated
 * @requires   @jv/ui (Icon), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./AnimatedFab.demo.tsx
 * @donor      fitstake/components/AnimatedFab.tsx
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';
import { styled } from 'nativewind';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Icon, { type IconName } from './Icon';
import { useThemeColors } from './theme/useThemeColors';

const StyledAnimatedView = styled(Animated.View);
const StyledView = styled(View);
const { width: windowWidth } = Dimensions.get('window');

type AnimatedFabProps = {
  icon: IconName;
  children: React.ReactNode;
  position?: 'bottomRight' | 'bottomLeft' | 'topRight' | 'topLeft';
  iconSize?: number;
  backgroundColor?: string;
  iconColor?: string;
  className?: string;
  contentClassName?: string;
  iconClassName?: string;
  style?: ViewStyle;
  onOpen?: () => void;
  onClose?: () => void;
};

const positionClasses: Record<NonNullable<AnimatedFabProps['position']>, string> = {
  bottomRight: 'bottom-4 right-4',
  bottomLeft: 'bottom-4 left-4',
  topRight: 'top-4 right-4',
  topLeft: 'top-4 left-4',
};

const AnimatedFab: React.FC<AnimatedFabProps> = ({
  icon,
  children,
  position = 'bottomRight',
  iconSize = 24,
  iconColor,
  className,
  contentClassName,
  iconClassName,
  onOpen,
  onClose,
  style,
}) => {
  const colors = useThemeColors();
  const [isOpen, setIsOpen] = useState(false);
  const baseSize = iconSize * 2;
  const [contentHeight, setContentHeight] = useState(baseSize * 2);
  const contentMeasureRef = useRef<View>(null);
  const [isContentMeasured, setIsContentMeasured] = useState(false);
  const animation = useSharedValue(0);

  useEffect(() => () => {
    animation.value = 0;
  }, [animation]);

  useEffect(() => {
    animation.value = withTiming(isOpen ? 1 : 0, { duration: 300 });
  }, [colors.isDark, isOpen, animation]);

  useEffect(() => {
    if (contentMeasureRef.current && !isContentMeasured) {
      setTimeout(() => {
        contentMeasureRef.current?.measure((_x, _y, _w, height) => {
          if (height > 0) {
            setContentHeight(Math.max(baseSize, height));
            setIsContentMeasured(true);
          }
        });
      }, 100);
    }
  }, [isContentMeasured, baseSize]);

  const toggleOpen = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    animation.value = withTiming(next ? 1 : 0, { duration: 300 });
    next ? onOpen?.() : onClose?.();
  }, [isOpen, animation, onOpen, onClose]);

  const containerStyle = useAnimatedStyle(() => ({
    width: interpolate(animation.value, [0, 1], [baseSize, windowWidth - 30], Extrapolate.CLAMP),
    height: interpolate(animation.value, [0, 1], [baseSize, contentHeight], Extrapolate.CLAMP),
    borderRadius: interpolate(animation.value, [0, 1], [baseSize / 2, 12], Extrapolate.CLAMP),
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(animation.value, [0, 1], [0, 45], Extrapolate.CLAMP)}deg` }],
    opacity: interpolate(animation.value, [0, 0.5, 1], [1, 0.3, 0], Extrapolate.CLAMP),
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animation.value, [0, 0.7, 1], [0, 0, 1], Extrapolate.CLAMP),
    transform: [{ translateY: interpolate(animation.value, [0, 1], [20, 0], Extrapolate.CLAMP) }],
  }));

  return (
    <>
      <StyledView
        className="absolute opacity-0 pointer-events-none left-[-9999px]"
        style={{ width: windowWidth - 30 }}
        ref={contentMeasureRef}
      >
        <View className="pb-10">{children}</View>
      </StyledView>

      <TouchableWithoutFeedback>
        <StyledAnimatedView
          className={`absolute items-center justify-center z-10 shadow-md shadow-black/30 bg-black dark:bg-white ${positionClasses[position]} ${className ?? ''}`}
          style={[containerStyle]}
        >
          <TouchableWithoutFeedback onPress={toggleOpen}>
            <StyledAnimatedView className={`absolute items-center justify-center z-20 ${iconClassName ?? ''}`} style={[iconAnimatedStyle, style]}>
              <Icon name={icon} size={iconSize} color={iconColor || 'white'} />
            </StyledAnimatedView>
          </TouchableWithoutFeedback>

          <StyledAnimatedView
            className={`absolute w-full h-full p-6 pb-0 items-start justify-start z-10 ${contentClassName ?? ''}`}
            style={[contentAnimatedStyle, style]}
          >
            <Icon name="X" size={24} color="white" className="absolute top-2 right-2 z-50" onPress={toggleOpen} />
            {children}
          </StyledAnimatedView>
        </StyledAnimatedView>
      </TouchableWithoutFeedback>
    </>
  );
};

export default AnimatedFab;
