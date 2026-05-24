/**
 * ThemeScroller — themed ScrollView with default page inset + optional header space.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind
 * @platforms  ios, android
 * @demo       ./ThemeScroller.demo.tsx
 * @donor      fitstake/components/ThemeScroller.tsx
 */
import React from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, type ScrollViewProps, View } from 'react-native';
import { styled } from 'nativewind';

interface ThemeScrollerProps extends ScrollViewProps {
  children: React.ReactNode;
  onScroll?: ((event: NativeSyntheticEvent<NativeScrollEvent>) => void) | any;
  contentContainerStyle?: any;
  scrollEventThrottle?: number;
  headerSpace?: boolean;
}

const StyledScrollView = styled(ScrollView);

export default function ThemedScroller({
  children,
  className,
  onScroll,
  contentContainerStyle,
  scrollEventThrottle = 16,
  headerSpace = false,
  ...props
}: ThemeScrollerProps) {
  return (
    <StyledScrollView
      showsVerticalScrollIndicator={false}
      style={{ width: '100%' }}
      overScrollMode="never"
      className={`bg-light-primary dark:bg-dark-primary flex-1 px-global ${className || ''}`}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      contentContainerStyle={[headerSpace && { paddingTop: 70 }, contentContainerStyle]}
      {...props}
    >
      {children}
      <View className="h-20 w-full" />
    </StyledScrollView>
  );
}

export const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
