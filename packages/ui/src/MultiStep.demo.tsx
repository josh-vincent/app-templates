import React from 'react';
import { View } from 'react-native';
import MultiStep, { Step } from './MultiStep';
import ThemedText from './ThemedText';

export const meta = {
  title: 'MultiStep',
  description: 'Wizard host with progress indicators + Next/Complete CTA.',
  variants: ['three-step'],
};

export default function MultiStepDemo() {
  return (
    <MultiStep onComplete={() => undefined}>
      <Step title="Welcome">
        <View className="p-global">
          <ThemedText className="text-2xl font-bold">Welcome</ThemedText>
          <ThemedText className="opacity-60 mt-2">Step 1 content.</ThemedText>
        </View>
      </Step>
      <Step title="Profile" optional>
        <View className="p-global">
          <ThemedText className="text-2xl font-bold">Profile</ThemedText>
          <ThemedText className="opacity-60 mt-2">Step 2 (optional). You can skip.</ThemedText>
        </View>
      </Step>
      <Step title="Finish">
        <View className="p-global">
          <ThemedText className="text-2xl font-bold">All done</ThemedText>
          <ThemedText className="opacity-60 mt-2">Last step before Complete.</ThemedText>
        </View>
      </Step>
    </MultiStep>
  );
}
