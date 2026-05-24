import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// LuckyChips uses fake "play credits" only — no real money is ever involved.
// This context owns the local balance and an in-memory list of recent rounds.
// Persisted to AsyncStorage so a reload doesn't wipe progress.

const STARTING_BALANCE = 1000;
const DAILY_BONUS = 100;
const MAX_HISTORY = 50;

const BALANCE_KEY = 'luckychips.balance.v1';
const HISTORY_KEY = 'luckychips.history.v1';
const LAST_BONUS_KEY = 'luckychips.lastBonus.v1';

export type RoundOutcome = 'win' | 'loss' | 'push' | 'bonus';

export type Round = {
  id: string;
  game: 'slots' | 'blackjack' | 'bonus';
  outcome: RoundOutcome;
  delta: number; // signed change to balance, in credits
  detail?: string;
  at: number; // epoch ms
};

type BalanceContextValue = {
  balance: number;
  history: Round[];
  ready: boolean;
  /**
   * Claim today's bonus. Returns true if applied, false if already claimed.
   */
  claimDailyBonus: () => boolean;
  /**
   * Returns true if the daily bonus is still available today.
   */
  canClaimDailyBonus: () => boolean;
  /**
   * Apply a round result to the balance and prepend it to history.
   */
  recordRound: (r: Omit<Round, 'id' | 'at'>) => void;
  /**
   * Reset the balance back to the starting value and clear history.
   */
  reset: () => void;
};

const BalanceContext = createContext<BalanceContextValue | undefined>(
  undefined
);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [history, setHistory] = useState<Round[]>([]);
  const [lastBonusDay, setLastBonusDay] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, h, lb] = await Promise.all([
          AsyncStorage.getItem(BALANCE_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
          AsyncStorage.getItem(LAST_BONUS_KEY),
        ]);
        if (cancelled) return;
        if (b != null) {
          const parsed = Number(b);
          if (Number.isFinite(parsed)) setBalance(parsed);
        }
        if (h != null) {
          try {
            const parsed = JSON.parse(h);
            if (Array.isArray(parsed)) setHistory(parsed);
          } catch {
            // ignore corrupt history
          }
        }
        if (lb != null) setLastBonusDay(lb);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist balance whenever it changes.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(BALANCE_KEY, String(balance)).catch(() => {});
  }, [balance, ready]);

  // Persist history whenever it changes.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)).catch(() => {});
  }, [history, ready]);

  // Persist last-bonus-day whenever it changes.
  useEffect(() => {
    if (!ready) return;
    if (lastBonusDay == null) {
      AsyncStorage.removeItem(LAST_BONUS_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(LAST_BONUS_KEY, lastBonusDay).catch(() => {});
    }
  }, [lastBonusDay, ready]);

  const canClaimDailyBonus = useCallback(() => {
    return lastBonusDay !== todayKey();
  }, [lastBonusDay]);

  const claimDailyBonus = useCallback(() => {
    const today = todayKey();
    if (lastBonusDay === today) return false;
    setBalance((b) => b + DAILY_BONUS);
    setLastBonusDay(today);
    setHistory((h) =>
      [
        {
          id: `bonus-${today}-${Date.now()}`,
          game: 'bonus' as const,
          outcome: 'bonus' as RoundOutcome,
          delta: DAILY_BONUS,
          detail: 'Daily bonus',
          at: Date.now(),
        },
        ...h,
      ].slice(0, MAX_HISTORY)
    );
    return true;
  }, [lastBonusDay]);

  const recordRound = useCallback((r: Omit<Round, 'id' | 'at'>) => {
    const at = Date.now();
    const id = `${r.game}-${at}-${Math.random().toString(36).slice(2, 8)}`;
    setBalance((b) => Math.max(0, b + r.delta));
    setHistory((h) => [{ ...r, id, at }, ...h].slice(0, MAX_HISTORY));
  }, []);

  const reset = useCallback(() => {
    setBalance(STARTING_BALANCE);
    setHistory([]);
    setLastBonusDay(null);
  }, []);

  const value = useMemo<BalanceContextValue>(
    () => ({
      balance,
      history,
      ready,
      claimDailyBonus,
      canClaimDailyBonus,
      recordRound,
      reset,
    }),
    [balance, history, ready, claimDailyBonus, canClaimDailyBonus, recordRound, reset]
  );

  return (
    <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>
  );
}

export function useBalance() {
  const ctx = useContext(BalanceContext);
  if (!ctx) throw new Error('useBalance must be used within a BalanceProvider');
  return ctx;
}

export const LUCKYCHIPS_CONSTANTS = {
  STARTING_BALANCE,
  DAILY_BONUS,
};
