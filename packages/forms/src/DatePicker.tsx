/**
 * DatePicker — themed date picker with animated/classic/underlined variants.
 * iOS: full modal sheet with Cancel/Done. Android: native DateTimePicker.
 *
 * @package    @jv/forms
 * @since      0.1.0
 * @stability  stable
 * @peerDeps   react, react-native, react-native-modal, @react-native-community/datetimepicker
 * @requires   @jv/ui (Icon, ThemedText, Button), @jv/ui/theme
 * @platforms  ios, android
 * @demo       ./DatePicker.demo.tsx
 * @donor      fitstake/components/forms/DatePicker.tsx
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, TouchableOpacity, View } from 'react-native';
import Modal from 'react-native-modal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Icon, ThemedText, useThemeColors } from '@jv/ui';
import { formatToYYYYMMDD } from './utils/date';
import type { InputVariant } from './Input';

interface DatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
  maxDate?: Date;
  minDate?: Date;
  error?: string;
  containerClassName?: string;
  variant?: InputVariant;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'Select date',
  maxDate,
  minDate,
  error,
  containerClassName = '',
  variant = 'animated',
}) => {
  const [visible, setVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value || new Date());
  const [isFocused, setIsFocused] = useState(false);
  const colors = useThemeColors();
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (variant !== 'classic') {
      Animated.timing(labelAnim, { toValue: isFocused || value ? 1 : 0, duration: 200, useNativeDriver: false }).start();
    }
  }, [isFocused, value, labelAnim, variant]);

  const labelStyle = {
    top: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [16, -8] }),
    fontSize: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    color: labelAnim.interpolate({ inputRange: [0, 1], outputRange: [colors.placeholder, colors.text] }),
    left: 12,
    paddingHorizontal: 8,
  };
  const ulLabelStyle = { ...labelStyle, left: 0, paddingHorizontal: 0 };

  const show = () => {
    setIsFocused(true);
    setVisible(true);
  };
  const hide = () => {
    setIsFocused(false);
    setVisible(false);
  };

  const handleChange = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      hide();
      if (selected) onChange(selected);
    } else if (selected) {
      setTempDate(selected);
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    hide();
  };

  const picker =
    Platform.OS === 'ios' ? (
      <Modal isVisible={visible} onBackdropPress={hide} style={{ margin: 0, justifyContent: 'flex-end' }}>
        <View className="bg-light-primary dark:bg-dark-primary rounded-t-xl items-center justify-center w-full">
          <View className="flex-row justify-between items-center p-4 border-b border-light-secondary dark:border-dark-secondary w-full">
            <Button title="Cancel" variant="ghost" onPress={hide} textClassName="text-base font-normal" />
            <ThemedText className="text-lg font-medium">{label || 'Select Date'}</ThemedText>
            <Button title="Done" variant="ghost" onPress={handleConfirm} textClassName="text-base font-semibold" />
          </View>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            onChange={handleChange}
            maximumDate={maxDate}
            minimumDate={minDate}
            themeVariant={colors.isDark ? 'dark' : 'light'}
            style={{ backgroundColor: colors.bg }}
          />
        </View>
      </Modal>
    ) : (
      visible && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display="default"
          onChange={handleChange}
          maximumDate={maxDate}
          minimumDate={minDate}
        />
      )
    );

  if (variant === 'classic') {
    return (
      <View className={`mb-global ${containerClassName}`}>
        {label && <ThemedText className="mb-1 font-medium">{label}</ThemedText>}
        <View className="relative">
          <TouchableOpacity
            onPress={show}
            className={`border rounded-lg py-4 px-3 h-14 pr-10 bg-transparent ${isFocused ? 'border-black dark:border-white' : 'border-black/60 dark:border-white/60'} ${error ? 'border-red-500' : ''}`}
          >
            <ThemedText className={value ? 'text-base' : 'text-base text-gray-500'}>
              {value ? formatToYYYYMMDD(value) : placeholder}
            </ThemedText>
          </TouchableOpacity>
          <Pressable className="absolute right-3 top-[18px] z-10">
            <Icon name="Calendar" size={20} color={colors.text} />
          </Pressable>
        </View>
        {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
        {picker}
      </View>
    );
  }

  if (variant === 'underlined') {
    return (
      <View className={`mb-global ${containerClassName}`}>
        <View className="relative">
          <Pressable className="px-0 bg-light-primary dark:bg-dark-primary z-40" onPress={show}>
            <Animated.Text style={ulLabelStyle} className="absolute z-50 bg-light-primary dark:bg-dark-primary text-black dark:text-white">
              {label}
            </Animated.Text>
          </Pressable>
          <TouchableOpacity
            onPress={show}
            className={`border-b-2 py-4 px-0 h-14 pr-10 bg-transparent border-t-0 border-l-0 border-r-0 ${isFocused ? 'border-black dark:border-white' : 'border-black/60 dark:border-white/60'} ${error ? 'border-red-500' : ''}`}
          >
            <ThemedText className={value ? 'text-base' : 'text-base text-gray-500'}>
              {value ? formatToYYYYMMDD(value) : ''}
            </ThemedText>
          </TouchableOpacity>
          <Pressable className="absolute right-0 top-[18px] z-10">
            <Icon name="Calendar" size={20} color={colors.text} />
          </Pressable>
        </View>
        {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
        {picker}
      </View>
    );
  }

  return (
    <View className={`mb-global ${containerClassName}`}>
      <View className="relative">
        <Pressable className="px-1 bg-light-primary dark:bg-dark-primary z-40" onPress={show}>
          <Animated.Text style={labelStyle} className="absolute z-50 px-1 bg-light-primary dark:bg-dark-primary text-black dark:text-white">
            {label}
          </Animated.Text>
        </Pressable>
        <TouchableOpacity
          onPress={show}
          className={`border rounded-lg py-4 px-3 h-14 pr-10 bg-transparent ${isFocused ? 'border-black dark:border-white' : 'border-black/60 dark:border-white/60'} ${error ? 'border-red-500' : ''}`}
        >
          <ThemedText className={value ? 'text-base' : 'text-base text-gray-500'}>
            {value ? formatToYYYYMMDD(value) : ''}
          </ThemedText>
        </TouchableOpacity>
        <Pressable className="absolute right-3 top-[18px] z-10">
          <Icon name="Calendar" size={20} color={colors.text} />
        </Pressable>
      </View>
      {error && <ThemedText className="text-red-500 text-xs mt-1">{error}</ThemedText>}
      {picker}
    </View>
  );
};

export default DatePicker;
