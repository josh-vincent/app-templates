// Spacing scale. `global` is the single most-used inset across the apps
// (page padding, card padding, list gutters). Keep it in sync with the
// tailwind preset's `spacing.global` extension.

export const spacing = {
  global: 20,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export type SpacingKey = keyof typeof spacing;
