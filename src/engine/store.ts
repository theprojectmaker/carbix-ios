import type { Catch, Profile } from './types';
import { catchXP } from './xp';

/** Storage keys are the web app's, unchanged, so a backup or cloud save from the PWA drops straight in. */
export const KEYS = {
  garage: 'motordex.garage',
  profile: 'motordex.profile',
  notifications: 'motordex.notifications',
  cool: 'motordex.cool',
} as const;

export interface KV {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}

const ET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
export const dateKeyET = (d?: Date) => ET.format(d ?? new Date());

const rand = () => Math.random().toString(36).slice(2);

export function newProfile(): Profile {
  return {
    name: '@spotter',
    lic: 'CBX-' + rand().slice(0, 6).toUpperCase(),
    issued: dateKeyET(),
    days: [],
    token: 't' + Date.now() + rand(),
    friends: [],
    username: 'spotter',
    displayName: 'spotter',
    avatar: 0,
    consumables: { xpCharm: 0, streakSaverCharges: 0 },
    questOverrides: {},
    nativeIcons: { owned: [], equipped: null },
  };
}

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

/** Same self-heals the web app runs at load: bad rarity -> Common, duplicate ids dropped, defaults filled. */
export function normalizeGarage(list: unknown): Catch[] {
  const seen = new Set<number>();
  const out: Catch[] = [];
  for (const g of Array.isArray(list) ? (list as Catch[]) : []) {
    if (!g || !g.car || seen.has(g.id)) continue;
    seen.add(g.id);
    if (!RARITIES.includes(g.car.rarity)) g.car.rarity = 'Common';
    out.push(g);
  }
  return out;
}

export function normalizeProfile(p: Partial<Profile> | null): Profile {
  const base = { ...newProfile(), ...(p || {}) } as Profile;
  base.days = base.days || [];
  base.friends = base.friends || [];
  base.username = base.username || (base.name || '@spotter').replace(/^@/, '');
  base.displayName = base.displayName || base.username;
  base.name = '@' + base.username;
  base.avatar = base.avatar || 0;
  base.consumables = base.consumables || { xpCharm: 0, streakSaverCharges: 0 };
  base.questOverrides = base.questOverrides || {};
  base.nativeIcons = base.nativeIcons || { owned: [], equipped: null };
  const remap: Record<string, string> = { iron: 'common', gold: 'rare', diamond: 'epic' };
  const cos = (base.cosmetics = (base.cosmetics || {}) as Record<string, unknown>);
  for (const track of ['profile', 'lb', 'logo']) {
    const cur = cos[track];
    if (typeof cur === 'string' && remap[cur]) cos[track] = remap[cur];
    const ownedKey = track + 'Owned';
    const owned = cos[ownedKey];
    if (Array.isArray(owned)) cos[ownedKey] = [...new Set(owned.map((t: string) => remap[t] || t))];
  }
  return base;
}

export function parseJSON<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function loadAll(kv: KV): Promise<{ garage: Catch[]; profile: Profile }> {
  const garage = normalizeGarage(parseJSON(await kv.getItem(KEYS.garage), []));
  const profile = normalizeProfile(parseJSON<Partial<Profile> | null>(await kv.getItem(KEYS.profile), null));
  return { garage, profile };
}

export async function saveAll(kv: KV, garage: Catch[], profile: Profile) {
  await kv.setItem(KEYS.garage, JSON.stringify(garage));
  await kv.setItem(KEYS.profile, JSON.stringify(profile));
}

export const totalXp = (garage: Catch[], profile: Pick<Profile, 'bonusXP'>) =>
  garage.reduce((a, g) => a + catchXP(g.car), 0) + (profile.bonusXP || 0);

export function markDay(profile: Profile, d = dateKeyET()) {
  if (!profile.days.includes(d)) profile.days.push(d);
}

export function streak(profile: Pick<Profile, 'days'>, today = new Date()): number {
  let n = 0;
  const t = new Date(today);
  for (;;) {
    const d = dateKeyET(t);
    if (profile.days.includes(d)) {
      n++;
      t.setDate(t.getDate() - 1);
    } else if (n === 0 && d === dateKeyET(today)) {
      t.setDate(t.getDate() - 1);
      if (!profile.days.includes(dateKeyET(t))) break;
    } else break;
  }
  return n;
}

/** Bit (n-1) set = catalog #n caught; base64, same as the web leaderboard bitfield. */
export function dexBitsEncode(ns: Iterable<number>, catalogSize: number): string {
  const bytes = new Uint8Array(Math.ceil((catalogSize + 1) / 8));
  for (const n of ns) {
    const i = n - 1;
    if (i >= 0) bytes[i >> 3] |= 1 << (i & 7);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function dexBitsDecode(b64: string): Set<number> {
  const out = new Set<number>();
  try {
    const s = atob(String(b64 || ''));
    for (let i = 0; i < s.length; i++) {
      const b = s.charCodeAt(i);
      if (!b) continue;
      for (let k = 0; k < 8; k++) if (b & (1 << k)) out.add(i * 8 + k + 1);
    }
  } catch {
    /* ignore a bad bitfield */
  }
  return out;
}

/** Roughly 1 in 50 catches is shiny (web: 1/50, doubled during Chrome Hour). */
export const shinyRoll = (odds = 50, rnd = Math.random) => rnd() * odds < 1;

/** Backup files written by the web app carry app:"motordex" plus the two stores. */
export function parseBackup(text: string): { garage: Catch[]; profile: Profile } | null {
  const j = parseJSON<Record<string, unknown> | null>(text, null);
  if (!j || typeof j !== 'object') return null;
  const src = (j.data && typeof j.data === 'object' ? j.data : j) as Record<string, unknown>;
  const g = src.garage ?? (src['motordex.garage'] as unknown);
  if (!g) return null;
  const garage = normalizeGarage(typeof g === 'string' ? parseJSON(g, []) : g);
  const p = src.profile ?? (src['motordex.profile'] as unknown);
  const profile = normalizeProfile(typeof p === 'string' ? parseJSON(p, null) : (p as Partial<Profile> | null));
  return { garage, profile };
}
