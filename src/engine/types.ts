export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';

export type CatalogEntry = {
  n: number;
  make: string;
  model: string;
  cls: string;
  rarity: Rarity;
  years: string | null;
  low: number | null;
  high: number | null;
  hp: number | null;
  top: number | null;
  zts: string | null;
  eng: string | null;
};

/** A car as returned by /api/identify and stored on a catch. Same shape as the web app. */
export type Car = {
  make: string;
  model: string;
  rarity: Rarity;
  class?: string;
  country?: string;
  yearRange?: string;
  trim?: string;
  color?: string;
  colorRarity?: 'Common' | 'Uncommon' | 'Rare';
  engine?: string;
  drive?: string;
  horsepower?: number;
  topSpeedMph?: number;
  zeroToSixty?: string;
  redlineRpm?: number;
  torqueLbFt?: number;
  weightLbs?: number;
  powerToWeight?: string;
  msrpNew?: string;
  marketUsed?: string;
  confidence?: number;
  box?: { x: number; y: number; w: number; h: number };
  twinSpot?: boolean;
  modded?: boolean;
  cleanShot?: boolean;
  nightCatch?: boolean;
  barnFind?: boolean;
  xpBoosted?: boolean;
  xpOverride?: number | null;
  golden?: boolean;
  cryptid?: boolean;
  duplicatesInFrame?: number;
  screenCapture?: boolean;
  [k: string]: unknown;
};

export type Catch = {
  id: number;
  ts: number;
  car: Car;
  photo?: string | null;
  feedPhoto?: string | null;
  geo?: { lat: number; lng: number } | null;
  shiny?: boolean;
  nick?: string;
  [k: string]: unknown;
};

export type Profile = {
  name: string;
  lic: string;
  issued: string;
  days: string[];
  token: string;
  friends: string[];
  username: string;
  displayName: string;
  avatar: number;
  bonusXP?: number;
  googleLinked?: boolean;
  lastCloudSave?: number;
  consumables: { xpCharm: number; streakSaverCharges: number };
  questOverrides: Record<string, unknown>;
  nativeIcons: { owned: string[]; equipped: string | null };
  cosmetics?: Record<string, unknown>;
  [k: string]: unknown;
};
