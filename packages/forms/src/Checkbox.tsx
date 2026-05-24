/**
 * Checkbox — labeled checkbox with optional error message.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native
 * @requires   @jv/ui (Icon, ThemedText)
 * @platforms  ios, android
 * @demo       ./Checkbox.demo.tsx
 * @donor      fitstake/components/forms/Checkbox.tsx
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { Icon, ThemedText } from '@jv/ui';

interface CheckboxProps {
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  error?: string;
  className?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({ label, checked = false, onChange, error, className = '' }) => {
  const [internalChecked, setInternalChecked] = React.useState(checked);
  const isChecked = onChange ? checked : internalChecked;

  const handlePress = () => {
    if (onChange) onChange(!isChecked);
    else setInternalChecked(!internalChecked);
  };

  return (
    <View className={`mb-global ${className}`}>
      <Pressable onPress={handlePress} className="flex-row items-center">
        <View
          className={`
            w-6 h-6 rounded border flex items-center justify-center
            ${isChecked ? 'border-highlight' : 'border-black/40 dark:border-white/40'}
            ${error ? 'border-red-500' : ''}
          `}
        >
          {isChecked && (
            <View className="w-full h-full bg-highlight rounded border-[2px] border-light-primary dark:border-dark-primary items-center justify-center">
              <Icon name="Check" size={14} color="#fff" />
            </View>
          )}
        </View>
        <ThemedText className="ml-2">{label}</ThemedText>
      </Pressable>
      {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
    </View>
  );
};

export default Checkbox;
