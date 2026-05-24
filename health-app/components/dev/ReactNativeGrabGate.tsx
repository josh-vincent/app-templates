import { Fragment, type ComponentType, type ReactNode } from 'react';

declare const __DEV__: boolean;
declare const require: (id: string) => {
  ReactNativeGrabRoot?: ComponentType<{ children: ReactNode }>;
  ReactNativeGrabScreen?: ComponentType<{
    children: ReactNode;
    id?: string;
    style?: Record<string, unknown>;
  }>;
  ReactNativeGrabContextProvider?: ComponentType<{
    children: ReactNode;
    value: Record<string, unknown>;
  }>;
  enableGrabbing?: () => void;
};

declare global {
  // Dev-only test hook for Screen Canvas/agent tooling.
  var __screenCanvasEnableGrab: (() => void) | undefined;
}

const enabled =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_REACT_NATIVE_GRAB === 'true';

let GrabRoot: ComponentType<{ children: ReactNode }> | undefined;
let GrabScreen:
  | ComponentType<{
      children: ReactNode;
      id?: string;
      style?: Record<string, unknown>;
    }>
  | undefined;
let GrabContextProvider:
  | ComponentType<{ children: ReactNode; value: Record<string, unknown> }>
  | undefined;
let enableGrabbing: (() => void) | undefined;

if (enabled) {
  try {
    const grab = require('react-native-grab');
    GrabRoot = grab.ReactNativeGrabRoot;
    GrabScreen = grab.ReactNativeGrabScreen;
    GrabContextProvider = grab.ReactNativeGrabContextProvider;
    enableGrabbing = grab.enableGrabbing;
    globalThis.__screenCanvasEnableGrab = enableGrabbing;
  } catch (error) {
    console.warn(
      '[screen-canvas] react-native-grab is enabled but unavailable.',
      error
    );
  }
}

export function ReactNativeGrabGate({ children }: { children: ReactNode }) {
  if (!enabled || !GrabRoot) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <GrabRoot>
      <GrabContext value={{ tool: 'screen-canvas', app: 'healthpulse' }}>
        {children}
      </GrabContext>
    </GrabRoot>
  );
}

export function ReactNativeGrabScreenGate({
  children,
  id,
}: {
  children: ReactNode;
  id: string;
}) {
  if (!enabled || !GrabScreen) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <GrabScreen id={id} style={{ flex: 1 }}>
      <GrabContext value={{ screen: id }}>{children}</GrabContext>
    </GrabScreen>
  );
}

function GrabContext({
  children,
  value,
}: {
  children: ReactNode;
  value: Record<string, unknown>;
}) {
  if (!GrabContextProvider) {
    return <Fragment>{children}</Fragment>;
  }

  return <GrabContextProvider value={value}>{children}</GrabContextProvider>;
}
