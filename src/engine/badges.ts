import { norm, popularityScore } from './catalog';
import { CATALOG, catalogMatch } from './data';
import { dateKeyET, streak as streakOf } from './store';
import type { Catch, Profile } from './types';
import { levelFor, TIERS, totalXpFor } from './xp';

/* The badge list, ported 1:1 from the web app's badgeList(): tiered ladders plus a few one-offs,
   all computed fresh from the garage and profile. */

export type Badge = { cat: string; nm: string; ok: boolean; desc: string; prog: number; iconKey: string };

type Stats = {
  n: number; tiers: Record<string, number>; makes: Map<string, number>; classes: Map<string, number>;
  countries: Map<string, number>; models: Map<string, number>; pins: number; notes: number; rareColor: number;
  uncColor: number; hp: number; top: number; quick: number; night: number; dawn: number; weekend: number;
  days: Set<string>; dex: Set<number>; oldest: number; newest: number; ev: number; maxDup: number;
  brands: number; bodies: number; nations: number;
};

export function badgeStats(garage: Catch[]): Stats {
  const s: Stats = {
    n: garage.length, tiers: {}, makes: new Map(), classes: new Map(), countries: new Map(), models: new Map(),
    pins: 0, notes: 0, rareColor: 0, uncColor: 0, hp: 0, top: 0, quick: 99, night: 0, dawn: 0, weekend: 0,
    days: new Set(), dex: new Set(), oldest: 9999, newest: 0, ev: 0, maxDup: 0, brands: 0, bodies: 0, nations: 0,
  };
  for (const g of garage) {
    const c = g.car || ({} as Catch['car']);
    const r = c.rarity || 'Common';
    s.tiers[r] = (s.tiers[r] || 0) + 1;
    if (c.make) s.makes.set(c.make, (s.makes.get(c.make) || 0) + 1);
    if (c.class) s.classes.set(c.class.toUpperCase(), (s.classes.get(c.class.toUpperCase()) || 0) + 1);
    if (c.country) s.countries.set(c.country.toUpperCase(), (s.countries.get(c.country.toUpperCase()) || 0) + 1);
    const mk = norm((c.make || '') + (c.model || ''));
    if (mk) s.models.set(mk, (s.models.get(mk) || 0) + 1);
    if (g.geo) s.pins++;
    if (g.note) s.notes++;
    if (c.colorRarity === 'Rare') s.rareColor++;
    if (c.colorRarity === 'Uncommon') s.uncColor++;
    if ((c.horsepower || 0) > s.hp) s.hp = c.horsepower as number;
    if ((c.topSpeedMph || 0) > s.top) s.top = c.topSpeedMph as number;
    const z = parseFloat(String(c.zeroToSixty));
    if (Number.isFinite(z) && z < s.quick) s.quick = z;
    const d = new Date(g.ts || 0);
    const h = d.getHours();
    if (h >= 22 || h < 5) s.night++;
    if (h >= 5 && h < 8) s.dawn++;
    if (d.getDay() === 0 || d.getDay() === 6) s.weekend++;
    s.days.add(dateKeyET(d));
    const yr = parseInt(String(c.yearRange || '').slice(0, 4));
    if (Number.isFinite(yr) && yr > 1900) {
      if (yr < s.oldest) s.oldest = yr;
      if (yr > s.newest) s.newest = yr;
    }
    if (/electric|ev\b|battery/i.test(String(c.engine || ''))) s.ev++;
    const hit = catalogMatch(c);
    if (hit) s.dex.add(hit.n);
  }
  s.maxDup = Math.max(0, ...s.models.values());
  s.brands = s.makes.size;
  s.bodies = s.classes.size;
  s.nations = s.countries.size;
  return s;
}

function ladder(cat: string, label: string, value: number, steps: number[], unit?: string): Badge[] {
  return steps.map((n) => ({
    cat, nm: `${label} ${n}${unit || ''}`, desc: `${label.toLowerCase()} ${n}${unit || ''}`,
    ok: value >= n, prog: Math.min(1, n ? value / n : 1), iconKey: label,
  }));
}

export function spotMiles(garage: Catch[]): number {
  const gs = garage.filter((g) => g.geo).sort((a, b) => a.ts - b.ts);
  let km = 0;
  for (let i = 1; i < gs.length; i++) {
    const a = gs[i - 1].geo!, b = gs[i].geo!;
    const dLa = ((b.lat - a.lat) * Math.PI) / 180, dLo = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
    km += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return km * 0.621371;
}

export function zonesExplored(garage: Catch[]): number {
  const z = new Set<string>();
  for (const g of garage) if (g.geo) z.add(Math.round(g.geo.lat * 50) + ',' + Math.round(g.geo.lng * 50));
  return z.size;
}

export function garageValueRaw(garage: Catch[]): number {
  let v = 0;
  for (const g of garage) {
    const e = catalogMatch(g.car);
    v += e && e.low && e.high ? (e.low + e.high) / 2 : 8000;
  }
  return v;
}

const sorted = [...CATALOG].sort((a, b) => popularityScore(a) - popularityScore(b));
const POPULAR_ONE = sorted[0];
const RAREST_ONE = sorted[sorted.length - 1];

export function badgeList(garage: Catch[], profile: Profile, now = new Date()): Badge[] {
  const s = badgeStats(garage);
  const B: Badge[] = [];
  const add = (cat: string, nm: string, ok: unknown, desc?: string, iconKey?: string) =>
    B.push({ cat, nm, ok: !!ok, desc: desc || '', prog: ok ? 1 : 0, iconKey: iconKey || nm });
  const questStep = (profile.questStep as number) || 0;
  const xp = totalXpFor(garage, profile);

  [5, 10, 15, 20, 25, 30].forEach((n) => add('SPECIAL', 'SUMMER QUEST ' + n, questStep >= n, 'complete ' + n + ' summer quests in a row', 'SUMMERQ' + n));
  B.push(...ladder('COLLECTOR', 'CATCH', s.n, [1, 5, 10, 25, 50, 100, 150, 250, 400, 600, 1000, 1500, 2500]));
  const pct = CATALOG.length ? (s.dex.size / CATALOG.length) * 100 : 0;
  [0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 25, 33, 40, 50, 60, 66, 75, 85, 90, 95, 100].forEach((p) =>
    add('BIX', `BIX ${p}%`, pct >= p, `fill ${p}% of the bix`, `DEX ${p}%`));
  B.push(...ladder('BIX', 'UNIQUE', s.dex.size, [1, 10, 25, 50, 100, 200, 350, 500, 750, 1000]));
  TIERS.forEach((t) => {
    const have = s.tiers[t] || 0;
    const steps = t === 'Common' ? [1, 10, 50, 150, 400] : t === 'Uncommon' ? [1, 5, 25, 75, 200] : t === 'Rare' ? [1, 5, 15, 40, 100]
      : t === 'Epic' ? [1, 3, 10, 25, 60] : t === 'Legendary' ? [1, 2, 5, 15, 35] : [1, 2, 3, 8, 20];
    B.push(...ladder('RARITY', t.toUpperCase(), have, steps));
  });
  B.push(...ladder('BRANDS', 'BRANDS', s.brands, [2, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100]));
  const MARQUES = ['Ferrari', 'Lamborghini', 'Porsche', 'BMW', 'Mercedes-Benz', 'Audi', 'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Tesla', 'Nissan',
    'Subaru', 'Mazda', 'Jeep', 'Dodge', 'McLaren', 'Bugatti', 'Lexus', 'Volkswagen', 'Volvo', 'Jaguar', 'Land Rover', 'Mini', 'Aston Martin',
    'Maserati', 'Bentley', 'Rolls-Royce', 'Alfa Romeo', 'Hyundai', 'Kia', 'Cadillac', 'Acura', 'Infiniti', 'Genesis', 'Rivian', 'Lucid', 'Pagani',
    'Koenigsegg', 'Lotus'];
  MARQUES.forEach((mk) => add('MARQUES', mk.toUpperCase(), s.makes.has(mk), `catch a ${mk}`));
  const BODIES = ['SEDAN', 'SUV', 'TRUCK', 'COUPE', 'SPORT', 'SUPER', 'HYPER', 'MUSCLE', 'LUXURY', 'OFFROAD', 'HATCH', 'VAN', 'CLASSIC'];
  BODIES.forEach((b) => {
    const have = s.classes.get(b) || 0;
    add('BODY', b, have >= 1, `catch a ${b.toLowerCase()}`);
    add('BODY', `${b} x10`, have >= 10, `catch ten ${b.toLowerCase()}s`);
  });
  add('BODY', 'ALL BODY TYPES', s.bodies >= BODIES.length, 'catch every body style');
  const NATIONS = ['JAPAN', 'GERMANY', 'ITALY', 'USA', 'UNITED KINGDOM', 'SOUTH KOREA', 'FRANCE', 'SWEDEN', 'CZECH REPUBLIC', 'SPAIN', 'CHINA', 'INDIA'];
  NATIONS.forEach((n) => add('ORIGIN', n, s.countries.has(n), `catch a car from ${n}`));
  B.push(...ladder('ORIGIN', 'NATIONS', s.nations, [2, 4, 6, 8, 10]));
  [300, 400, 500, 600, 700, 850, 1000, 1300, 1600].forEach((h) => add('POWER', `${h} HP`, s.hp >= h, `catch something with ${h}hp`));
  [140, 160, 180, 200, 220, 250, 280].forEach((v) => add('POWER', `${v} MPH`, s.top >= v, `catch something that tops ${v}mph`));
  [6, 5, 4, 3.5, 3, 2.7, 2.4].forEach((z) => add('POWER', `0-60 IN ${z}S`, s.quick <= z, `catch something that hits 60 in ${z}s`));
  B.push(...ladder('PAINT', 'RARE PAINT', s.rareColor, [1, 3, 10, 25, 50]));
  B.push(...ladder('PAINT', 'BOLD PAINT', s.uncColor, [1, 5, 20, 50]));
  B.push(...ladder('STREAK', 'STREAK', streakOf(profile, now), [2, 3, 5, 7, 10, 14, 21, 30, 50, 75, 100], 'D'));
  B.push(...ladder('STREAK', 'ACTIVE DAYS', s.days.size, [2, 5, 10, 20, 40, 75, 150, 300]));
  B.push(...ladder('RANK', 'LEVEL', levelFor(xp), [2, 5, 10, 15, 20, 30, 40, 50, 60, 70, 85, 100]));
  B.push(...ladder('FIELD', 'MAP PINS', s.pins, [1, 5, 10, 25, 50, 100, 200, 400]));
  B.push(...ladder('FIELD', 'NOTES', s.notes, [1, 5, 15, 40]));
  B.push(...ladder('FIELD', 'NIGHT CATCH', s.night, [1, 5, 15, 40]));
  B.push(...ladder('FIELD', 'DAWN CATCH', s.dawn, [1, 5, 15]));
  B.push(...ladder('FIELD', 'WEEKEND CATCH', s.weekend, [1, 10, 30, 75]));
  add('ERA', 'PRE-1970', s.oldest < 1970, 'catch something built before 1970');
  add('ERA', 'PRE-1990', s.oldest < 1990, 'catch something built before 1990');
  add('ERA', 'PRE-2005', s.oldest < 2005, 'catch something built before 2005');
  add('ERA', 'MODERN', s.newest >= 2023, 'catch something built this decade');
  B.push(...ladder('ERA', 'ELECTRIC', s.ev, [1, 5, 15, 40]));
  B.push(...ladder('HABIT', 'SAME MODEL', s.maxDup, [2, 3, 5, 10, 20], 'x'));
  add('SPECIAL', "THE PEOPLE'S CAR", s.dex.has(POPULAR_ONE.n), 'catch the most ordinary car in the bix');
  add('SPECIAL', 'THE UNICORN', s.dex.has(RAREST_ONE.n), 'catch the rarest car in the bix');
  add('SPECIAL', 'RACE WINNER', ((profile.raceStreak as number) || 0) >= 1, 'win a race');
  add('SPECIAL', 'RACE STREAK 3', ((profile.raceStreak as number) || 0) >= 3, 'win three races in a row');
  add('SPECIAL', 'FIRST FRIEND', (profile.friends || []).length >= 1, 'add a friend');
  add('SPECIAL', 'AVATAR SET', !!profile.avatar, 'pick a profile car');
  add('SPECIAL', 'DEBUG SPOTTER', !!profile.secretDebug, '???');
  add('SPECIAL', 'FIRST TARGET', ((profile.targets as number) || 0) >= 1, 'catch a car off your starred list');
  B.push(...ladder('FIELD', 'TARGETS DOWN', (profile.targets as number) || 0, [1, 5, 15, 40]));
  B.push(...ladder('COLLECTOR', 'VALUE $M', Math.floor(garageValueRaw(garage) / 1e6), [1, 3, 10, 30, 100]));
  B.push(...ladder('RANK', 'PERFECT EXAMS', (profile.examPerfect as number) || 0, [1, 5, 20]));
  B.push(...ladder('FIELD', 'MILES LOGGED', Math.floor(spotMiles(garage)), [10, 50, 150, 500]));
  B.push(...ladder('FIELD', 'ZONES', zonesExplored(garage), [3, 10, 25, 60]));
  B.push(...ladder('SPECIAL', 'SETS COMPLETE', Object.keys((profile.setsDone as object) || {}).length, [1, 3, 6]));
  add('SPECIAL', 'FULL SPECTRUM', TIERS.every((t) => (s.tiers[t] || 0) >= 1), 'catch one of every rarity');
  const sh = garage.filter((g) => g && g.shiny).length;
  B.push(...ladder('SHINY', 'SHINY', sh, [1, 3, 10, 25]));
  return B;
}
