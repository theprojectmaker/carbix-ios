import { CATALOG, catalogMatch } from './data';
import { currentSeason } from './quests';
import { dateKeyET } from './store';
import type { CatalogEntry, Catch, Profile } from './types';
import { levelFor, totalXpFor } from './xp';
import { garageValueRaw } from './badges';

/* Exam, collection sets, titles, trophy room data. Ported 1:1 from the web app. */

/** Seeded per-day randomness so everyone gets the same exam. */
export function dayRand(salt: string, day = dateKeyET()): () => number {
  let h = 2166136261;
  for (const ch of day + salt) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export type ExamQ = { c: CatalogEntry; opts: CatalogEntry[] };

export function examQuestions(day = dateKeyET()): ExamQ[] {
  const r = dayRand('exam', day);
  const pool = CATALOG.filter((c) => c.rarity !== 'Mythic');
  const qs: ExamQ[] = [];
  const used = new Set<number>();
  while (qs.length < 5) {
    const c = pool[Math.floor(r() * pool.length)];
    if (used.has(c.n)) continue;
    used.add(c.n);
    const wrong: CatalogEntry[] = [];
    const wused = new Set<number>([c.n]);
    let guard = 0;
    while (wrong.length < 3 && guard++ < 400) {
      const w = pool[Math.floor(r() * pool.length)];
      if (wused.has(w.n) || (w.make === c.make && w.model === c.model)) continue;
      if (wrong.length < 2 && w.cls !== c.cls && guard < 200) continue;
      wused.add(w.n);
      wrong.push(w);
    }
    const opts = [c, ...wrong];
    for (let i = opts.length - 1; i > 0; i--) {
      const k = Math.floor(r() * (i + 1));
      [opts[i], opts[k]] = [opts[k], opts[i]];
    }
    qs.push({ c, opts });
  }
  return qs;
}

/** Applies a finished exam: +3 XP per right answer, perfect count, and today's marker. */
export function finishExam(profileIn: Profile, score: number, day = dateKeyET()): Profile {
  const p = { ...profileIn } as Profile;
  p.examDay = day;
  p.examLast = score;
  p.bonusXP = (p.bonusXP || 0) + score * 3;
  if (score === 5) p.examPerfect = ((p.examPerfect as number) || 0) + 1;
  return p;
}

export const SPIN_PRIZES = [10, 10, 15, 15, 20, 20, 25, 30, 40, 50, 75, 100];
export function finishSpin(profileIn: Profile, prize: number, day = dateKeyET()): Profile {
  const p = { ...profileIn } as Profile;
  p.spinDay = day;
  p.spinLast = prize;
  p.bonusXP = (p.bonusXP || 0) + prize;
  return p;
}

/* ---------- collection sets ---------- */
export const SETS: [string, (c: CatalogEntry) => boolean][] = [
  ['911 FAMILY', (c) => c.make === 'Porsche' && /911/.test(c.model)],
  ['JDM LEGENDS', (c) => /supra|skyline|gt-?r\b|rx-?[78]|nsx|silvia|350z|370z|wrx|evolution|type r|integra|miata|mx-5|brz/i.test(c.model)],
  ['MUSCLE ROW', (c) => /mustang|camaro|challenger|charger|corvette|gto\b|chevelle|barracuda|firebird|trans am/i.test(c.model)],
  ['EV FLEET', (c) => ['Tesla', 'Rivian', 'Polestar', 'Lucid', 'NIO'].includes(c.make) || /electric/i.test(c.eng || '')],
  ['OFFROAD PACK', (c) => c.cls === 'OFFROAD' || /wrangler|bronco\b|defender|land cruiser|g-class|4runner|hummer|gladiator/i.test(c.model)],
  ['EXOTIC SHELF', (c) => ['Ferrari', 'Lamborghini', 'McLaren', 'Bugatti', 'Koenigsegg', 'Pagani'].includes(c.make)],
  ['PICKUP LINE', (c) => c.cls === 'TRUCK'],
  ['SUV SQUAD', (c) => c.cls === 'SUV'],
  ['HOT HATCH CREW', (c) => c.cls === 'HATCH'],
  ['HYPERCAR VAULT', (c) => c.cls === 'HYPER'],
  ['LUXURY LINE', (c) => c.cls === 'LUXURY'],
  ['CLASSIC GARAGE', (c) => c.cls === 'CLASSIC'],
  ['VAN LIFE', (c) => c.cls === 'VAN'],
  ['ITALIAN JOB', (c) => ['Maserati', 'Alfa Romeo', 'Fiat', 'Lancia', 'Abarth'].includes(c.make)],
];

export function setProgress(garage: Catch[]) {
  const have = new Set<number>();
  for (const g of garage) {
    const h = catalogMatch(g.car);
    if (h) have.add(h.n);
  }
  return SETS.map(([nm, fn]) => {
    const all = CATALOG.filter((c) => {
      try { return fn(c); } catch { return false; }
    });
    const got = all.filter((c) => have.has(c.n)).length;
    return { nm, got, tot: all.length, done: all.length > 0 && got >= all.length };
  });
}

/* ---------- titles ---------- */
export type TitleDef = { name: string; hint: string; ok: (garage: Catch[], p: Profile) => boolean };
const dexPct = (garage: Catch[]) => {
  const s = new Set<number>();
  for (const g of garage) {
    const h = catalogMatch(g.car);
    if (h) s.add(h.n);
  }
  return CATALOG.length ? (s.size / CATALOG.length) * 100 : 0;
};
export const TITLES: TitleDef[] = [
  { name: 'ROOKIE SPOTTER', hint: 'everyone starts here', ok: () => true },
  { name: 'STREET SCOUT', hint: '25 catches', ok: (g) => g.length >= 25 },
  { name: 'LOT LURKER', hint: '100 catches', ok: (g) => g.length >= 100 },
  { name: 'SHINY HUNTER', hint: '3 shinies', ok: (g) => g.filter((x) => x && x.shiny).length >= 3 },
  { name: 'TARGET MASTER', hint: '5 starred targets caught', ok: (_g, p) => ((p.targets as number) || 0) >= 5 },
  { name: 'MILLIONAIRE', hint: '$1M collection', ok: (g) => garageValueRaw(g) >= 1e6 },
  { name: 'EXAM ACE', hint: 'a perfect exam', ok: (_g, p) => ((p.examPerfect as number) || 0) >= 1 },
  { name: 'NIGHT OWL', hint: 'a catch after 10pm', ok: (g) => g.some((x) => { const h = new Date(x.ts).getHours(); return h >= 22 || h < 4; }) },
  { name: 'COMBO KING', hint: 'a x4 combo', ok: (_g, p) => ((p.bestCombo as number) || 0) >= 4 },
  { name: 'HALF CENTURY', hint: 'level 50', ok: (g, p) => levelFor(totalXpFor(g, p)) >= 50 },
  { name: 'THE COMPLETIONIST', hint: 'half the bix', ok: (g) => dexPct(g) >= 50 },
];

/* ---------- seasons, era months, trophy room ---------- */
export const SEASON_THEMES = [
  { label: 'SPORTS SEASON', test: (c: Catch['car']) => /SPORT|SUPER|MUSCLE/i.test(c.class || ''), n: 12, bg: 'sunset' },
  { label: 'WORKHORSE SEASON', test: (c: Catch['car']) => /TRUCK|VAN|OFFROAD|SUV/i.test(c.class || ''), n: 12, bg: 'forest' },
  { label: 'IMPORT SEASON', test: (c: Catch['car']) => !/USA|AMERICA/i.test(String(c.country || '')), n: 15, bg: 'midnight' },
  { label: 'LUXURY SEASON', test: (c: Catch['car']) => /LUXURY|SUPER|HYPER/i.test(c.class || '') || ['Epic', 'Legendary', 'Mythic'].includes(c.rarity), n: 8, bg: 'champagne' },
];

export function seasonTheme(now = new Date()) {
  const d = dateKeyET(now);
  const yr = Number(d.slice(0, 4));
  const q = Math.floor((Number(d.slice(5, 7)) - 1) / 3);
  return SEASON_THEMES[(yr * 4 + q) % SEASON_THEMES.length];
}

export function seasonProgress(garage: Catch[], now = new Date()): number {
  const s = currentSeason(now);
  const th = seasonTheme(now);
  return garage.filter((g) => {
    if (!g || !g.car || !(g.ts >= s.start && g.ts < s.end)) return false;
    try { return th.test(g.car); } catch { return false; }
  }).length;
}

export const ERA_DECADES: [number, number, string][] = [
  [1970, 1980, 'THE 1970s'], [1980, 1990, 'THE 1980s'], [1990, 2000, 'THE 1990s'],
  [2000, 2010, 'THE 2000s'], [2010, 2020, 'THE 2010s'], [2020, 2030, 'THE 2020s'],
];

export function currentEra(now = new Date()) {
  const d = dateKeyET(now);
  const ym = d.slice(0, 7);
  const idx = (Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7))) % ERA_DECADES.length;
  return { ym, dec: ERA_DECADES[idx] };
}

export function eraProgress(garage: Catch[], e = currentEra()): number {
  return garage.filter((g) => {
    if (!g || !g.car) return false;
    if (dateKeyET(new Date(g.ts)).slice(0, 7) !== e.ym) return false;
    const y = parseInt(String(g.car.yearRange)) || 0;
    return y >= e.dec[0] && y < e.dec[1];
  }).length;
}

export type Medal = { mk: string; pct: number; got: number; total: number; medal: 'GOLD' | 'SILVER' | 'BRONZE' };
export function marqueMedals(garage: Catch[]): Medal[] {
  const per: Record<string, { total: number; got: Set<number> }> = {};
  for (const c of CATALOG) (per[c.make] = per[c.make] || { total: 0, got: new Set() }).total++;
  for (const g of garage) {
    const h = catalogMatch(g.car);
    if (h && per[h.make]) per[h.make].got.add(h.n);
  }
  return Object.entries(per)
    .filter(([, v]) => v.total >= 4 && v.got.size > 0)
    .map(([mk, v]) => ({ mk, pct: (v.got.size / v.total) * 100, got: v.got.size, total: v.total }))
    .map((m) => ({ ...m, medal: (m.pct >= 100 ? 'GOLD' : m.pct >= 50 ? 'SILVER' : m.pct >= 25 ? 'BRONZE' : null) as Medal['medal'] }))
    .filter((m) => m.medal)
    .sort((a, b) => b.pct - a.pct);
}

export const MEDAL_ORBS = { BRONZE: 5, SILVER: 10, GOLD: 25 };

export function lineagePlaques(garage: Catch[]) {
  const fams: Record<string, number[]> = {};
  for (const c of CATALOG) {
    const base = String(c.model).split(' ')[0].toUpperCase();
    if (base.length < 3) continue;
    (fams[c.make + '|' + base] = fams[c.make + '|' + base] || []).push(c.n);
  }
  const have = new Set<number>();
  for (const g of garage) {
    const h = catalogMatch(g.car);
    if (h) have.add(h.n);
  }
  return Object.entries(fams)
    .filter(([, ns]) => ns.length >= 3 && ns.every((n) => have.has(n)))
    .map(([k, ns]) => ({ label: k.replace('|', ' ') + ' FAMILY', n: ns.length }));
}

/** Mints season medals, era stamps and marque medallion Orbs the moment they are earned. */
export function trophyCheck(garage: Catch[], profileIn: Profile, now = new Date()): { profile: Profile; events: string[] } {
  const p = JSON.parse(JSON.stringify(profileIn)) as Profile;
  const events: string[] = [];
  const bounties = (p.marqueBounties = (p.marqueBounties || {}) as Record<string, number>);
  let paid = 0;
  let last: { mk: string; tier: string } | null = null;
  for (const m of marqueMedals(garage)) {
    for (const [tier, need] of [['BRONZE', 25], ['SILVER', 50], ['GOLD', 100]] as const) {
      const k = m.mk + ':' + tier;
      if (m.pct >= need && !bounties[k]) {
        bounties[k] = 1;
        p.orbs = ((p.orbs as number) || 0) + MEDAL_ORBS[tier];
        paid += MEDAL_ORBS[tier];
        last = { mk: m.mk, tier };
      }
    }
  }
  if (paid) events.push(`${last ? last.tier + ' MEDALLION - ' + last.mk.toUpperCase() + ' - ' : 'MEDALLIONS - '}+${paid} ORBS`);
  const s = currentSeason(now);
  const th = seasonTheme(now);
  const medals = (p.seasonMedals = (p.seasonMedals || {}) as Record<string, unknown>);
  if (!medals[s.key] && seasonProgress(garage, now) >= th.n) {
    medals[s.key] = { name: s.name, theme: th.label, bg: th.bg };
    events.push(`SEASON COMPLETE - ${s.name} MEDAL`);
  }
  const e = currentEra(now);
  const stamps = (p.eraStamps = (p.eraStamps || {}) as Record<string, string>);
  if (!stamps[e.ym] && eraProgress(garage, e) >= 10) {
    stamps[e.ym] = e.dec[2];
    events.push(`PASSPORT STAMPED - ${e.dec[2]}`);
  }
  return { profile: p, events };
}
