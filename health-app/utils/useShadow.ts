import { Platform, ViewStyle } from 'react-native';

interface ShadowProps {
  elevation?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowRadius?: number;
  shadowOffset?: {
    width: number;
    height: number;
  };
}

/**
 * Hook to generate consistent shadow styles across the app
 * @param options - Shadow configuration options
 * @returns Shadow style object for React Native components
 */
function createShadowStyle(options?: ShadowProps): ViewStyle {
  const {
    elevation = 5,
    shadowColor = '#000',
    shadowOpacity = 0.15,
    shadowRadius = 3.84,
    shadowOffset = {
      width: 0,
      height: 2,
    },
  } = options || {};

  // iOS shadows
  const iosShadow: ViewStyle = {
    shadowColor,
    shadowOpacity,
    shadowRadius,
    shadowOffset,
  };

  // Android elevation
  const androidShadow: ViewStyle = {
    elevation,
  };

  // Return platform-specific shadow styles
  return Platform.OS === 'ios' ? iosShadow : { ...iosShadow, ...androidShadow };
}

export const useShadow = (options?: ShadowProps): ViewStyle => createShadowStyle(options);

/**
 * Preset shadow styles for common use cases
 */
export const shadowPresets = {
  small: createShadowStyle({
    elevation: 3,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 1 },
  }),

  medium: createShadowStyle({
    elevation: 8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  }),

  large: createShadowStyle({
    elevation: 15,
    shadowRadius: 10.84,
    shadowOffset: { width: 0, height: 10 },
  }),

  card: createShadowStyle({
    elevation: 4,
    shadowRadius: 3.84,
    shadowOffset: { width: 0, height: 2 },
  }),
};

export default useShadow;
