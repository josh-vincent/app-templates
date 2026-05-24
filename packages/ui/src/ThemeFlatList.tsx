/**
 * ThemeFlatList — themed FlatList wrapper with default page inset + hidden scrollbar.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, nativewind
 * @platforms  ios, android
 * @demo       ./ThemeFlatList.demo.tsx
 * @donor      fitstake/components/ThemeFlatList.tsx
 */
import React, { forwardRef } from 'react';
import { FlatList, type FlatListProps } from 'react-native';
import { styled } from 'nativewind';

const StyledFlatList = styled(FlatList);

export type ThemedFlatListProps<T> = FlatListProps<T> & { className?: string };

function ThemedFlatListInner<T>({ className, ...props }: ThemedFlatListProps<T>, ref: React.Ref<FlatList<T>>) {
  const Cmp = StyledFlatList as any;
  return (
    <Cmp
      bounces
      overScrollMode="never"
      ref={ref}
      showsVerticalScrollIndicator={false}
      className={`bg-light-primary dark:bg-dark-primary flex-1 px-global ${className || ''}`}
      {...props}
    />
  );
}

const ThemedFlatList = forwardRef(ThemedFlatListInner) as <T>(
  props: ThemedFlatListProps<T> & { ref?: React.Ref<FlatList<T>> }
) => React.ReactElement;

export default ThemedFlatList;
