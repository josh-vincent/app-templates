/**
 * MultiStep — wizard host that walks children Step components with header,
 * progress indicators, and Next/Complete CTA.
 *
 * @package    @jv/ui
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, expo-router, react-native-safe-area-context
 * @requires   @jv/ui (Header, Button, Icon, ThemedText)
 * @platforms  ios, android
 * @demo       ./MultiStep.demo.tsx
 * @donor      fitstake/components/MultiStep.tsx
 */
import React, {
  Children,
  isValidElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from './Header';
import { Button } from './Button';
import ThemedText from './ThemedText';
import Icon from './Icon';

export interface StepProps {
  title: string;
  optional?: boolean;
  children: ReactNode;
}

export const Step: React.FC<StepProps> = ({ children }) => <>{children}</>;

const isStepComponent = (child: unknown): child is React.ReactElement<StepProps> =>
  isValidElement(child) && (child.type === Step || (typeof child.type === 'function' && (child.type as any).name === 'Step'));

interface StepData {
  key: string;
  title: string;
  optional?: boolean;
  component: ReactNode;
}

interface MultiStepProps {
  children: ReactNode;
  onComplete: () => void;
  onClose?: () => void;
  showHeader?: boolean;
  showStepIndicator?: boolean;
  className?: string;
  onStepChange?: (nextStep: number) => boolean;
}

export default function MultiStep({
  children,
  onComplete,
  onClose,
  showHeader = true,
  showStepIndicator = true,
  className = '',
  onStepChange,
}: MultiStepProps) {
  const validChildren = Children.toArray(children).filter(isStepComponent);

  const steps: StepData[] = validChildren.map((child, index) => {
    const { title, optional, children: stepContent } = (child as React.ReactElement<StepProps>).props;
    return {
      key: `step-${index}`,
      title: title || `Step ${index + 1}`,
      optional,
      component: stepContent,
    };
  });

  if (steps.length === 0) {
    steps.push({
      key: 'empty-step',
      title: 'Empty',
      component: (
        <View>
          <ThemedText>No steps provided</ThemedText>
        </View>
      ),
    });
  }

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex]!;
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnims = useRef(steps.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    steps.forEach((_, index) => {
      Animated.timing(progressAnims[index]!, {
        toValue: index <= currentStepIndex ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }, [currentStepIndex, fadeAnim, slideAnim, progressAnims, steps]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      const next = currentStepIndex + 1;
      const canProceed = onStepChange ? onStepChange(next) : true;
      if (canProceed) setCurrentStepIndex(next);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) setCurrentStepIndex(currentStepIndex - 1);
  };

  const handleSkip = () => {
    if (currentStep.optional && !isLastStep) setCurrentStepIndex(currentStepIndex + 1);
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingBottom: insets.bottom }} className={`flex-1 bg-light-primary dark:bg-dark-primary ${className}`}>
      {showHeader && (
        <Header
          rightComponents={[
            onClose ? (
              <Pressable
                key="close"
                onPress={() => router.back()}
                className="rounded-full p-2 active:bg-light-secondary active:dark:bg-dark-secondary"
                hitSlop={8}
              >
                <Icon name="X" size={24} />
              </Pressable>
            ) : undefined,
          ]}
          leftComponent={
            <View className="flex-row items-center">
              {currentStep.optional && !isLastStep && (
                <Button key="skip" title="Skip" variant="ghost" onPress={handleSkip} size="small" />
              )}
              {!isFirstStep && <Icon name="ArrowLeft" key="back" size={24} onPress={handleBack} />}
            </View>
          }
        />
      )}

      <Animated.View className="flex-1" style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {currentStep.component}
        </ScrollView>
      </Animated.View>

      {showStepIndicator && (
        <View className="flex-row justify-center px-4 py-3">
          {steps.map((_, index) => (
            <Animated.View
              key={index}
              className="mx-1 h-1 flex-1 overflow-hidden rounded-full bg-neutral-500 dark:bg-dark-secondary"
              style={{ width: 20, opacity: index === currentStepIndex ? 1 : 0.5 }}
            >
              <Animated.View
                className="bg-highlight h-full"
                style={{
                  width: progressAnims[index]!.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </Animated.View>
          ))}
        </View>
      )}

      <View className="border-t border-light-secondary px-4 py-3 dark:border-dark-secondary">
        <Button title={isLastStep ? 'Complete' : 'Next'} onPress={handleNext} className="w-full" size="large" textClassName="text-white" />
      </View>
    </View>
  );
}
