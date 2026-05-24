/**
 * ThemeTabs — segmented horizontal tabs with sticky header, scrollview pager.
 * Use with ThemeTab children declaring each tab's name + body.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (AnimatedView, ThemedText)
 * @platforms  ios, android
 * @demo       ./ThemeTabs.demo.tsx
 * @donor      fitstake/components/ThemeTabs.tsx
 */
import React, { type ReactNode, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, TouchableOpacity, View, type ViewStyle } from 'react-native';
import AnimatedView from './AnimatedView';
import ThemedText from './ThemedText';

type ThemeTabsProps = {
  children: ReactNode;
  headerComponent?: ReactNode;
  footerComponent?: ReactNode;
  type?: 'scrollview' | 'fixed';
  className?: string;
  style?: ViewStyle;
  scrollEnabled?: boolean;
};

type ThemeTabProps = {
  name: string;
  children: ReactNode;
  type?: 'scrollview' | 'flatlist' | 'view';
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ThemeTab: React.FC<ThemeTabProps> = ({ children }) => (
  <View style={{ width: SCREEN_WIDTH, height: '100%' }}>{children}</View>
);

function isThemeTab(child: ReactNode): child is React.ReactElement<ThemeTabProps> {
  return React.isValidElement<ThemeTabProps>(child) && child.type === ThemeTab;
}

const ThemeTabs: React.FC<ThemeTabsProps> = ({
  children,
  headerComponent,
  footerComponent,
  type = 'fixed',
  scrollEnabled = true,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabContentRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const tabs = React.Children.toArray(children).filter(isThemeTab);

  const handleTabPress = (index: number) => {
    setActiveTab(index);
    tabContentRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false });
  const handleScrollEnd = (event: any) => {
    const position = event.nativeEvent.contentOffset.x;
    setActiveTab(Math.round(position / SCREEN_WIDTH));
  };

  const stickyHeaderIndices = headerComponent ? [1] : [0];

  const TabBarItem = ({ tab, index }: { tab: React.ReactElement<ThemeTabProps>; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      className={type === 'scrollview' ? 'relative h-full items-center justify-center px-4' : 'relative flex-1 items-center justify-center px-3'}
      onPress={() => handleTabPress(index)}
    >
      <ThemedText className={`text-base ${activeTab === index ? 'text-highlight' : ''}`}>{tab.props.name}</ThemedText>
      {activeTab === index && <View className="absolute bottom-0 h-[2px] w-full bg-highlight" />}
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary">
      <ScrollView
        ref={mainScrollRef}
        stickyHeaderIndices={stickyHeaderIndices}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        className="flex-1"
      >
        {headerComponent && <View>{headerComponent}</View>}
        <View className="z-10">
          {type === 'scrollview' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="h-[48px] flex-row border-b border-light-secondary bg-light-primary dark:border-white/20 dark:bg-dark-primary"
            >
              {tabs.map((tab, index) => (
                <Animated.View key={index}>
                  <TabBarItem tab={tab} index={index} />
                </Animated.View>
              ))}
            </ScrollView>
          ) : (
            <View className="h-[48px] flex-row border-b border-light-secondary bg-light-primary dark:border-white/20 dark:bg-dark-primary">
              {tabs.map((tab, index) => (
                <Animated.View key={index} className="flex-1">
                  <TabBarItem tab={tab} index={index} />
                </Animated.View>
              ))}
            </View>
          )}
        </View>

        <View className="flex-1">
          {scrollEnabled ? (
            <ScrollView
              ref={tabContentRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleScrollEnd}
              className="flex-1"
              scrollEnabled={scrollEnabled}
            >
              {tabs}
            </ScrollView>
          ) : (
            <AnimatedView key={activeTab} duration={600} animation="fadeIn" className="flex-1" style={{ width: SCREEN_WIDTH }}>
              {tabs[activeTab]}
            </AnimatedView>
          )}
        </View>
        {footerComponent && <View>{footerComponent}</View>}
      </ScrollView>
    </View>
  );
};

export default ThemeTabs;
