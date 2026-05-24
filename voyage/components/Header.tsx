import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ViewStyle,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useThemeColors } from '@/contexts/ThemeColors';
import { SERIF } from '@/lib/theme';
import { Link, router } from 'expo-router';
import Icon, { IconName } from './Icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

type HeaderProps = {
  title?: string;
  children?: React.ReactNode;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponents?: React.ReactNode[];
  backgroundColor?: string;
  textColor?: string;
  leftComponent?: React.ReactNode;
  middleComponent?: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  collapsible?: boolean;
  visible?: boolean;
  variant?: 'default' | 'transparent' | 'blurred' | 'collapsibleTitle';
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollY?: Animated.Value;
};

const Header: React.FC<HeaderProps> = ({
  title,
  children,
  showBackButton = false,
  onBackPress,
  rightComponents = [],
  backgroundColor,
  textColor,
  leftComponent,
  middleComponent,
  className,
  style,
  collapsible = false,
  visible = true,
  variant = 'default',
  onScroll,
  scrollY: externalScrollY,
}) => {
  const colors = useThemeColors();
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Determine if we should use the transparent or blurred variant styling
  const isTransparent = variant === 'transparent';
  const isBlurred = variant === 'blurred';
  const isCollapsibleTitle = variant === 'collapsibleTitle';
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!collapsible) return;

    // When visible, use spring for a nice bounce-in from the top
    if (visible) {
      // First move it up slightly off-screen (if it's not already)
      translateY.setValue(-70);

      // Then spring it back in
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 30, // Higher tension for faster movement
        friction: 50, // Lower friction for slight bounce
        velocity: 3, // Higher initial velocity for more dramatic entrance
      }).start();
    }
    // When hiding, use spring animation to slide up
    else {
      Animated.spring(translateY, {
        toValue: -150,
        useNativeDriver: true,
        tension: 80, // High tension for quick movement
        friction: 12, // Moderate friction for less bounce
        velocity: 2, // Initial velocity for natural feel
      }).start();
    }
  }, [visible, collapsible, translateY]);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const AnimatedView = Animated.createAnimatedComponent(View);

  // Position absolute for collapsible or transparent/blurred variant
  const containerStyle =
    collapsible || isTransparent || isBlurred
      ? {
          transform: collapsible ? [{ translateY }] : undefined,
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }
      : {};

  if (isBlurred) {
    return (
      <BlurView
        intensity={30}
        tint="light"
        style={[style, containerStyle, { paddingTop: insets.top }]}
        className={`z-50 w-full  bg-light-primary/60 px-global pt-4 dark:bg-dark-primary/80 ${className}`}>
        <View className="flex-row justify-between">
          <View className="flex-row items-center">
            {showBackButton && (
              <TouchableOpacity onPress={handleBackPress} className="relative z-50 mr-global">
                <Icon name="ArrowLeft" size={24} color="white" />
              </TouchableOpacity>
            )}

            <View className="relative z-50 flex-row items-center">
              {leftComponent}

              {title && <Text className="text-lg font-bold text-white">{title}</Text>}
            </View>
          </View>

          {middleComponent && (
            <View className="absolute bottom-0 left-0 right-0 top-0 flex-row items-center justify-center">
              {middleComponent}
            </View>
          )}

          <View className="relative z-50 flex-row items-center">
            {rightComponents.map((component, index) => (
              <View key={index} className="ml-6">
                {component}
              </View>
            ))}
          </View>
        </View>
        {children}
      </BlurView>
    );
  }

  if (isTransparent) {
    return (
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={[style, containerStyle, { paddingTop: insets.top }]}
        className={`z-50 w-full px-global pb-10 pt-4 ${className}`}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <View className="flex-row justify-between">
          <View className="flex-row items-center">
            {showBackButton && (
              <TouchableOpacity onPress={handleBackPress} className="relative z-50 mr-global">
                <Icon name="ArrowLeft" size={24} color="white" />
              </TouchableOpacity>
            )}

            <View className="relative z-50 flex-row items-center">
              {leftComponent}

              {title && <Text className="text-lg font-bold text-white">{title}</Text>}
            </View>
          </View>

          {middleComponent && (
            <View className="absolute bottom-0 left-0 right-0 top-0 flex-row items-center justify-center">
              {middleComponent}
            </View>
          )}

          <View className="relative z-50 flex-row items-center">
            {rightComponents.map((component, index) => (
              <View key={index} className="ml-6">
                {component}
              </View>
            ))}
          </View>
        </View>
        {children}
      </LinearGradient>
    );
  }

  if (isCollapsibleTitle) {
    const activeScrollY = externalScrollY || scrollY;
    const titlePaddingBottom = activeScrollY.interpolate({
      inputRange: [0, 0],
      outputRange: [0, 0],
      extrapolate: 'clamp',
    });

    const titlePaddingTop = activeScrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [50, 0],
      extrapolate: 'clamp',
    });

    const titleFontSize = activeScrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [30, 18],
      extrapolate: 'clamp',
    });

    return (
      <View
        style={[style, { paddingTop: insets.top }]}
        className={`w-full bg-light-primary dark:bg-dark-primary ${className}`}>
        <View className="px-global">
          <View className="flex-row items-center justify-between py-4">
            {/* Left side - back button if needed */}
            {(showBackButton || leftComponent || title) && (
              <View className="flex-1 flex-row items-center">
                {showBackButton && (
                  <TouchableOpacity
                    onPress={handleBackPress}
                    className="relative z-50 mr-global py-4">
                    <Icon
                      name="ArrowLeft"
                      size={24}
                      color={isTransparent ? 'white' : colors.icon}
                    />
                  </TouchableOpacity>
                )}

                {leftComponent ||
                  (title && (
                    <View className="relative z-50 flex-row items-center ">
                      {leftComponent}

                      {title && (
                        <Animated.View
                          style={{
                            paddingBottom: titlePaddingBottom,
                            paddingTop: titlePaddingTop,
                          }}>
                          <Animated.Text
                            style={{ fontSize: titleFontSize, fontFamily: SERIF }}
                            className="text-black dark:text-white">
                            {title}
                          </Animated.Text>
                        </Animated.View>
                      )}
                    </View>
                  ))}
              </View>
            )}

            {/* Spacer to push right components to the right */}
            <View className="flex-1" />

            {/* Right components */}
            <View className="flex-row items-center">
              {rightComponents.map((component, index) => (
                <View key={index} className="ml-6">
                  {component}
                </View>
              ))}
            </View>
          </View>
        </View>
        {children}
      </View>
    );
  }

  return (
    <AnimatedView
      style={[
        collapsible ? { paddingTop: insets.top } : { paddingTop: insets.top },
        style,
        containerStyle,
      ]}
      className={`relative z-50 w-full flex-row justify-between bg-light-primary px-global dark:bg-dark-primary ${className}`}>
      {(showBackButton || leftComponent || title) && (
        <View className="flex-row items-center">
          {showBackButton && (
            <TouchableOpacity onPress={handleBackPress} className="relative z-50 mr-global py-4">
              <Icon name="ArrowLeft" size={24} color={isTransparent ? 'white' : colors.icon} />
            </TouchableOpacity>
          )}

          {leftComponent ||
            (title && (
              <View className="relative z-50 flex-row items-center py-4  ">
                {leftComponent}

                {title && (
                  <Text
                    style={{ fontFamily: SERIF, fontSize: 18 }}
                    className="dark:text-white">
                    {title}
                  </Text>
                )}
              </View>
            ))}
        </View>
      )}
      {middleComponent && (
        <View className="flex-1 flex-shrink-0 flex-row items-center justify-center bg-black">
          {middleComponent}
        </View>
      )}

      {rightComponents.length > 0 && (
        <View className="relative z-50 ml-auto flex-row items-center justify-end ">
          {rightComponents.map((component, index) => (
            <View key={index} className="ml-6">
              {component}
            </View>
          ))}
        </View>
      )}
      {children}
    </AnimatedView>
  );
};

export default Header;

type HeaderItemProps = {
  href: string;
  icon: IconName;
  className?: string;
  hasBadge?: boolean;
  onPress?: any;
  isWhite?: boolean;
};

export const HeaderIcon = ({
  href,
  icon,
  hasBadge,
  onPress,
  className = '',
  isWhite = false,
}: HeaderItemProps) => (
  <>
    {onPress ? (
      <TouchableOpacity onPress={onPress} className="mb-2 overflow-visible">
        <View
          className={`relative h-7 w-7 flex-row items-center justify-center overflow-visible ${className}`}>
          {hasBadge && (
            <View className="absolute -right-0 -top-0 z-30 h-4 w-4 rounded-full border-2 border-light-primary bg-red-500 dark:border-dark-primary" />
          )}
          {isWhite ? <Icon name={icon} size={22} color="white" /> : <Icon name={icon} size={22} />}
        </View>
      </TouchableOpacity>
    ) : (
      <Link href={href} asChild>
        <TouchableOpacity className="mb-2 overflow-visible">
          <View
            className={`relative h-7 w-7 flex-row items-center justify-center overflow-visible ${className}`}>
            {hasBadge && (
              <View className="absolute -right-[3px] -top-0 z-30 h-4 w-4 rounded-full border-2 border-light-primary bg-red-500 dark:border-dark-primary" />
            )}
            {isWhite ? (
              <Icon name={icon} size={22} color="white" />
            ) : (
              <Icon name={icon} size={22} />
            )}
          </View>
        </TouchableOpacity>
      </Link>
    )}
  </>
);
