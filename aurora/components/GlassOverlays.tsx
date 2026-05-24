import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { GlassButton, GlassSurface } from './GlassPrimitives';

const SCREEN = Dimensions.get('window');

function useGlass() {
  return Platform.OS === 'ios' && isLiquidGlassAvailable();
}

// ---------- Scrim ----------------------------------------------------------
// Animated dim layer behind every overlay; on iOS we additionally apply a
// translucent BlurView so background content actually frosts when an overlay
// appears.

function Scrim({
  visible,
  onPress,
  intensity = 0.55,
}: {
  visible: boolean;
  onPress?: () => void;
  intensity?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { opacity }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss overlay"
        onPress={onPress}
        style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 18 : 0}
          tint="dark"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: `rgba(6,8,26,${intensity})` },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

// ---------- GlassBottomSheet -----------------------------------------------
// Native-feel bottom sheet with grabber + drag-to-dismiss. Glass surface
// inside a top-rounded container that slides up from the bottom.

export function GlassBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  detent = 0.55,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** 0..1 portion of screen height the sheet occupies */
  detent?: number;
}) {
  const insets = useSafeAreaInsets();
  const sheetHeight = useMemo(() => Math.round(SCREEN.height * detent), [detent]);
  const translateY = useRef(new Animated.Value(sheetHeight)).current;
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : sheetHeight,
      duration: visible ? 320 : 220,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, sheetHeight, translateY]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) drag.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 1.2) {
          onClose();
          Animated.timing(drag, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(drag, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Scrim visible={visible} onPress={onClose} />
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 10,
            height: sheetHeight + 40,
            transform: [{ translateY: Animated.add(translateY, drag) }],
          }}>
          <View
            style={{
              flex: 1,
              borderRadius: 28,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.22)',
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
            }}>
            <GlassFill />
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.4 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View
              {...pan.panHandlers}
              style={{
                alignItems: 'center',
                paddingVertical: 10,
              }}>
              <View
                style={{
                  width: 38,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.45)',
                }}
              />
            </View>
            {(title || subtitle) && (
              <View style={{ paddingHorizontal: 22, paddingBottom: 10 }}>
                {subtitle && (
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 1.4,
                    }}>
                    {subtitle.toUpperCase()}
                  </Text>
                )}
                {title && (
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 24,
                      fontWeight: '700',
                      marginTop: 2,
                    }}>
                    {title}
                  </Text>
                )}
              </View>
            )}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingBottom: insets.bottom + 24,
              }}>
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------- GlassSideDrawer (right) ----------------------------------------
// Right-side drawer that slides in from the right. Independent of the left
// (locations) drawer — used for filters / settings sub-panels.

export function GlassSideDrawer({
  visible,
  onClose,
  title,
  width = 320,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : width,
      duration: visible ? 280 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, width, translateX]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Scrim visible={visible} onPress={onClose} />
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: insets.top + 14,
            bottom: insets.bottom + 14,
            right: 10,
            width,
            transform: [{ translateX }],
          }}>
          <View
            style={{
              flex: 1,
              borderRadius: 28,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.22)',
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 24,
              shadowOffset: { width: -12, height: 0 },
            }}>
            <GlassFill />
            <LinearGradient
              colors={['rgba(123,91,255,0.10)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingTop: 18,
                paddingBottom: 12,
              }}>
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close panel"
                hitSlop={8}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <X size={16} color="#FFFFFF" strokeWidth={2.4} />
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16 }}>
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------- GlassActionSheet -----------------------------------------------
// iOS-style action sheet: list of glass actions stacked at bottom + a
// separate "Cancel" glass pill. Destructive items styled in danger tint.

export type ActionSheetAction = {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  intent?: 'neutral' | 'accent' | 'success' | 'danger';
};

export function GlassActionSheet({
  visible,
  title,
  message,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN.height)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SCREEN.height,
      duration: visible ? 280 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Scrim visible={visible} onPress={onClose} />
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 0,
            paddingBottom: insets.bottom + 4,
            transform: [{ translateY }],
          }}>
          {(title || message) && (
            <View
              style={{
                marginBottom: 8,
                borderRadius: 22,
                overflow: 'hidden',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255,255,255,0.22)',
              }}>
              <GlassFill />
              <View style={{ paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center' }}>
                {title && (
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontWeight: '700',
                      textAlign: 'center',
                    }}>
                    {title}
                  </Text>
                )}
                {message && (
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: 13,
                      marginTop: 6,
                      textAlign: 'center',
                    }}>
                    {message}
                  </Text>
                )}
              </View>
            </View>
          )}
          <View
            style={{
              borderRadius: 22,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.22)',
              marginBottom: 10,
            }}>
            <GlassFill />
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                onPress={() => {
                  onClose();
                  setTimeout(a.onPress, 220);
                }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 16,
                  borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: 'rgba(255,255,255,0.12)',
                  backgroundColor: pressed ? 'rgba(255,255,255,0.10)' : 'transparent',
                })}>
                {a.icon ? <View style={{ marginRight: 10 }}>{a.icon}</View> : null}
                <Text
                  style={{
                    color: a.intent === 'danger' ? '#FF7B9C' : '#FFFFFF',
                    fontSize: 16,
                    fontWeight: a.intent === 'danger' ? '700' : '500',
                  }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <GlassButton label="Cancel" onPress={onClose} intent="neutral" />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------- GlassAlert ------------------------------------------------------
// Centered, modal confirm dialog. Glass card with optional destructive intent.

export function GlassAlert({
  visible,
  title,
  message,
  primaryLabel,
  primaryIntent = 'accent',
  secondaryLabel = 'Cancel',
  onPrimary,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  primaryLabel: string;
  primaryIntent?: 'accent' | 'success' | 'danger';
  secondaryLabel?: string;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: visible ? 1 : 0.92,
        useNativeDriver: true,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 200 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Scrim visible={visible} onPress={onClose} intensity={0.4} />
        <View
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'center', justifyContent: 'center', padding: 32 },
          ]}>
        <Animated.View
          style={{
            opacity,
            transform: [{ scale }],
            width: '100%',
            maxWidth: 360,
            borderRadius: 26,
            overflow: 'hidden',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.24)',
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 12 },
          }}>
          <GlassFill />
          <LinearGradient
            colors={[
              primaryIntent === 'danger' ? 'rgba(255,123,156,0.16)' : 'rgba(123,91,255,0.16)',
              'transparent',
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={{ padding: 22, alignItems: 'center' }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '700',
                textAlign: 'center',
              }}>
              {title}
            </Text>
            {message && (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 14,
                  textAlign: 'center',
                  marginTop: 10,
                  lineHeight: 20,
                }}>
                {message}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' }}>
              <View style={{ flex: 1 }}>
                <GlassButton label={secondaryLabel} onPress={onClose} intent="neutral" />
              </View>
              <View style={{ flex: 1 }}>
                <GlassButton
                  label={primaryLabel}
                  onPress={() => {
                    onClose();
                    setTimeout(onPrimary, 180);
                  }}
                  intent={primaryIntent}
                />
              </View>
            </View>
          </View>
        </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- GlassToast -----------------------------------------------------
// Transient glass pill notification at the top of the screen. Imperatively
// triggered through a context provider.

type ToastShape = { id: number; text: string; intent: 'info' | 'success' | 'danger' };
type ToastContextValue = {
  show: (text: string, intent?: ToastShape['intent']) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function GlassToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastShape | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback(
    (text: string, intent: ToastShape['intent'] = 'info') => {
      setToast({ id: Date.now(), text, intent });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    const dismiss = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setToast(null));
    }, 2400);
    return () => clearTimeout(dismiss);
  }, [toast, translateY, opacity]);

  const tint = useMemo(() => {
    if (!toast) return 'transparent';
    if (toast.intent === 'success') return 'rgba(11,246,160,0.28)';
    if (toast.intent === 'danger') return 'rgba(255,123,156,0.30)';
    return 'rgba(123,91,255,0.30)';
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 14,
            right: 14,
            transform: [{ translateY }],
            opacity,
          }}>
          <View
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.24)',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            }}>
            <GlassFill tintColor={tint} />
            <View
              style={{
                paddingHorizontal: 18,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                {toast.text}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useGlassToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useGlassToast must be used within GlassToastProvider');
  }
  return ctx;
}

// ---------- GlassPopover ---------------------------------------------------
// Anchored info tooltip. Position is supplied (we don't try to measure from
// here — callers know where they want it).

export function GlassPopover({
  visible,
  anchor,
  onClose,
  children,
  width = 240,
}: {
  visible: boolean;
  /** Normalised 0..1 coordinates of the anchor on screen */
  anchor: { x: number; y: number };
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: visible ? 1 : 0.85,
        useNativeDriver: true,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, scale, opacity]);

  if (!visible) return null;

  const left = Math.min(
    Math.max(anchor.x * SCREEN.width - width / 2, 12),
    SCREEN.width - width - 12
  );
  const top = anchor.y * SCREEN.height + 14;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={{
          position: 'absolute',
          top,
          left,
          width,
          opacity,
          transform: [{ scale }],
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255,255,255,0.26)',
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        }}>
        <GlassFill />
        <View style={{ padding: 14 }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

// ---------- GlassFill (private helper) -------------------------------------
// Internal helper that fills its parent with Liquid Glass when available and
// a frosted BlurView otherwise. Keeps overlay components from each
// re-implementing the fork.

function GlassFill({ tintColor }: { tintColor?: string }) {
  if (useGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={tintColor}
        isInteractive
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      {tintColor && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
      )}
    </View>
  );
}

// Re-export to keep imports tidy in callers.
export { GlassButton, GlassSurface };
export type { ViewStyle, GestureResponderEvent };
