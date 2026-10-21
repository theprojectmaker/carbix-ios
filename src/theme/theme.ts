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

export const fonts = {
  display: 'Jersey25_400Regular',
  pixel: 'PressStart2P_400Regular',
  utility: 'Silkscreen_400Regular',
  utilityBold: 'Silkscreen_700Bold',
  prose: 'PixelifySans_400Regular',
};

export type Theme = typeof palette & typeof light & { dark: boolean };

/** Like the web app: light unless you switch it in Settings (it does not follow the phone). */
export function useTheme(): Theme {
  const { settings } = useGame();
  const isDark = settings.theme === 'dark';
  return { ...palette, ...(isDark ? dark : light), dark: isDark };
}
