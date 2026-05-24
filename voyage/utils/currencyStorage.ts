import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@voyage/currency';
const DEFAULT_CODE = 'USD';

export const SUPPORTED_CURRENCIES: { code: string; title: string }[] = [
  { code: 'USD', title: 'United States Dollar' },
  { code: 'EUR', title: 'Euro' },
  { code: 'GBP', title: 'British Pound' },
  { code: 'CAD', title: 'Canadian Dollar' },
  { code: 'AUD', title: 'Australian Dollar' },
  { code: 'CHF', title: 'Swiss Franc' },
  { code: 'JPY', title: 'Japanese Yen' },
  { code: 'CNY', title: 'Chinese Yuan' },
  { code: 'INR', title: 'Indian Rupee' },
  { code: 'BRL', title: 'Brazilian Real' },
  { code: 'ZAR', title: 'South African Rand' },
  { code: 'MXN', title: 'Mexican Peso' },
];

const listeners = new Set<(code: string) => void>();

export async function getCurrency(): Promise<string> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw && SUPPORTED_CURRENCIES.some((c) => c.code === raw) ? raw : DEFAULT_CODE;
}

export async function setCurrency(code: string): Promise<void> {
  await AsyncStorage.setItem(KEY, code);
  for (const fn of listeners) fn(code);
}

export function currencyTitle(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.title ?? code;
}

export function useCurrency(): string {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  useEffect(() => {
    let alive = true;
    getCurrency().then((c) => {
      if (alive) setCode(c);
    });
    const fn = (c: string) => setCode(c);
    listeners.add(fn);
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);
  return code;
}
