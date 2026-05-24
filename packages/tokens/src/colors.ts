// jv palette — sporty + wager energy.
// Canonical names: IRON / BONE / SLATE / FOG / GOLD / LIME / EMBER / SKY.
// Legacy aliases (INK / PARCHMENT / BRICK / MOSS) are re-exported so
// pre-migration imports keep compiling during cutover.

export const IRON = '#0d1014';   // primary dark surface
export const BONE = '#f7f4ef';   // primary light surface
export const SLATE = '#1a1f27';  // raised dark surface
export const FOG = '#ece9e2';    // raised light surface
export const GOLD = '#f5c542';   // jackpot / prize accent
export const LIME = '#2cd673';   // win / on-track / steps
export const EMBER = '#ff5147';  // stake at risk / loss
export const SKY = '#3aa1ff';    // info / link

// Legacy aliases — preserved so legacy imports keep compiling.
export const INK = IRON;
export const PARCHMENT = BONE;
export const PARCHMENT_DEEP = FOG;
export const PARCHMENT_COOL = '#dfe3da';
export const BRICK = EMBER;
export const BRICK_LIGHT = '#ff7568';
export const MOSS = LIME;
export const MOSS_SOFT = '#dff8eb';

export const colors = {
  IRON,
  BONE,
  SLATE,
  FOG,
  GOLD,
  LIME,
  EMBER,
  SKY,
  INK,
  PARCHMENT,
  PARCHMENT_DEEP,
  PARCHMENT_COOL,
  BRICK,
  BRICK_LIGHT,
  MOSS,
  MOSS_SOFT,
} as const;

export const lightTheme = {
  primary: BONE,
  secondary: FOG,
  text: IRON,
  subtext: '#5a6470',
} as const;

export const darkTheme = {
  primary: IRON,
  secondary: SLATE,
  darker: '#04060a',
  text: BONE,
  subtext: '#8a93a0',
} as const;

export type ColorName = keyof typeof colors;
