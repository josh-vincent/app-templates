export * from './colors';
export * from './spacing';
export * from './radii';
export * from './fonts';

// Legacy default export — fitstake/lib/theme.ts had a default-export of all
// color constants. Preserved so `import theme from '@/lib/theme'` keeps working
// after the codemod swaps it to `import theme from '@jv/tokens'`.
import { colors } from './colors';
import { SERIF } from './fonts';
export default { ...colors, SERIF };
