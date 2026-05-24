/**
 * ThemeFooter — sticky footer with safe-area bottom inset.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind, react-native-safe-area-context
 * @platforms  ios, android
 * @demo       ./ThemeFooter.demo.tsx
 * @donor      fitstake/components/ThemeFooter.tsx
 */
import React from 'react';
import { View, type ViewProps } from 'react-native';
import { styled } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ThemeFooterProps extends ViewProps {
  children: React.ReactNode;
}

const FooterView = styled(View);

export default function ThemedFooter({ children, className, ...props }: ThemeFooterProps) {
  const insets = useSafeAreaInsets();
  return (
    <FooterView
      style={{ paddingBottom: insets.bottom }}
      className={`bg-light-primary dark:bg-dark-primary px-global pt-global w-full ${className || ''}`}
      {...props}
    >
      {children}
    </FooterView>
  );
}
