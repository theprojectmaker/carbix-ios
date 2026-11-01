import { useGame } from '@/state/game';

/** The original Carbix palette — cream / red / navy / amber. Do not re-skin (a teal version was tried and reverted). */
export const palette = {
  red: '#D8402F',
  redDk: '#98261A',
  navy: '#5C7AA0',
  navyDk: '#33465F',
  gold: '#C9A227',
  goldDk: '#8F7318',
  steelLit: '#8CA6C4',
  panel: '#141C27',
  panel2: '#1E2833',
  line: '#2E3A48',
  wht: '#E4E7EC',
  lcdDim: '#8A97A6',
  green: '#5FA89B',
};

const light = {
  paper: '#F0EEE7',
  paper2: '#D9D6CC',
  paperEdge: '#C8C4B8',
  ink: '#141C27',
  muted: '#33465F',
};
const dark = {
  paper: '#1B1F27',
  paper2: '#242A35',
  paperEdge: '#0F1319',
  ink: '#E4E7EC',
  muted: '#A6B2C8',
};

/* One typeface: Jersey 25 for headlines, labels and body alike (labels were Silkscreen, then Pixelify Sans, and both
   turned to mush at small sizes). Label sizes across the app were raised ~40% to suit. Silkscreen stays as `retro`
   for the few stamped badges, Press Start for the LCD. */
export const fonts = {
  display: 'Jersey25_400Regular',
  pixel: 'PressStart2P_400Regular',
  utility: 'Jersey25_400Regular',
  utilityBold: 'Jersey25_400Regular',
  prose: 'Jersey25_400Regular',
  retro: 'Silkscreen_700Bold',
};

export type Theme = typeof palette & typeof light & { dark: boolean };

/** Like the web app: light unless you switch it in Settings (it does not follow the phone). */
export function useTheme(): Theme {
  const { settings } = useGame();
  const isDark = settings.theme === 'dark';
  return { ...palette, ...(isDark ? dark : light), dark: isDark };
}
