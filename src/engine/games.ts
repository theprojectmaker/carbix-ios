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

/* =====================  CARD BATTLE  ===================== */
export type BattleStat = 'hp' | 'top' | 'zts' | 'value';
export const BATTLE_STATS: Record<BattleStat, { label: string; unit: string; lowerWins?: boolean; get: (c: CatalogEntry) => number | null }> = {
  hp: { label: 'POWER', unit: ' HP', get: (c) => (c.hp && c.hp > 0 ? c.hp : null) },
  top: { label: 'TOP SPEED', unit: ' MPH', get: (c) => (c.top && c.top > 0 ? c.top : null) },
  zts: { label: '0-60 (QUICKEST WINS)', unit: ' S', lowerWins: true, get: (c) => { const v = parseFloat(String(c.zts ?? '')); return v > 0 ? v : null; } },
  value: { label: 'VALUE', unit: '', get: (c) => (c.low && c.high ? Math.round((c.low + c.high) / 2) : null) },
};
const BATTLE_POOL = CATALOG.filter((c) => (['hp', 'top', 'zts', 'value'] as BattleStat[]).every((k) => BATTLE_STATS[k].get(c) !== null));
export const BATTLE_WINS_PAID_PER_DAY = 3;
export const BATTLE_WIN_XP = 20;

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Battle = { mine: CatalogEntry[]; theirs: CatalogEntry[]; stats: BattleStat[] };

/** Five of your cars against five of a rival's of about the same tier, over five random stats. Short garages are topped up with commons. */
export function battleDeal(owned: CatalogEntry[], rng: () => number = Math.random): Battle {
  const usable = owned.filter((c) => BATTLE_POOL.some((p) => p.n === c.n));
  const mine = shuffled(usable, rng).slice(0, 5);
  const commons = shuffled(BATTLE_POOL.filter((c) => (RTIER[c.rarity] ?? 0) <= 1 && !mine.some((m) => m.n === c.n)), rng);
  while (mine.length < 5) mine.push(commons.pop() as CatalogEntry);
  const avg = mine.reduce((a, c) => a + (RTIER[c.rarity] ?? 0), 0) / mine.length;
  const near = BATTLE_POOL.filter((c) => Math.abs((RTIER[c.rarity] ?? 0) - avg) <= 1 && !mine.some((m) => m.n === c.n));
  const theirs = shuffled(near.length >= 5 ? near : BATTLE_POOL, rng).slice(0, 5);
  const all: BattleStat[] = ['hp', 'top', 'zts', 'value'];
  const stats: BattleStat[] = [];
  const bag = shuffled(all, rng);
  for (let i = 0; i < 5; i++) stats.push(i < 4 ? bag[i] : all[Math.floor(rng() * 4)]);
  return { mine, theirs, stats: shuffled(stats, rng) };
}

/** 1 = you win the round, -1 = they do, 0 = a draw. */
export function battleRound(stat: BattleStat, mine: CatalogEntry, theirs: CatalogEntry): 1 | -1 | 0 {
  const d = BATTLE_STATS[stat];
  const a = d.get(mine) ?? 0;
  const b = d.get(theirs) ?? 0;
  if (a === b) return 0;
  return (d.lowerWins ? a < b : a > b) ? 1 : -1;
}

/** Win a battle (3 rounds of 5) for 20 XP, the first 3 wins of the day. Streak and best are remembered. */
export function finishBattle(profileIn: Profile, won: boolean, day = dateKeyET()): { profile: Profile; xp: number } {
  const p = { ...profileIn } as Profile;
  const wins = p.battleDay === day ? ((p.battleWins as number) || 0) : 0;
  p.battleDay = day;
  let xp = 0;
  if (won) {
    p.battleStreak = ((p.battleStreak as number) || 0) + 1;
    p.battleBest = Math.max((p.battleBest as number) || 0, p.battleStreak as number);
    if (wins < BATTLE_WINS_PAID_PER_DAY) xp = BATTLE_WIN_XP;
    p.battleWins = wins + 1;
  } else {
    p.battleStreak = 0;
    p.battleWins = wins;
  }
  p.bonusXP = (p.bonusXP || 0) + xp;
  return { profile: p, xp };
}

/* =====================  BRAND CHASE  ===================== */
export type BrandChase = { make: string; have: number; total: number; missing: CatalogEntry[] };

/** The brand you are closest to finishing: most of its cars caught, but not all. Ties go to the bigger set. */
export function brandChase(caught: ReadonlySet<number>, catalog: readonly CatalogEntry[] = CATALOG): BrandChase | null {
  const by = new Map<string, CatalogEntry[]>();
  for (const e of catalog) {
    const l = by.get(e.make);
    if (l) l.push(e); else by.set(e.make, [e]);
  }
  let best: BrandChase | null = null;
  let bestScore = -1;
  for (const [make, list] of by) {
    if (list.length < 3) continue;
    const have = list.filter((e) => caught.has(e.n)).length;
    if (have === 0 || have === list.length) continue;
    const score = have / list.length + list.length / 1e4;
    if (score > bestScore) {
      bestScore = score;
      const rank = (e: CatalogEntry) => RTIER[e.rarity] ?? 0;
      const missing = list.filter((e) => !caught.has(e.n)).sort((a, b) => rank(a) - rank(b)).slice(0, 4);
      best = { make, have, total: list.length, missing };
    }
  }
  return best;
}

/* =====================  WEEK IN REVIEW  ===================== */
export type WeekReview = { catches: number; fresh: number; shinies: number; best: CatalogEntry | null; days: number };

/** The last seven days of catching: how many, how many were new to the Bix, the rarest, and how many days you played. */
export function weekReview(garage: readonly Catch[], now: number, match: (c: Car) => CatalogEntry | null): WeekReview {
  const from = now - 7 * 864e5;
  const firstSeen = new Map<number, number>();
  for (const c of garage) {
    const e = match(c.car);
    if (e) firstSeen.set(e.n, Math.min(firstSeen.get(e.n) ?? Infinity, c.ts));
  }
  const r: WeekReview = { catches: 0, fresh: 0, shinies: 0, best: null, days: 0 };
  const days = new Set<string>();
  for (const c of garage) {
    if (c.ts < from || c.ts > now) continue;
    r.catches++;
    if (c.shiny) r.shinies++;
    days.add(dateKeyET(new Date(c.ts)));
    const e = match(c.car);
    if (!e) continue;
    if (firstSeen.get(e.n) === c.ts) r.fresh++;
    if (!r.best || (RTIER[e.rarity] ?? 0) > (RTIER[r.best.rarity] ?? 0)) r.best = e;
  }
  r.days = days.size;
  return r;
}

/* =====================  STREAK MILESTONES  ===================== */
export const STREAK_MILESTONES: readonly { days: number; orbs: number }[] = [
  { days: 3, orbs: 2 }, { days: 7, orbs: 5 }, { days: 14, orbs: 10 }, { days: 30, orbs: 25 },
  { days: 60, orbs: 40 }, { days: 100, orbs: 75 }, { days: 200, orbs: 150 }, { days: 365, orbs: 300 },
];

/** The milestone this streak has just reached, if it has not been paid yet. Each one pays once, ever. */
export function streakReward(streakDays: number, paid: readonly number[] = []): { days: number; orbs: number } | null {
  const hit = STREAK_MILESTONES.find((m) => m.days === streakDays);
  return hit && !paid.includes(hit.days) ? hit : null;
}

/* =====================  BRAND SET COMPLETE  ===================== */
export const SET_MIN = 3;
export const SET_ORBS = 10;

/** True when every car of a brand (at least SET_MIN of them) is caught and the set has not been paid yet. */
export function setComplete(make: string, caught: ReadonlySet<number>, paid: readonly string[] = [], catalog: readonly CatalogEntry[] = CATALOG): boolean {
  if (paid.includes(make)) return false;
  const list = catalog.filter((e) => e.make === make);
  return list.length >= SET_MIN && list.every((e) => caught.has(e.n));
}
