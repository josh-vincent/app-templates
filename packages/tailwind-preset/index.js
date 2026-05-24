// Tailwind preset for all jv apps. Apps consume via:
//
//   module.exports = {
//     presets: [require('@jv/tailwind-preset')],
//     content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
//   };
//
// Token values are mirrored from @jv/tokens via tokens.json so this file stays
// CJS-compatible (Tailwind config is loaded as CJS).

const tokens = require('@jv/tokens/json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      spacing: {
        global: `${tokens.spacing.global}px`,
        xs: `${tokens.spacing.xs}px`,
        sm: `${tokens.spacing.sm}px`,
        md: `${tokens.spacing.md}px`,
        lg: `${tokens.spacing.lg}px`,
        xl: `${tokens.spacing.xl}px`,
        '2xl': `${tokens.spacing['2xl']}px`,
        '3xl': `${tokens.spacing['3xl']}px`,
      },
      borderRadius: {
        xs: `${tokens.radii.xs}px`,
        sm: `${tokens.radii.sm}px`,
        md: `${tokens.radii.md}px`,
        lg: `${tokens.radii.lg}px`,
        xl: `${tokens.radii.xl}px`,
        '2xl': `${tokens.radii['2xl']}px`,
        pill: `${tokens.radii.pill}px`,
      },
      colors: {
        // Brand
        highlight: tokens.colors.GOLD,
        gold: tokens.colors.GOLD,
        lime: tokens.colors.LIME,
        ember: tokens.colors.EMBER,
        sky: tokens.colors.SKY,
        iron: tokens.colors.IRON,
        slate: tokens.colors.SLATE,
        bone: tokens.colors.BONE,
        fog: tokens.colors.FOG,

        // Themes
        light: tokens.lightTheme,
        dark: tokens.darkTheme,
      },
    },
  },
  plugins: [],
};
