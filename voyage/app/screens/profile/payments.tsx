import React, { useCallback, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AntDesign from '@expo/vector-icons/AntDesign';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/components/Button';
import { CardScroller } from '@/components/CardScroller';
import Header from '@/components/Header';
import Icon from '@/components/Icon';
import Section from '@/components/layout/Section';
import ThemedText from '@/components/ThemedText';
import Toggle from '@/components/Toggle';
import Input from '@/components/forms/Input';
import useThemeColors from '@/contexts/ThemeColors';
import { shadowPresets } from '@/utils/useShadow';
import { INK, PARCHMENT } from '@/lib/theme';
import {
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  subscribePaymentMethods,
  type PaymentBrand,
  type PaymentMethod,
} from '@/utils/paymentMethodsStorage';

const { width } = Dimensions.get('window');

const BRAND_GRADIENT: Record<PaymentBrand, [string, string]> = {
  visa: ['#1E1B17', '#2E2A22'],
  mastercard: ['#5C3D2E', '#7A5444'],
  amex: ['#2E3A59', '#4F6488'],
  discover: ['#8C6A3A', '#A8834E'],
  other: ['#9b9b9b', '#cccccc'],
};

const BRAND_LABEL: Record<PaymentBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  discover: 'Discover',
  other: 'Card',
};

function detectBrand(cardNumber: string): PaymentBrand {
  const stripped = cardNumber.replace(/\D/g, '');
  if (/^4/.test(stripped)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(stripped)) return 'mastercard';
  if (/^3[47]/.test(stripped)) return 'amex';
  if (/^6(?:011|5)/.test(stripped)) return 'discover';
  return 'other';
}

export default function PaymentsScreen() {
  const colors = useThemeColors();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

  const load = useCallback(async () => {
    setMethods(await listPaymentMethods());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const unsub = subscribePaymentMethods(load);
      return unsub;
    }, [load]),
  );

  const handleAddCard = () => {
    setCardNumber('');
    setCardHolder('');
    setExpiryDate('');
    setCvv('');
    setMakeDefault(methods.length === 0);
    setIsModalVisible(true);
  };

  const handleSaveCard = async () => {
    if (!cardNumber || !cardHolder || !expiryDate || !cvv) return;
    const [mm, yy] = expiryDate.split('/').map((s) => s.trim());
    const year = yy?.length === 2 ? 2000 + Number(yy) : Number(yy ?? new Date().getFullYear());
    await addPaymentMethod({
      brand: detectBrand(cardNumber),
      cardLast4: cardNumber.replace(/\D/g, '').slice(-4),
      cardHolder,
      expiryMonth: Number(mm) || 1,
      expiryYear: Number.isFinite(year) ? year : new Date().getFullYear() + 1,
      isDefault: makeDefault,
    });
    setIsModalVisible(false);
    load();
  };

  return (
    <View className="flex-1 dark:bg-dark-primary" style={{ backgroundColor: PARCHMENT }}>
      <Header title="Payment Methods" showBackButton />

      <ScrollView className="flex-1">
        <Section title="Your cards" className="px-global pt-10" titleSize="xl" />

        <View className="px-global mt-4">
          {methods.length === 0 ? (
            <View
              className="rounded-2xl p-6 items-center bg-light-secondary/30 dark:bg-dark-secondary"
              style={{ height: 160 }}>
              <Icon name="CreditCard" size={28} />
              <ThemedText className="mt-3 text-sm opacity-70">
                No payment methods yet. Add one to speed up checkout.
              </ThemedText>
            </View>
          ) : (
            <CardScroller>
              {methods.map((m) => (
                <CardPreview
                  key={m.id}
                  method={m}
                  onSetDefault={() => setDefaultPaymentMethod(m.id).then(load)}
                  onDelete={() => removePaymentMethod(m.id).then(load)}
                />
              ))}
            </CardScroller>
          )}
          <Button
            title="Add New Card"
            iconStart="Plus"
            variant="outline"
            className="mt-4"
            onPress={handleAddCard}
          />
        </View>

        <Section title="Digital Wallets" className="px-global mt-14" />

        <View className="px-global pb-8 mt-4">
          <TouchableOpacity className="flex-row items-center border-b border-light-secondary dark:border-dark-secondary py-4">
            <View className="w-12 h-12 rounded-lg bg-light-secondary dark:bg-dark-secondary items-center justify-center mr-4">
              <AntDesign name="apple" size={24} color={colors.icon} />
            </View>
            <View className="flex-1">
              <ThemedText className="font-semibold">Apple Pay</ThemedText>
              <ThemedText className="text-sm text-light-subtext dark:text-dark-subtext">
                Set up Apple Pay for faster checkout
              </ThemedText>
            </View>
            <Icon name="ChevronRight" size={20} />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center border-b border-light-secondary dark:border-dark-secondary py-4">
            <View className="w-12 h-12 rounded-lg bg-light-secondary dark:bg-dark-secondary items-center justify-center mr-4">
              <AntDesign name="google" size={24} color={colors.icon} />
            </View>
            <View className="flex-1">
              <ThemedText className="font-semibold">Google Pay</ThemedText>
              <ThemedText className="text-sm text-light-subtext dark:text-dark-subtext">
                Set up Google Pay for faster checkout
              </ThemedText>
            </View>
            <Icon name="ChevronRight" size={20} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center h-screen p-global">
          <View className="bg-light-primary dark:bg-dark-primary rounded-xl p-4">
            <View className="flex-row justify-between items-center mb-6">
              <ThemedText className="text-xl font-semibold">Add New Card</ThemedText>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Icon name="X" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView className="pt-4">
              <Input
                label="Card Number"
                value={cardNumber}
                onChangeText={setCardNumber}
                placeholder="1234 5678 9012 3456"
                keyboardType="numeric"
              />

              <Input
                label="Cardholder Name"
                value={cardHolder}
                onChangeText={setCardHolder}
                placeholder="Alex Morgan"
              />

              <Input
                label="Expiry Date"
                containerClassName="flex-1"
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="MM/YY"
                inRow={true}
              />

              <Input
                label="CVV"
                containerClassName="flex-1"
                value={cvv}
                onChangeText={setCvv}
                placeholder="123"
                keyboardType="numeric"
                secureTextEntry
                inRow={true}
              />

              <View className="flex-row items-center justify-between py-4 mb-4">
                <ThemedText>Set as default payment method</ThemedText>
                <Toggle value={makeDefault} onChange={setMakeDefault} />
              </View>
            </ScrollView>

            <View className="flex-row mt-4 gap-4 pt-2 border-t border-light-secondary dark:border-dark-secondary">
              <Button
                title="Cancel"
                variant="ghost"
                className="flex-1"
                onPress={() => setIsModalVisible(false)}
              />
              <Button title="Save Card" className="flex-1" onPress={handleSaveCard} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CardPreview = ({
  method,
  onSetDefault,
  onDelete,
}: {
  method: PaymentMethod;
  onSetDefault: () => void;
  onDelete: () => void;
}) => {
  const gradient = BRAND_GRADIENT[method.brand] ?? BRAND_GRADIENT.other;
  const mm = String(method.expiryMonth).padStart(2, '0');
  const yy = String(method.expiryYear % 100).padStart(2, '0');
  return (
    <View
      className="h-60 rounded-2xl flex flex-col justify-end"
      style={{ width: width - 40, ...shadowPresets.large }}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="h-full rounded-2xl p-6 flex flex-col justify-end">
        <Text className="font-outfit-bold text-xl" style={{ color: PARCHMENT }}>•••• •••• •••• {method.cardLast4}</Text>
        <View className="flex-row justify-between mt-1">
          <Text style={{ color: PARCHMENT }}>{method.cardHolder}</Text>
          <Text style={{ color: PARCHMENT }}>{`${mm}/${yy}`}</Text>
        </View>

        <View className="absolute top-6 right-6 flex-row w-full justify-between pl-12">
          <Text className="font-outfit-bold text-lg" style={{ color: PARCHMENT }}>{BRAND_LABEL[method.brand]}</Text>
          <View className="flex-row items-center">
            {method.isDefault ? (
              <View className="px-2 py-1 rounded-full items-center justify-center" style={{ backgroundColor: INK }}>
                <Text className="text-xs" style={{ color: PARCHMENT }}>Default</Text>
              </View>
            ) : (
              <Pressable
                onPress={onSetDefault}
                className="px-2 py-1 bg-white rounded-full items-center justify-center">
                <Text className="text-black text-xs">Set as default</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="ml-2 w-7 h-7 rounded-full bg-white/70 items-center justify-center">
              <Icon name="Trash2" size={12} color="#000" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};
