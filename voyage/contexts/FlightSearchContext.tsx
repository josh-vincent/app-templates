import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CabinClass, SearchParams } from '@/lib/flightTypes';

type PartialParams = Partial<SearchParams> & { cabin?: CabinClass; adults?: number };

type Ctx = {
  params: SearchParams;
  setParams: (patch: PartialParams) => void;
  reset: () => void;
};

const defaults: SearchParams = {
  origin: '',
  destination: '',
  departureDate: '',
  returnDate: undefined,
  adults: 1,
  cabin: 'economy',
};

const FlightSearchContext = createContext<Ctx | undefined>(undefined);

export function FlightSearchProvider({ children }: { children: ReactNode }) {
  const [params, setParamsState] = useState<SearchParams>(defaults);
  const value = useMemo<Ctx>(
    () => ({
      params,
      setParams: (patch) => setParamsState((prev) => ({ ...prev, ...patch })),
      reset: () => setParamsState(defaults),
    }),
    [params],
  );
  return <FlightSearchContext.Provider value={value}>{children}</FlightSearchContext.Provider>;
}

export function useFlightSearch(): Ctx {
  const ctx = useContext(FlightSearchContext);
  if (!ctx) throw new Error('useFlightSearch must be used within FlightSearchProvider');
  return ctx;
}

export default FlightSearchProvider;
