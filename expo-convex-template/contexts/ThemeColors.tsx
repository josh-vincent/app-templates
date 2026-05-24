import { useTheme } from './ThemeContext';

export const useThemeColors = () => {
  const { isDark } = useTheme();

  return {
    icon: isDark ? '#f7f4ef' : '#0d1014',
    bg: isDark ? '#0d1014' : '#f7f4ef',
    invert: isDark ? '#000000' : '#ffffff',
    secondary: isDark ? '#1a1f27' : '#ece9e2',
    state: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
    sheet: isDark ? '#1a1f27' : '#ffffff',
    highlight: '#f5c542',
    lightDark: isDark ? '#1a1f27' : '#ffffff',
    border: isDark ? '#2a313d' : '#dfe3da',
    text: isDark ? '#f7f4ef' : '#0d1014',
    placeholder: isDark ? 'rgba(247,244,239,0.4)' : 'rgba(13,16,20,0.4)',
    switch: isDark ? 'rgba(247,244,239,0.4)' : '#ccc',
    chatBg: isDark ? '#1a1f27' : '#efefef',
    isDark,
  };
};

export default useThemeColors;
