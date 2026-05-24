import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useColorScheme } from 'nativewind';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export type ThemeProviderProps = {
  children: React.ReactNode;
  defaultDark?: boolean;
};

export const ThemeProvider = ({
  children,
  defaultDark = true,
}: ThemeProviderProps) => {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [isDark, setIsDark] = useState(defaultDark);

  useEffect(() => {
    setColorScheme(defaultDark ? 'dark' : 'light');
    setIsDark(defaultDark);
  }, [defaultDark, setColorScheme]);

  useEffect(() => {
    setIsDark(colorScheme === 'dark');
  }, [colorScheme]);

  const toggleTheme = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    requestAnimationFrame(() => setColorScheme(next));
  }, [isDark, setColorScheme]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

export default ThemeContext;
