/**
 * Slider — pan + tap slider with min/max/step and three sizes.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, react-native-gesture-handler, react-native-reanimated
 * @requires   @jv/ui (ThemedText), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Slider.demo.tsx
 * @donor      fitstake/components/forms/Slider.tsx
 */
import React, { useCallback, useEffect } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import {
  type HandlerStateChangeEvent,
  PanGestureHandler,
  type PanGestureHandlerGestureEvent,
  State,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ThemedText, useThemeColors } from '@jv/ui';

type SliderSize = 's' | 'm' | 'l';

interface SliderProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  value?: number;
  initialValue?: number;
  onValueChange?: (value: number) => void;
  label?: string;
  maxValue?: number;
  minValue?: number;
  step?: number;
  size?: SliderSize;
}

const sizeStyles: Record<SliderSize, { containerHeight: number; labelText: string; valueText: string; trackHeight: number; thumbSize: number }> = {
  s: { containerHeight: 20, labelText: 'text-xs', valueText: 'text-xs', trackHeight: 4, thumbSize: 16 },
  m: { containerHeight: 30, labelText: 'text-sm', valueText: 'text-sm', trackHeight: 6, thumbSize: 20 },
  l: { containerHeight: 40, labelText: 'text-base', valueText: 'text-base', trackHeight: 8, thumbSize: 24 },
};

const Slider = ({
  className = '',
  style,
  value,
  initialValue,
  onValueChange,
  label,
  maxValue = 100,
  minValue = 0,
  step = 1,
  size = 'm',
}: SliderProps) => {
  const colors = useThemeColors();
  const currentSize = sizeStyles[size];
  const effectiveInitialValue = initialValue !== undefined ? initialValue : 0;
  const effectiveValue = value !== undefined ? value : effectiveInitialValue;

  const containerWidth = useSharedValue(0);
  const percentage = useSharedValue(
    maxValue === minValue ? 0 : Math.max(0, Math.min(1, (effectiveValue - minValue) / (maxValue - minValue)))
  );
  const panStartPercentage = useSharedValue(percentage.value);

  const displayValue = useDerivedValue(() => minValue + percentage.value * (maxValue - minValue));

  useEffect(() => {
    if (value === undefined || maxValue === minValue) return;
    const newPercentage = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    percentage.value = withTiming(newPercentage, { duration: 100 });
  }, [value, minValue, maxValue, percentage]);

  const thumbPosition = useDerivedValue(() => {
    const r = currentSize.thumbSize / 2;
    return percentage.value * (containerWidth.value - currentSize.thumbSize) + r;
  });
  const trackWidth = useDerivedValue(
    () => percentage.value * (containerWidth.value - currentSize.thumbSize) + currentSize.thumbSize / 2
  );

  const calculateValueFromTap = (x: number) => {
    const usable = containerWidth.value - currentSize.thumbSize;
    if (usable <= 0) return;
    let p = Math.max(0, Math.min(1, (x - currentSize.thumbSize / 2) / usable));
    const raw = minValue + p * (maxValue - minValue);
    let stepped: number;
    if (step > 0) {
      stepped = Math.min(Math.max(Math.round((raw - minValue) / step) * step + minValue, minValue), maxValue);
      p = (stepped - minValue) / (maxValue - minValue);
    } else {
      stepped = raw;
    }
    percentage.value = withTiming(p, { duration: 150 });
    onValueChange?.(stepped);
  };

  const applyGestureValue = useCallback(
    (translationX: number) => {
      const usable = containerWidth.value - currentSize.thumbSize;
      if (usable <= 0) return;
      let p = panStartPercentage.value + translationX / usable;
      p = Math.min(Math.max(p, 0), 1);
      const raw = minValue + p * (maxValue - minValue);
      let stepped: number;
      if (step > 0) {
        stepped = Math.min(Math.max(Math.round((raw - minValue) / step) * step + minValue, minValue), maxValue);
        p = (stepped - minValue) / (maxValue - minValue);
      } else {
        stepped = raw;
      }
      percentage.value = p;
      if (onValueChange) runOnJS(onValueChange)(stepped);
    },
    [containerWidth, currentSize.thumbSize, maxValue, minValue, onValueChange, panStartPercentage, percentage, step]
  );

  const handlePanGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => applyGestureValue(event.nativeEvent.translationX),
    [applyGestureValue]
  );

  const handlePanStateChange = useCallback(
    (event: HandlerStateChangeEvent<Record<string, unknown>>) => {
      const s = event.nativeEvent.state;
      if (s === State.BEGAN || s === State.END || s === State.CANCELLED || s === State.FAILED) {
        panStartPercentage.value = percentage.value;
      }
    },
    [panStartPercentage, percentage]
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbPosition.value - currentSize.thumbSize / 2 }],
  }));
  const activeTrackStyle = useAnimatedStyle(() => ({ width: trackWidth.value }));

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      if (width <= 0) return;
      containerWidth.value = width;
      if (maxValue !== minValue) {
        const v = value !== undefined ? value : initialValue !== undefined ? initialValue : 0;
        percentage.value = Math.max(0, Math.min(1, (v - minValue) / (maxValue - minValue)));
      }
    },
    [containerWidth, value, initialValue, minValue, maxValue, percentage]
  );

  const formatValue = useDerivedValue(() => {
    const dp = step >= 1 ? 0 : String(step).split('.')[1]?.length || 0;
    return displayValue.value.toFixed(dp);
  });

  const handleTapGesture = useCallback(
    (event: { nativeEvent: { x: number } }) => calculateValueFromTap(event.nativeEvent.x),
    [calculateValueFromTap]
  );

  return (
    <View className={`w-full ${className}`} style={style}>
      {label && (
        <View className="mb-2 flex-row justify-between">
          <ThemedText className={currentSize.labelText}>{label}</ThemedText>
          <Animated.Text className={`text-light-text dark:text-dark-text ${currentSize.valueText}`}>{formatValue.value}</Animated.Text>
        </View>
      )}
      <View style={{ height: currentSize.containerHeight }} className="justify-center" onLayout={onLayout}>
        <TapGestureHandler onHandlerStateChange={handleTapGesture as any}>
          <Animated.View className="h-full w-full justify-center">
            <View
              style={{
                position: 'absolute',
                height: currentSize.trackHeight,
                backgroundColor: colors.secondary,
                borderRadius: currentSize.trackHeight / 2,
                width: '100%',
              }}
            />
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  height: currentSize.trackHeight,
                  backgroundColor: colors.highlight,
                  borderRadius: currentSize.trackHeight / 2,
                },
                activeTrackStyle,
              ]}
            />
            <PanGestureHandler onGestureEvent={handlePanGestureEvent} onHandlerStateChange={handlePanStateChange}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: currentSize.thumbSize,
                    height: currentSize.thumbSize,
                    borderRadius: currentSize.thumbSize / 2,
                    backgroundColor: colors.highlight,
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 3,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 3,
                    zIndex: 10,
                  },
                  thumbStyle,
                ]}
              />
            </PanGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </View>
    </View>
  );
};

export default Slider;
