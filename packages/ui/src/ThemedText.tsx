/**
 * ThemedText — Text that auto-switches color between dark and light themes.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind
 * @requires   @jv/tokens
 * @platforms  ios, android
 * @a11y       inherits react-native Text a11y props
 * @demo       ./ThemedText.demo.tsx
 * @donor      fitstake/components/ThemedText.tsx
 */
import React from 'react';
import { Text, type TextProps } from 'react-native';
import { styled } from 'nativewind';

interface ThemedTextProps extends TextProps {
  children: React.ReactNode;
}

const StyledText = styled(Text);

export default function ThemedText({ children, className, ...props }: ThemedTextProps) {
  return (
    <StyledText className={`text-black dark:text-white ${className || ''}`} {...props}>
      {children}
    </StyledText>
  );
}
