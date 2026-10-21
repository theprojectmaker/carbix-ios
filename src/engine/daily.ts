import { CH_POOL, type Challenge } from './chPool';
import { colorMatchesFamily } from './quests';
import { dateKeyET } from './store';
import type { Car, CatalogEntry, Catch, Profile } from './types';
import { catchXP } from './xp';

/* The Home "Today" board: car of the day, spotlight colour, three daily challenges, and the
   per-catch bonus stack. Date-hashed exactly like the web app, so every device agrees. */

export const SPOTLIGHT_COLORS = ['Red', 'Blue', 'White', 'Black', 'Silver', 'Grey', 'Green', 'Yellow', 'Orange', 'Brown'];
export const SPOT_HEX: Record<string, string> = {
  Red: '#C33', Blue: '#36C', White: '#EEE', Black: '#1A1A1A', Silver: '#BBB',
  Grey: '#888', Green: '#4A5', Yellow: '#DC3', Orange: '#E73', Brown: '#853',
};

const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

export function spotlightColor(day = dateKeyET()): string {
  return SPOTLIGHT_COLORS[hash(day + 'spotlight') % SPOTLIGHT_COLORS.length];
}

/** One featured car per day, the same for everyone; catching it pays double. */
export function cotd(catalog: CatalogEntry[], day = dateKeyET()): CatalogEntry {
  const pool = catalog.filter((c) => c.rarity !== 'Legendary' && c.rarity !== 'Mythic');
  return pool[hash(day) % pool.length];
}

export function dailyChallenges(day = dateKeyET()): { day: string; list: Challenge[] } {
  const h = hash(day);
  const picks: Challenge[] = [];
  const used = new Set<number>();
  for (let i = 0; picks.length < 3 && i < 40; i++) {
    const idx = (h + i * 7) % CH_POOL.length;
    if (!used.has(idx)) {
      used.add(idx);
      picks.push(CH_POOL[idx]);
    }
  }
  return { day, list: picks };
}

export type ChallengeState = Challenge & { prog: number; done: boolean };

/** Today's challenge progress; any newly completed one pays its XP once (profile.chDone). */
export function evalChallenges(garage: Catch[], profileIn: Profile, now = new Date()): { profile: Profile; list: ChallengeState[]; won: Challenge[] } {
  const profile = JSON.parse(JSON.stringify(profileIn)) as Profile;
  const { day, list } = dailyChallenges(dateKeyET(now));
  const done = (profile.chDone = (profile.chDone || {}) as Record<string, number>);
  const today = garage.filter((g) => dateKeyET(new Date(g.ts)) === day);
  const won: Challenge[] = [];
  const out = list.map((c) => {
    const prog = Math.min(c.n, today.filter((g) => { try { return c.test(g.car); } catch { return false; } }).length);
    const key = `${day}|${c.id}`;
    if (prog >= c.n && !done[key]) {
      done[key] = 1;
      profile.bonusXP = (profile.bonusXP || 0) + c.xp;
      won.push(c);
    }
    return { ...c, prog, done: !!done[key] };
  });
  return { profile, list: out, won };
}

export type Bonus = { label: string; xp: number; orbs?: number };

/**
 * The XP bonus stack for ONE new catch, in the web app's order: shiny, first catch of the day,
 * car of the day, spotlight colour, then the 10-minute combo chain.
 */
export function catchBonuses(
  catalog: CatalogEntry[], car: Car, opts: { shiny: boolean; firstToday: boolean; hit: CatalogEntry | null; comboN: number; starred?: boolean; now?: Date },
): Bonus[] {
  const out: Bonus[] = [];
  const base = catchXP(car);
  const day = dateKeyET(opts.now);
  if (opts.shiny) out.push({ label: 'SHINY', xp: 17, orbs: 5 });
  if (opts.firstToday) out.push({ label: 'FIRST CATCH TODAY — DOUBLE XP', xp: base });
  if (opts.hit && opts.hit.n === cotd(catalog, day).n) out.push({ label: 'CAR OF THE DAY — 2× XP', xp: base });
  if (colorMatchesFamily(car, spotlightColor(day))) out.push({ label: `SPOTLIGHT COLOR — +${Math.round(base * 0.5)} XP`, xp: Math.round(base * 0.5) });
  if (opts.starred) out.push({ label: 'TARGET ACQUIRED - +25 XP', xp: 25 });
  if (opts.comboN >= 2) {
    const cx = Math.round(base * 0.25 * Math.min(opts.comboN - 1, 4));
    out.push({ label: `COMBO ×${opts.comboN} — +${cx} XP`, xp: cx });
  }
  return out;
}

/** Combo chain: catches within 10 minutes of the last one stack; returns the new count. */
export function nextCombo(prev: { ts: number; n: number } | undefined, now = Date.now()): { ts: number; n: number } {
  return { ts: now, n: prev && now - (prev.ts || 0) < 600000 ? (prev.n || 1) + 1 : 1 };
}
