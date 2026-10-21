import type { SeasonName } from './quests';
import type { Profile } from './types';

/* The season shop. Today the web app sells two things for Orbs: MAP PINS and CATCH FX
   (frames, name colours and titles are shelved there, and phone icons need the iOS shell). */

export type ShopItem = {
  id: string;
  name: string;
  price: number;
  desc: string;
  season?: SeasonName;
  marker?: string; // map pin art slug
};
export type Track = 'mappin' | 'effect';

export const MAP_PIN_STYLES: ShopItem[] = [
  { id: 'map-marker-palmtree', marker: 'palmtree', name: 'PALM TREE', price: 40, season: 'summer', desc: "Your catch pins on the Map become palm trees — color still follows each catch's rarity." },
  { id: 'map-marker-surfboard', marker: 'surfboard', name: 'SURFBOARD', price: 40, season: 'summer', desc: "Your catch pins on the Map become surfboards — color still follows each catch's rarity." },
  { id: 'map-marker-mapleleaf', marker: 'mapleleaf', name: 'MAPLE LEAF', price: 40, season: 'fall', desc: "Your catch pins on the Map become maple leaves — color still follows each catch's rarity." },
  { id: 'map-marker-pumpkin', marker: 'pumpkin', name: 'PUMPKIN', price: 40, season: 'fall', desc: "Your catch pins on the Map become pumpkins — color still follows each catch's rarity." },
  { id: 'map-marker-acorn', marker: 'acorn', name: 'ACORN', price: 40, season: 'fall', desc: "Your catch pins on the Map become acorns — color still follows each catch's rarity." },
  { id: 'map-marker-candycorn', marker: 'candycorn', name: 'CANDY CORN', price: 40, season: 'fall', desc: "Your catch pins on the Map become candy corn — color still follows each catch's rarity." },
  { id: 'map-marker-ghost', marker: 'ghost', name: 'GHOST', price: 40, season: 'fall', desc: "Your catch pins on the Map become friendly ghosts — color still follows each catch's rarity." },
  { id: 'map-marker-apple', marker: 'apple', name: 'APPLE', price: 40, season: 'fall', desc: "Your catch pins on the Map become apples — color still follows each catch's rarity." },
];

export const CATCH_EFFECTS: ShopItem[] = [
  { id: 'standard', name: 'STANDARD', price: 0, desc: "Pixel sparks in your catch's rarity color burst off the card." },
  { id: 'leaffall', name: 'LEAF FALL', price: 45, season: 'fall', desc: 'Maple leaves tumble down over the card and sway as they fall, in a warm amber glow.' },
  { id: 'embers', name: 'EMBERS', price: 55, season: 'fall', desc: 'The card glows like a campfire and glowing embers rise off its edge.' },
  { id: 'ghostparade', name: 'GHOST PARADE', price: 60, season: 'fall', desc: 'Friendly ghosts float up past the card while purple and orange sparks twinkle.' },
  { id: 'harvestmoon', name: 'HARVEST MOON', price: 70, season: 'fall', desc: 'Moonlight washes over the card and fireflies drift around it.' },
  { id: 'starburst', name: 'STARBURST', price: 60, desc: 'A bright ring blasts out from the card and throws gold stars twice as far.' },
];

export const MAP_PIN_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

type Cos = Record<string, any>;
const cos = (p: Pick<Profile, 'cosmetics'>): Cos => (p.cosmetics || {}) as Cos;
export const ownedTiers = (p: Pick<Profile, 'cosmetics'>, track: Track): string[] => cos(p)[track + 'Owned'] || [];
export const equippedTier = (p: Pick<Profile, 'cosmetics'>, track: Track): string | null => cos(p)[track] || null;

/** A seasonal item shows in ITS season, or forever once owned. */
export const shopSeasonOK = (t: ShopItem, owned: string[], season: SeasonName) =>
  !t.season || t.season === season || owned.includes(t.id);

export type ShopEntry = ShopItem & { track: Track; owned: boolean; equipped: boolean };

export function mapPinEntries(p: Profile, season: SeasonName): ShopEntry[] {
  const owned = ownedTiers(p, 'mappin');
  const eq = equippedTier(p, 'mappin');
  const classic: ShopEntry = {
    id: 'classic', track: 'mappin', name: 'CLASSIC PIN', price: 0, owned: true,
    desc: "The original teardrop pin — color follows each catch's rarity.",
    equipped: !eq || eq === 'classic' || !MAP_PIN_STYLES.some((t) => t.id === eq),
  };
  const rest = MAP_PIN_STYLES.filter((t) => shopSeasonOK(t, owned, season)).map((t): ShopEntry => ({
    ...t, track: 'mappin', owned: owned.includes(t.id), equipped: eq === t.id,
  }));
  return [classic, ...rest];
}

export function effectEntries(p: Profile, season: SeasonName): ShopEntry[] {
  const owned = ownedTiers(p, 'effect');
  const eq = equippedTier(p, 'effect') || 'standard';
  return CATCH_EFFECTS.filter((t) => t.price === 0 || shopSeasonOK(t, owned, season)).map((t): ShopEntry => ({
    ...t, track: 'effect', owned: t.price === 0 || owned.includes(t.id), equipped: eq === t.id,
  }));
}

export type ShopResult = { ok: boolean; message: string; profile: Profile };

const priceOf = (id: string) => [...MAP_PIN_STYLES, ...CATCH_EFFECTS].find((t) => t.id === id)?.price ?? null;

/** Spend Orbs once, own it, and wear it (like buyCosmetic). Never mutates the input. */
export function buyItem(profileIn: Profile, track: Track, id: string): ShopResult {
  const profile = JSON.parse(JSON.stringify(profileIn)) as Profile;
  const price = priceOf(id);
  if (price == null) return { ok: false, message: 'NOT FOR SALE', profile: profileIn };
  const c = (profile.cosmetics = (profile.cosmetics || {}) as Cos);
  const owned: string[] = (c[track + 'Owned'] = c[track + 'Owned'] || []);
  if (owned.includes(id) || price === 0) return { ok: false, message: 'ALREADY YOURS', profile: profileIn };
  const orbs = (profile.orbs as number) || 0;
  if (orbs < price) return { ok: false, message: `NOT ENOUGH ORBS — NEED ${price}`, profile: profileIn };
  profile.orbs = orbs - price;
  owned.push(id);
  c[track] = id;
  return { ok: true, message: 'EQUIPPED', profile };
}

export function equipItem(profileIn: Profile, track: Track, id: string): ShopResult {
  const profile = JSON.parse(JSON.stringify(profileIn)) as Profile;
  const free = id === 'classic' || id === 'standard';
  if (!free && !ownedTiers(profile, track).includes(id)) return { ok: false, message: 'NOT OWNED', profile: profileIn };
  const c = (profile.cosmetics = (profile.cosmetics || {}) as Cos);
  c[track] = id;
  return { ok: true, message: 'EQUIPPED', profile };
}

/** Art for a catch pin, one of six rarity colours per shape, from the live badge-icon store. */
export const pinArtURL = (origin: string, markerId: string, rarity: string) =>
  `${origin}/api/badgeicon?key=${markerId}-${rarity.toLowerCase()}&v=2`;
