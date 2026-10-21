import type { Car, Rarity } from './types';

export const TIERS: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
export const TIER_XP: Record<Rarity, number> = {
  Common: 3, Uncommon: 8, Rare: 25, Epic: 65, Legendary: 130, Mythic: 330,
};
export const COLOR_XP: Record<string, number> = { Common: 0, Uncommon: 4, Rare: 13 };
export const RTIER: Record<Rarity, number> = {
  Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5,
};

export const RANKS: [number, string][] = [
  [1, 'ROOKIE'], [3, 'SPOTTER'], [6, 'SCOUT'], [10, 'TRACKER'], [15, 'HUNTER'],
  [20, 'COLLECTOR'], [26, 'CURATOR'], [32, 'VETERAN'], [38, 'SPECIALIST'], [44, 'ELITE'],
  [50, 'MASTER'], [56, 'GRANDMASTER'], [62, 'LEGEND'], [67, 'MYTHIC EYE'], [70, 'BIX KING'],
  [78, 'ICON'], [85, 'IMMORTAL'], [92, 'APEX SPOTTER'], [100, 'BIX GOD'],
];

export const MAX_LEVEL = 100;
const LVL_A = 120;
const LVL_P = 1.36;

export const xpForLevel = (n: number) => Math.round(LVL_A * Math.pow(Math.max(0, n - 1), LVL_P));

/** Highest level whose XP threshold the player has reached. */
export function levelFor(xp: number): number {
  let lv = 1;
  for (let n = 2; n <= MAX_LEVEL; n++) {
    if (xp >= xpForLevel(n)) lv = n;
    else break;
  }
  return lv;
}

export function rankFor(level: number): string {
  let name = RANKS[0][1];
  for (const [lv, label] of RANKS) if (level >= lv) name = label;
  return name;
}

/** Trim/performance-variant bonus; the most specific tier is checked first. */
export const TRIM_TIERS = [
  { xp: 13, label: 'ONE-OFF', kw: ['COACHBUILT', 'PROTOTYPE', 'CONCEPT', 'ONE-OFF', 'ONE OF ONE'] },
  { xp: 10, label: 'HOMOLOGATION', kw: ['GT3 RS', 'GT2 RS', 'BLACK SERIES', 'ZR1'] },
  { xp: 7, label: 'HALO/FLAGSHIP', kw: ['GT3', 'Z06', 'RAPTOR', 'TRACKHAWK', 'HELLCAT', 'DEMON', 'ZL1', 'NISMO'] },
  { xp: 5, label: 'PERFORMANCE', kw: ['TYPE R', 'GOLF R', 'M2', 'M3', 'M4', 'M5', 'STI', 'EVO', 'SRT'] },
  { xp: 2, label: 'VOLUME HOT MODEL', kw: ['GTI', 'SI', 'TRD PRO', 'GLI', 'N-LINE', 'N LINE'] },
  { xp: 1, label: 'APPEARANCE PACK', kw: ['M SPORT', 'R-LINE', 'R LINE', 'S LINE', 'S-LINE', 'F SPORT', 'AMG LINE', 'ST-LINE', 'ST LINE'] },
];

export function trimTier(car: Pick<Car, 'trim' | 'model'>) {
  const hay = `${car.trim || ''} ${car.model || ''}`.toUpperCase();
  for (const t of TRIM_TIERS) for (const k of t.kw) if (hay.includes(k)) return t;
  return null;
}

export const trimBonusXP = (car: Pick<Car, 'trim' | 'model'>) => trimTier(car)?.xp ?? 0;

export function catchXP(car: Car): number {
  if (car.xpOverride != null) return car.xpOverride;
  let v = (TIER_XP[car.rarity] || 20) + (COLOR_XP[car.colorRarity || ''] || 0) + trimBonusXP(car);
  if (car.twinSpot) v += 25;
  if (car.modded) v += 10;
  if (car.cleanShot) v += 10;
  if (car.nightCatch) v += 5;
  if (car.barnFind) v = Math.round(v * 1.5);
  if (car.xpBoosted) v *= 2;
  return v;
}

export const STAT_BOUNDS: Record<string, [number, number]> = {
  horsepower: [40, 2200], topSpeedMph: [35, 330], redlineRpm: [2200, 16000],
  torqueLbFt: [40, 2500], weightLbs: [700, 10000],
};

export const TIER_COLOR: Record<Rarity, string> = {
  Common: '#B3A98D', Uncommon: '#7FA05C', Rare: '#5FA89B',
  Epic: '#8C6FB5', Legendary: '#C9A227', Mythic: '#D8402F',
};

/** Total XP from raw garage + bonus (same as the web's xp()). */
export const totalXpFor = (garage: { car: Car }[], profile: { bonusXP?: number }) =>
  garage.reduce((a, g) => a + catchXP(g.car), 0) + (profile.bonusXP || 0);
