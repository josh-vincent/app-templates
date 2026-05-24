import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaymentBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';

export type PaymentMethod = {
  id: string;
  brand: PaymentBrand;
  cardLast4: string;
  cardHolder: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  nickname?: string;
};

const KEY = '@voyage/payment-methods';

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribePaymentMethods(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PaymentMethod[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setAllPaymentMethods(list: PaymentMethod[]): Promise<void> {
  // exactly one default
  let defaulted = false;
  const next = list.map((m) => {
    if (m.isDefault && !defaulted) {
      defaulted = true;
      return m;
    }
    return { ...m, isDefault: false };
  });
  if (!defaulted && next.length > 0) {
    next[0] = { ...next[0], isDefault: true };
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

export async function addPaymentMethod(input: Omit<PaymentMethod, 'id' | 'isDefault'> & { id?: string; isDefault?: boolean }): Promise<PaymentMethod> {
  const list = await listPaymentMethods();
  const record: PaymentMethod = {
    id: input.id ?? `pm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    brand: input.brand,
    cardLast4: input.cardLast4,
    cardHolder: input.cardHolder,
    expiryMonth: input.expiryMonth,
    expiryYear: input.expiryYear,
    isDefault: input.isDefault ?? list.length === 0,
    nickname: input.nickname,
  };
  await setAllPaymentMethods([...list, record]);
  return record;
}

export async function removePaymentMethod(id: string): Promise<void> {
  const list = await listPaymentMethods();
  const next = list.filter((m) => m.id !== id);
  await setAllPaymentMethods(next);
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  const list = await listPaymentMethods();
  await setAllPaymentMethods(list.map((m) => ({ ...m, isDefault: m.id === id })));
}

export async function getDefaultPaymentMethod(): Promise<PaymentMethod | undefined> {
  const list = await listPaymentMethods();
  return list.find((m) => m.isDefault) ?? list[0];
}
