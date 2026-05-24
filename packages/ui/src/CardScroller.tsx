/**
 * CardScroller — horizontal scroll row with optional title + "See all" link.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router
 * @requires   @jv/ui (ThemedText)
 * @platforms  ios, android
 * @demo       ./CardScroller.demo.tsx
 * @donor      fitstake/components/CardScroller.tsx
 */
import React from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import ThemedText from './ThemedText';

interface CardScrollerProps {
  title?: string;
  img?: string;
  allUrl?: string;
  children: React.ReactNode;
  enableSnapping?: boolean;
  snapInterval?: number;
  className?: string;
  style?: ViewStyle;
  space?: number;
}

export const CardScroller = ({
  title,
  allUrl,
  children,
  enableSnapping = false,
  snapInterval = 0,
  className,
  style,
  space = 10,
}: CardScrollerProps) => (
  <View className={`w-full flex flex-col ${title ? 'pt-global' : 'pt-0'} ${className ?? ''}`} style={style}>
    <View className={`w-full flex flex-row justify-between items-center ${title ? 'mb-2' : 'mb-0'}`}>
      {title && <ThemedText className="text-base dark:text-white font-bold">{title}</ThemedText>}
      {allUrl && (
        <View className="flex flex-col">
          <Link href={allUrl as any} className="dark:text-white">
            See all
          </Link>
          <View className="h-px w-full bg-black dark:bg-white mt-[1px]" />
        </View>
      )}
    </View>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToAlignment="center"
      decelerationRate={enableSnapping ? 0.85 : 'normal'}
      snapToInterval={enableSnapping ? snapInterval : undefined}
      className="-mx-global px-global"
      contentContainerStyle={{ columnGap: space }}
      style={style}
    >
      {children}
      <View className="w-4 h-px" />
    </ScrollView>
  </View>
);

export default CardScroller;
