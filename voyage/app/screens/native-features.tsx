import { View } from 'react-native';
import Header from '@/components/Header';
import ThemedScroller from '@/components/ThemeScroller';
import Section from '@/components/layout/Section';
import ThemedText from '@/components/ThemedText';

export default function NativeFeaturesFallbackScreen() {
  return (
    <View className="flex-1 bg-light-primary dark:bg-dark-primary">
      <Header showBackButton />
      <ThemedScroller>
        <Section
          title="Native features"
          subtitle="Maps, widgets, notifications, and biometrics are configured for the iOS app build."
          titleSize="3xl"
          className="px-4 pt-4 pb-8"
        />
        <View className="px-4">
          <ThemedText className="text-sm text-light-subtext dark:text-dark-subtext">
            This preview screen is only active on iOS because the underlying feature modules are native-only.
          </ThemedText>
        </View>
      </ThemedScroller>
    </View>
  );
}
