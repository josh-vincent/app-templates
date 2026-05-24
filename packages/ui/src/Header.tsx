/**
 * Header — page header with 4 variants (default / transparent / blurred / collapsibleTitle).
 * Supports back button, left/middle slot, multiple right components, optional collapse anim.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router, expo-blur, expo-linear-gradient, react-native-safe-area-context
 * @requires   @jv/ui (Icon), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./Header.demo.tsx
 * @donor      fitstake/components/Header.tsx
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Link, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from './Icon';
import { useThemeColors } from './theme/useThemeColors';

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
  leftComponent,
  middleComponent,
  className = '',
  style,
  collapsible = false,
  visible = true,
  variant = 'default',
  scrollY: externalScrollY,
}) => {
  const colors = useThemeColors();
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const isTransparent = variant === 'transparent';
  const isBlurred = variant === 'blurred';
  const isCollapsibleTitle = variant === 'collapsibleTitle';

  useEffect(() => {
    if (!collapsible) return;
    if (visible) {
      translateY.setValue(-70);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 30, friction: 50, velocity: 3 }).start();
    } else {
      Animated.spring(translateY, { toValue: -150, useNativeDriver: true, tension: 80, friction: 12, velocity: 2 }).start();
    }
  }, [visible, collapsible, translateY]);

  const handleBackPress = () => (onBackPress ? onBackPress() : router.back());

  const containerStyle: ViewStyle =
    collapsible || isTransparent || isBlurred
      ? {
          transform: collapsible ? [{ translateY }] : undefined,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }
      : {};

  const RightSlot = () => (
    <View className="relative z-50 flex-row items-center">
      {rightComponents.map((c, i) => (
        <View key={i} className="ml-6">
          {c}
        </View>
      ))}
    </View>
  );

  if (isBlurred) {
    return (
      <BlurView
        intensity={30}
        tint="light"
        style={[style, containerStyle, { paddingTop: insets.top }]}
        className={`z-50 w-full bg-light-primary/60 px-global pt-4 dark:bg-dark-primary/80 ${className}`}
      >
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
          <RightSlot />
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
        end={{ x: 0, y: 1 }}
      >
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
          <RightSlot />
        </View>
        {children}
      </LinearGradient>
    );
  }

  if (isCollapsibleTitle) {
    const activeScrollY = externalScrollY || scrollY;
    const titlePaddingTop = activeScrollY.interpolate({ inputRange: [0, 100], outputRange: [50, 0], extrapolate: 'clamp' });
    const titleFontSize = activeScrollY.interpolate({ inputRange: [0, 100], outputRange: [30, 18], extrapolate: 'clamp' });

    return (
      <View style={[style, { paddingTop: insets.top }]} className={`w-full bg-light-primary dark:bg-dark-primary ${className}`}>
        <View className="px-global">
          <View className="flex-row items-center justify-between py-4">
            {(showBackButton || leftComponent || title) && (
              <View className="flex-1 flex-row items-center">
                {showBackButton && (
                  <TouchableOpacity onPress={handleBackPress} className="relative z-50 mr-global py-4">
                    <Icon name="ArrowLeft" size={24} color={colors.icon} />
                  </TouchableOpacity>
                )}
                {leftComponent}
                {title && (
                  <Animated.View style={{ paddingTop: titlePaddingTop }}>
                    <Animated.Text style={{ fontSize: titleFontSize }} className="font-semibold text-black dark:text-white">
                      {title}
                    </Animated.Text>
                  </Animated.View>
                )}
              </View>
            )}
            <View className="flex-1" />
            <RightSlot />
          </View>
        </View>
        {children}
      </View>
    );
  }

  // default
  return (
    <Animated.View
      style={[{ paddingTop: insets.top }, style, containerStyle]}
      className={`relative z-50 w-full flex-row justify-between bg-light-primary px-global dark:bg-dark-primary ${className}`}
    >
      {(showBackButton || leftComponent || title) && (
        <View className="flex-row items-center">
          {showBackButton && (
            <TouchableOpacity onPress={handleBackPress} className="relative z-50 mr-global py-4">
              <Icon name="ArrowLeft" size={24} color={colors.icon} />
            </TouchableOpacity>
          )}
          {leftComponent}
          {title && (
            <View className="relative z-50 flex-row items-center py-4">
              <Text className="text-lg font-bold dark:text-white">{title}</Text>
            </View>
          )}
        </View>
      )}
      {middleComponent && (
        <View className="flex-1 flex-shrink-0 flex-row items-center justify-center">{middleComponent}</View>
      )}
      {rightComponents.length > 0 && (
        <View className="relative z-50 ml-auto flex-row items-center justify-end">
          {rightComponents.map((c, i) => (
            <View key={i} className="ml-6">
              {c}
            </View>
          ))}
        </View>
      )}
      {children}
    </Animated.View>
  );
};

export default Header;

type HeaderIconProps = {
  href?: string;
  icon: IconName;
  className?: string;
  hasBadge?: boolean;
  onPress?: () => void;
  isWhite?: boolean;
};

export const HeaderIcon = ({ href, icon, hasBadge, onPress, className = '', isWhite = false }: HeaderIconProps) => {
  const content = (
    <View className={`relative h-7 w-7 flex-row items-center justify-center overflow-visible ${className}`}>
      {hasBadge && (
        <View className="absolute -right-0 -top-0 z-30 h-4 w-4 rounded-full border-2 border-light-primary bg-red-500 dark:border-dark-primary" />
      )}
      <Icon name={icon} size={22} color={isWhite ? 'white' : undefined} />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} className="mb-2 overflow-visible">
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <Link href={(href || '#') as any} asChild>
      <TouchableOpacity className="mb-2 overflow-visible">{content}</TouchableOpacity>
    </Link>
  );
};
