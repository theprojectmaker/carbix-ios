import { CATALOG, catalogMatch } from './data';
import { currentSeason } from './quests';
import { dexBitsEncode, streak } from './store';
import type { Catch, Profile } from './types';
import { catchXP, TIER_XP, totalXpFor } from './xp';

/* What a spotter publishes to the public boards: numbers and a caught-bix bitfield. Never photos or locations. */

export function weekStartUTC(ts = Date.now()): number {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}
export const weekKeyOf = (ts = Date.now()) => 'W' + new Date(weekStartUTC(ts)).toISOString().slice(0, 10);

/** Season / week XP are derived: catches scope themselves by timestamp, bonus is a delta from a rollover baseline. */
export function withRollovers(profile: Profile, now = Date.now()): Profile {
  const p = { ...profile } as Profile;
  const sk = currentSeason(new Date(now)).key;
  const sb = p.seasonBase as { key: string; bonus: number } | undefined;
  if (!sb || sb.key !== sk) p.seasonBase = { key: sk, bonus: p.bonusXP || 0 };
  const wk = weekKeyOf(now);
  const wb = p.weekBase as { key: string; bonus: number } | undefined;
  if (!wb || wb.key !== wk) p.weekBase = { key: wk, bonus: p.bonusXP || 0 };
  return p;
}

export function seasonXp(garage: Catch[], profile: Profile, now = Date.now()): number {
  const s = currentSeason(new Date(now));
  const base = (profile.seasonBase as { bonus: number } | undefined)?.bonus ?? profile.bonusXP ?? 0;
  const catches = garage.reduce((a, g) => a + ((g.ts || 0) >= s.start && (g.ts || 0) < s.end ? catchXP(g.car) : 0), 0);
  return catches + Math.max(0, (profile.bonusXP || 0) - base);
}

export function weekXp(garage: Catch[], profile: Profile, now = Date.now()): number {
  const start = weekStartUTC(now);
  const end = start + 7 * 864e5;
  const base = (profile.weekBase as { bonus: number } | undefined)?.bonus ?? profile.bonusXP ?? 0;
  const catches = garage.reduce((a, g) => a + ((g.ts || 0) >= start && (g.ts || 0) < end ? catchXP(g.car) : 0), 0);
  return catches + Math.max(0, (profile.bonusXP || 0) - base);
}

export function publicRow(garage: Catch[], profileIn: Profile, now = Date.now()) {
  const profile = withRollovers(profileIn, now);
  const caught = new Set<number>();
  for (const g of garage) {
    const h = catalogMatch(g.car);
    if (h) caught.add(h.n);
  }
  const best = [...garage].filter((g) => g.car.xpOverride == null).sort((a, b) => (TIER_XP[b.car.rarity] || 0) - (TIER_XP[a.car.rarity] || 0))[0];
  const cos = (profile.cosmetics || {}) as Record<string, string>;
  return {
    token: profile.token, name: profile.name, xp: totalXpFor(garage, profile), caught: garage.length,
    dexCount: caught.size, brands: new Set(garage.map((g) => g.car.make)).size, streak: streak(profile, new Date(now)),
    bestModel: best ? `${best.car.make} ${best.car.model}` : '', bestRarity: best ? best.car.rarity : '',
    avatar: profile.avatar || 0, title: (profile.title as string) || '', shinies: garage.filter((g) => g && g.shiny).length,
    cosProfile: cos.profile || '', cosLb: cos.lb || '',
    seasonXp: seasonXp(garage, profile, now), seasonKey: currentSeason(new Date(now)).key,
    weekXp: weekXp(garage, profile, now), weekKey: weekKeyOf(now),
    dexBits: dexBitsEncode(caught, CATALOG.length),
    clubCode: ((profile.club as { code?: string } | undefined)?.code) || '',
    clubName: ((profile.club as { name?: string } | undefined)?.name) || '',
  };
}
