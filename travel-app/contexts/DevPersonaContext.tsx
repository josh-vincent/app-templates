// Per-device dev persona. Two simulators can run side-by-side, one as
// "josh" and one as "jeff", by picking different personas in the Profile
// screen. The selection is persisted in SecureStore and forwarded as
// `personaKey` on every Convex call via `lib/persona-convex.ts`.
//
// When the persona is `null`, Convex calls run without a persona and the
// backend falls back to the dev profile / auth user as before.

import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'voyager_dev_persona';

export type Persona = 'josh' | 'jeff' | null;

type Ctx = {
  persona: Persona;
  ready: boolean;
  setPersona: (next: Persona) => Promise<void>;
};

const DevPersonaCtx = createContext<Ctx>({
  persona: null,
  ready: false,
  setPersona: async () => {},
});

export function DevPersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => {
        if (value === 'josh' || value === 'jeff') setPersonaState(value);
      })
      .catch((e) => console.warn('[devPersona] read failed', e))
      .finally(() => setReady(true));
  }, []);

  const setPersona = async (next: Persona) => {
    try {
      if (next) await SecureStore.setItemAsync(STORAGE_KEY, next);
      else await SecureStore.deleteItemAsync(STORAGE_KEY);
    } catch (e) {
      console.warn('[devPersona] write failed', e);
    }
    setPersonaState(next);
  };

  return (
    <DevPersonaCtx.Provider value={{ persona, ready, setPersona }}>
      {children}
    </DevPersonaCtx.Provider>
  );
}

export function useDevPersona() {
  return useContext(DevPersonaCtx);
}
