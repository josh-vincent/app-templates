import React from 'react';
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  ExpoLiquidGlassView,
  CornerStyle,
  LiquidGlassType,
} from 'expo-liquid-glass-view';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

// All Aurora glass surfaces are powered by expo-liquid-glass-view's SwiftUI
// `.glassEffect()` view on iOS 26+. We render it as an absolute-fill *behind*
// the children so Yoga can measure layout normally — wrapping it around the
// children breaks intrinsic sizing because the native view doesn't propagate
// child measurements back to Yoga.
//
// `expo-glass-effect.isLiquidGlassAvailable` is the runtime gate; when it's
// false (Android, iOS < 26) we fall back to a translucent View.

function useGlassEnabled() {
  return Platform.OS === 'ios' && isLiquidGlassAvailable();
}

// Default dark navy tint applied to the SwiftUI .glassEffect material when no
// explicit tint is supplied. The glass material samples its backdrop *outside*
// its own frame, so a dark View layered inside the card is invisible — only
// tinting the SwiftUI material itself reliably darkens cards over a bright
// sky. Solid hex (no alpha) — SwiftUI blends it with the live refraction.
const DEFAULT_SURFACE_TINT = '#0A0E27';

function resolveType(opts: {
  tint?: string;
  interactive?: boolean;
  variant?: 'regular' | 'clear';
}): { type: LiquidGlassType; tint?: string } {
  // `clear` variant opts out of any tint entirely — used for chrome that
  // should preserve the full refractive look (toolbars over hero).
  if (opts.variant === 'clear') {
    return { type: LiquidGlassType.Clear };
  }
  const tint = opts.tint ?? DEFAULT_SURFACE_TINT;
  if (opts.interactive) {
    return { type: LiquidGlassType.Interactive, tint };
  }
  return { type: LiquidGlassType.Tint, tint };
}

// ---------- GlassSurface ----------------------------------------------------
// Outer View measures with its children (Yoga). The native Liquid Glass view
// sits absolute-filled behind everything, clipped by the outer borderRadius.
// `baseTint` is a low-opacity dark backdrop that gives text on bright skies a
// fighting chance — when no `tintColor` is supplied the glass alone is too
// transparent to be readable.

export function GlassSurface({
  children,
  style,
  tintColor,
  baseTint = 'rgba(10,14,39,0.82)',
  fallbackColor = 'rgba(255,255,255,0.12)',
  borderColor = 'rgba(255,255,255,0.18)',
  borderWidth = 1,
  highlight = true,
  radius = 22,
  interactive = false,
  cornerStyle = 'continuous',
  variant = 'regular',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
  baseTint?: string;
  fallbackColor?: string;
  borderColor?: string;
  borderWidth?: number;
  highlight?: boolean;
  radius?: number;
  interactive?: boolean;
  cornerStyle?: 'continuous' | 'circular';
  variant?: 'regular' | 'clear';
}) {
  const useGlass = useGlassEnabled();
  const corners =
    cornerStyle === 'circular' ? CornerStyle.Circular : CornerStyle.Continuous;
  const { type, tint } = resolveType({ tint: tintColor, interactive, variant });

  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth,
          borderColor,
        },
        style,
      ]}>
      {/* Dark base tint so text stays legible over bright skies. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tintColor ?? baseTint },
        ]}
      />
      {useGlass ? (
        <ExpoLiquidGlassView
          type={type}
          tint={tint}
          cornerRadius={radius}
          cornerStyle={corners}
          isInteractive={interactive}
          style={StyleSheet.absoluteFill}>
          {/* Empty children would trigger the package's 100×100 fallback
              (ExpoLiquidGlassView.swift else-branch). A transparent flex:1
              child forces the `hasChildren=true` path so .glassEffect()
              applies to the full-size frame. */}
          <View pointerEvents="none" style={{ flex: 1 }} />
        </ExpoLiquidGlassView>
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: fallbackColor },
          ]}
        />
      )}
      {highlight && <HighlightStripe />}
      {children}
    </View>
  );
}

function HighlightStripe() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.22)',
      }}
    />
  );
}

// ---------- GlassButton -----------------------------------------------------

type ButtonIntent = 'neutral' | 'accent' | 'success' | 'danger';

const INTENT_TINTS: Record<ButtonIntent, { tint?: string; fg: string }> = {
  neutral: { tint: undefined, fg: '#FFFFFF' },
  accent: { tint: '#7B5BFF', fg: '#FFFFFF' },
  success: { tint: '#0BF6A0', fg: '#06301F' },
  danger: { tint: '#FF7B9C', fg: '#FFFFFF' },
};

export function GlassButton({
  label,
  onPress,
  icon,
  intent = 'neutral',
  disabled,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  intent?: ButtonIntent;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { tint, fg } = INTENT_TINTS[intent];
  return (
    <GlassSurface
      tintColor={disabled ? undefined : tint}
      radius={18}
      borderColor="rgba(255,255,255,0.16)"
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
      interactive>
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 16,
          paddingHorizontal: 18,
          backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
        })}>
        {icon ? <View style={{ marginRight: 10 }}>{icon}</View> : null}
        <Text
          style={{
            color: fg,
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: 0.2,
          }}>
          {label}
        </Text>
      </Pressable>
    </GlassSurface>
  );
}

// ---------- GlassIconButton -------------------------------------------------

export function GlassIconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 40,
  style,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <GlassSurface
      radius={size / 2}
      cornerStyle="circular"
      borderColor="rgba(255,255,255,0.22)"
      highlight={false}
      style={[{ width: size, height: size }, style]}
      interactive>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        style={({ pressed }) => ({
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? 'rgba(255,255,255,0.10)' : 'transparent',
        })}>
        {icon}
      </Pressable>
    </GlassSurface>
  );
}

// ---------- GlassToolbar ----------------------------------------------------

export function GlassToolbar({
  left,
  center,
  right,
  style,
}: {
  left?: React.ReactNode;
  center: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        },
        style,
      ]}>
      {left ?? <View style={{ width: 40 }} />}
      <View style={{ flex: 1 }}>{center}</View>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}
