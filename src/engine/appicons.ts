import type { Profile } from './types';

/* Home-screen icon packs, one per season quarter, sold for Orbs. Same ids, names, prices and art as the website game's
   SEASON_APP_ICONS, and the same "<seasonKey>::<iconId>" ownership ids, so purchases follow the account both ways.
   Each pack is a one-shot collectible: only the current quarter's pack can be bought, but anything you own stays yours. */
export type AppIcon = { id: string; name: string; price: number; thumb: string };
const ART = 'https://motordex.pages.dev/appicons/';

export const SEASON_APP_ICONS: Record<string, AppIcon[]> = {
  '2026Q3': [
    { id: 'beach', name: 'SUNSET CRUISER', price: 60, thumb: ART + 'season1/icon1.png' },
    { id: 'surfvan', name: 'SURF VAN', price: 75, thumb: ART + 'season1/icon4.png' },
    { id: 'boardwalk', name: 'THE WOODY', price: 85, thumb: ART + 'season1/icon3.png' },
    { id: 'drivein', name: 'GOLDEN HOUR', price: 100, thumb: ART + 'season1/icon6.png' },
  ],
  '2026Q4': [
    { id: 'maple', name: 'MAPLE RUN', price: 60, thumb: ART + 'season2/icon1-thumb.png' },
    { id: 'pumpkin', name: 'PUMPKIN PATCH', price: 75, thumb: ART + 'season2/icon2-thumb.png' },
    { id: 'hayride', name: 'HAYRIDE', price: 85, thumb: ART + 'season2/icon3-thumb.png' },
    { id: 'frost', name: 'FIRST FROST', price: 100, thumb: ART + 'season2/icon4-thumb.png' },
  ],
};

/** The icon ids this build actually contains (see the expo-alternate-app-icons list in app.json). */
export const BUILT_IN_ICONS = ['maple', 'pumpkin', 'hayride', 'frost'];

type NI = { owned: string[]; equipped: string | null };
const ni = (p: Profile): NI => (p.nativeIcons as NI | undefined) ?? { owned: [], equipped: null };

export const ownedKey = (seasonKey: string, id: string) => `${seasonKey}::${id}`;
export const iconOwned = (p: Profile, seasonKey: string, id: string) => ni(p).owned.includes(ownedKey(seasonKey, id));
export const iconEquipped = (p: Profile): string | null => ni(p).equipped;

export type IconResult = { ok: boolean; message: string; profile: Profile };

/** Spend Orbs on an icon for the current season; never mutates the input. */
export function buyIcon(profileIn: Profile, seasonKey: string, currentKey: string, id: string): IconResult {
  const def = (SEASON_APP_ICONS[seasonKey] || []).find((i) => i.id === id);
  if (!def) return { ok: false, message: 'NOT FOR SALE', profile: profileIn };
  if (seasonKey !== currentKey) return { ok: false, message: "THIS SEASON'S SET HAS MOVED ON", profile: profileIn };
  if (!BUILT_IN_ICONS.includes(id)) return { ok: false, message: 'UPDATE THE APP TO GET THIS ICON', profile: profileIn };
  if (iconOwned(profileIn, seasonKey, id)) return { ok: false, message: 'ALREADY YOURS', profile: profileIn };
  const orbs = (profileIn.orbs as number) || 0;
  if (orbs < def.price) return { ok: false, message: `NOT ENOUGH ORBS — NEED ${def.price}`, profile: profileIn };
  const p = JSON.parse(JSON.stringify(profileIn)) as Profile;
  p.orbs = orbs - def.price;
  const n = ni(p);
  n.owned = [...n.owned, ownedKey(seasonKey, id)];
  n.equipped = ownedKey(seasonKey, id);
  p.nativeIcons = n;
  return { ok: true, message: `${def.name} BOUGHT`, profile: p };
}

/** Pick which owned icon is worn; null goes back to the default Carbix icon. */
export function equipIcon(profileIn: Profile, owned: string | null): IconResult {
  if (owned && !ni(profileIn).owned.includes(owned)) return { ok: false, message: 'NOT OWNED', profile: profileIn };
  const p = JSON.parse(JSON.stringify(profileIn)) as Profile;
  p.nativeIcons = { ...ni(p), equipped: owned };
  return { ok: true, message: owned ? 'ICON EQUIPPED' : 'DEFAULT ICON', profile: p };
}
