// Font tokens. `SERIF` historically used in the apps — kept as alias so legacy
// imports compile.

export const fonts = {
  system: 'System',
  serif: 'System',
  mono: 'Menlo',
} as const;

export const SERIF = fonts.serif;

export type FontKey = keyof typeof fonts;
