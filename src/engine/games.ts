import { CATALOG } from './data';
import { dateKeyET } from './store';
import type { Car, Catch, CatalogEntry, Profile } from './types';
import { RTIER } from './xp';

/* ---------- seeded randomness: the same board for everyone on a given day ---------- */
function seedFrom(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =====================  SPOTTER BINGO  ===================== */
export type BingoTask = { id: string; label: string; test: (c: Car) => boolean };

const has = (v: unknown, ...words: string[]) => {
  const s = String(v ?? '').toLowerCase();
  return words.some((w) => s.includes(w));
};
const startYear = (c: Car) => parseInt(String(c.yearRange ?? ''), 10) || 0;

export const BINGO_POOL: BingoTask[] = [
  { id: 'red', label: 'A RED CAR', test: (c) => has(c.color, 'red') },
  { id: 'white', label: 'A WHITE CAR', test: (c) => has(c.color, 'white') },
  { id: 'black', label: 'A BLACK CAR', test: (c) => has(c.color, 'black') },
  { id: 'blue', label: 'A BLUE CAR', test: (c) => has(c.color, 'blue') },
  { id: 'silver', label: 'A SILVER OR GREY CAR', test: (c) => has(c.color, 'silver', 'gray', 'grey') },
  { id: 'suv', label: 'AN SUV', test: (c) => has(c.class, 'suv', 'offroad') },
  { id: 'truck', label: 'A TRUCK OR VAN', test: (c) => has(c.class, 'truck', 'van') },
  { id: 'sedan', label: 'A SEDAN', test: (c) => has(c.class, 'sedan') },
  { id: 'hatch', label: 'A HATCHBACK', test: (c) => has(c.class, 'hatch') },
  { id: 'sport', label: 'A SPORTS CAR', test: (c) => has(c.class, 'sport', 'super', 'hyper', 'muscle') },
  { id: 'classic', label: 'A CLASSIC', test: (c) => has(c.class, 'classic') || (startYear(c) > 0 && startYear(c) < 1985) },
  { id: 'japan', label: 'A JAPANESE CAR', test: (c) => has(c.country, 'japan') },
  { id: 'germany', label: 'A GERMAN CAR', test: (c) => has(c.country, 'german') },
  { id: 'usa', label: 'AN AMERICAN CAR', test: (c) => has(c.country, 'usa', 'united states', 'america') },
  { id: 'italy', label: 'AN ITALIAN CAR', test: (c) => has(c.country, 'ital') },
  { id: 'korea', label: 'A KOREAN CAR', test: (c) => has(c.country, 'korea') },
  { id: 'rare', label: 'A RARE OR BETTER', test: (c) => (RTIER[c.rarity] ?? 0) >= 2 },
  { id: 'epic', label: 'AN EPIC OR BETTER', test: (c) => (RTIER[c.rarity] ?? 0) >= 3 },
  { id: 'old', label: 'BUILT BEFORE 2000', test: (c) => startYear(c) > 0 && startYear(c) < 2000 },
  { id: 'ev', label: 'AN ELECTRIC CAR', test: (c) => has(c.engine, 'electric') || has(c.model, 'tesla') || has(c.make, 'tesla', 'rivian', 'lucid') },
  { id: 'awd', label: 'ALL-WHEEL DRIVE', test: (c) => has(c.drive, 'awd', '4wd', 'all') },
  { id: 'hp300', label: '300+ HORSEPOWER', test: (c) => (c.horsepower ?? 0) >= 300 },
  { id: 'fast', label: '0-60 UNDER 5 SECONDS', test: (c) => parseFloat(String(c.zeroToSixty ?? '99')) < 5 },
];

const FREE: BingoTask = { id: 'free', label: 'CATCH ANY CAR', test: () => true };
export const BINGO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const BINGO_LINE_XP = 10;
export const BINGO_FULL_XP = 50;
export const BINGO_FULL_ORBS = 25;

/** Nine squares for the day, same for everyone; the middle one is always "catch any car". */
export function bingoBoard(day = dateKeyET()): BingoTask[] {
  const rng = mulberry(seedFrom('bingo:' + day));
  const pool = [...BINGO_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const eight = pool.slice(0, 8);
  return [...eight.slice(0, 4), FREE, ...eight.slice(4)];
}

/** The cars you caught on a given Eastern-time day. */
export function catchesOn(garage: Catch[], day = dateKeyET()): Car[] {
  return garage.filter((g) => dateKeyET(new Date(g.ts)) === day).map((g) => g.car);
}

export type BingoState = { board: BingoTask[]; done: boolean[]; lines: number[]; mask: number; full: boolean };

export function bingoState(garage: Catch[], day = dateKeyET()): BingoState {
  const board = bingoBoard(day);
  const cars = catchesOn(garage, day);
  const done = board.map((t) => cars.some((c) => t.test(c)));
  const lines = BINGO_LINES.map((l, i) => (l.every((k) => done[k]) ? i : -1)).filter((i) => i >= 0);
  const full = done.every(Boolean);
  let mask = 0;
  for (const i of lines) mask |= 1 << i;
  if (full) mask |= 1 << 8;
  return { board, done, lines, mask, full };
}

/** Pays out lines and the full board that have not been paid today. Returns the new profile and what was earned. */
export function applyBingo(profileIn: Profile, st: BingoState, day = dateKeyET()): { profile: Profile; xp: number; orbs: number; newLines: number; full: boolean } {
  const p = { ...profileIn } as Profile;
  const paid = p.bingoDay === day ? ((p.bingoPaid as number) || 0) : 0;
  const fresh = st.mask & ~paid;
  let xp = 0;
  let orbs = 0;
  let newLines = 0;
  for (let i = 0; i < 8; i++) if (fresh & (1 << i)) { xp += BINGO_LINE_XP; newLines++; }
  const full = !!(fresh & (1 << 8));
  if (full) { xp += BINGO_FULL_XP; orbs += BINGO_FULL_ORBS; }
  if (!fresh) return { profile: profileIn, xp: 0, orbs: 0, newLines: 0, full: false };
  p.bingoDay = day;
  p.bingoPaid = paid | st.mask;
  p.bonusXP = (p.bonusXP || 0) + xp;
  if (orbs) { p.orbs = ((p.orbs as number) || 0) + orbs; p.orbsAt = Date.now(); }
  p.bingoBest = Math.max((p.bingoBest as number) || 0, st.lines.length + (st.full ? 1 : 0));
  return { profile: p, xp, orbs, newLines, full };
}

/* =====================  HIGHER OR LOWER  ===================== */
export type HiLoStat = 'hp' | 'top' | 'zts';
export const HILO_STATS: Record<HiLoStat, { label: string; unit: string; get: (c: CatalogEntry) => number | null }> = {
  hp: { label: 'HORSEPOWER', unit: ' HP', get: (c) => (c.hp && c.hp > 0 ? c.hp : null) },
  top: { label: 'TOP SPEED', unit: ' MPH', get: (c) => (c.top && c.top > 0 ? c.top : null) },
  zts: { label: '0-60 TIME', unit: ' S', get: (c) => { const v = parseFloat(String(c.zts ?? '')); return v > 0 ? v : null; } },
};
const HILO_POOL = CATALOG.filter((c) => HILO_STATS.hp.get(c) && HILO_STATS.top.get(c) && HILO_STATS.zts.get(c));
export const HILO_DAILY_XP_CAP = 60;
export const HILO_XP_PER_RIGHT = 2;

export function hiloPick(rng: () => number = Math.random): CatalogEntry {
  return HILO_POOL[Math.floor(rng() * HILO_POOL.length)];
}

/** A new round: a stat and a car whose value differs from the one on the table. */
export function hiloRound(left: CatalogEntry, rng: () => number = Math.random): { stat: HiLoStat; right: CatalogEntry } {
  const stats: HiLoStat[] = ['hp', 'top', 'zts'];
  const stat = stats[Math.floor(rng() * stats.length)];
  const lv = HILO_STATS[stat].get(left);
  for (let i = 0; i < 60; i++) {
    const right = hiloPick(rng);
    const rv = HILO_STATS[stat].get(right);
    if (right.n !== left.n && rv !== null && rv !== lv) return { stat, right };
  }
  return { stat, right: HILO_POOL.find((c) => c.n !== left.n && HILO_STATS[stat].get(c) !== lv) ?? left };
}

/** Right answer: 2 XP, up to 60 XP a day, and the best streak is remembered. */
export function hiloCorrect(profileIn: Profile, streak: number, day = dateKeyET()): { profile: Profile; xp: number } {
  const p = { ...profileIn } as Profile;
  const used = p.hiloDay === day ? ((p.hiloXp as number) || 0) : 0;
  const xp = Math.max(0, Math.min(HILO_XP_PER_RIGHT, HILO_DAILY_XP_CAP - used));
  p.hiloDay = day;
  p.hiloXp = used + xp;
  p.bonusXP = (p.bonusXP || 0) + xp;
  p.hiloBest = Math.max((p.hiloBest as number) || 0, streak);
  return { profile: p, xp };
}
