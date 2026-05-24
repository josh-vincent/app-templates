import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-light-primary dark:bg-dark-primary"
      style={{ paddingTop: insets.top }}>
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </View>
    </View>
  );
}
